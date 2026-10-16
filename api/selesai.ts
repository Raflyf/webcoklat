/**
 * LANGKAH 2 — SELESAI PESANAN
 * POST /api/selesai
 *
 * Dipanggil browser SETELAH video selesai diunggah ke Google.
 *
 * Yang dikerjakan:
 *   1. Periksa token sesi (memastikan permintaan ini benar dari alur kita)
 *   2. Cari videonya di folder Drive — JANGAN percaya begitu saja pada browser
 *   3. Catat pesanan ke Google Sheets
 *   4. Kembalikan kode pesanan untuk ditulis di kartu
 *
 * KENAPA VIDEO DIPERIKSA ULANG KE GOOGLE:
 *   Browser bisa saja berbohong ("sudah selesai") padahal unggahan gagal di
 *   tengah jalan. Kalau kita percaya begitu saja, kode pesanan tercatat di
 *   spreadsheet padahal videonya tidak ada — dan penerima akan menemukan kode
 *   yang tidak bisa membuka apa pun. Jadi kita tanya langsung ke Google.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { konfigurasiKurang } from '../src/env.js';
import { bacaJson, KesalahanRamah, kirimOk, wajibMetode, denganPenangananError } from '../src/http.js';
import { periksaTokenSesi } from '../src/token.js';
import { cariFileDiFolder } from '../src/drive.js';
import { catatPesanan, siapkanJudulKolom } from '../src/sheets.js';
import { tampilkanKode } from '../src/kode.js';
import { jelaskanErrorGoogle } from '../src/google.js';

export default denganPenangananError('selesai', async (req: VercelRequest, res: VercelResponse) => {
  wajibMetode(req, 'POST');

  if (konfigurasiKurang().length > 0) {
    throw new KesalahanRamah('Layanan belum siap dipakai. Pemilik situs perlu melengkapi pengaturan Google dulu.', 503);
  }

  const { sesi } = bacaJson<{ sesi?: string }>(req);
  const isi = periksaTokenSesi(String(sesi ?? ''));
  if (!isi) {
    throw new KesalahanRamah(
      'Sesi pengiriman sudah tidak berlaku (mungkin kedaluwarsa). Silakan isi formulir ulang ya.',
      410,
    );
  }

  // ── Pastikan videonya benar-benar ada di Drive ──
  //
  // KENAPA DICOBA BERULANG KALI (temuan nyata 16 Okt 2026):
  //   Google TIDAK mengirim header CORS pada balasan unggahan. Akibatnya browser
  //   selalu melaporkan "koneksi terputus" WALAU unggahannya berhasil. Halaman
  //   kirim karena itu tetap memanggil endpoint ini meski browser mengira gagal —
  //   dan di sinilah kebenarannya diperiksa.
  //
  //   Karena panggilan itu bisa tiba tepat saat Google masih menyelesaikan
  //   penulisan berkasnya, pencarian diulang beberapa kali sebelum menyerah.
  let file: Awaited<ReturnType<typeof cariFileDiFolder>> = null;
  const JUMLAH_COBA = 4;
  for (let percobaan = 1; percobaan <= JUMLAH_COBA; percobaan++) {
    try {
      file = await cariFileDiFolder(isi.folderId);
    } catch (err) {
      console.error(`[selesai] gagal memeriksa Drive (percobaan ${percobaan}):`, err);
      if (percobaan === JUMLAH_COBA) throw new KesalahanRamah(jelaskanErrorGoogle(err), 502);
    }
    if (file) break;
    if (percobaan < JUMLAH_COBA) {
      console.warn(`[selesai] video belum terlihat (percobaan ${percobaan}/${JUMLAH_COBA}) — menunggu sebentar.`);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  if (!file) {
    throw new KesalahanRamah(
      'Videonya belum terlihat di penyimpanan. Kemungkinan unggahan terputus — coba kirim ulang ya.',
      409,
    );
  }

  // Ukuran berbeda jauh biasanya berarti unggahan terpotong. Toleransi 2%
  // diberikan karena Google kadang melaporkan ukuran sedikit berbeda.
  const selisih = Math.abs(file.ukuranByte - isi.ukuranByte);
  const toleransi = Math.max(isi.ukuranByte * 0.02, 64 * 1024);
  if (isi.ukuranByte > 0 && file.ukuranByte > 0 && selisih > toleransi) {
    console.warn(
      `[selesai] ukuran tidak cocok kode=${isi.kode} diharapkan=${isi.ukuranByte} diterima=${file.ukuranByte}`,
    );
    throw new KesalahanRamah(
      'Videonya sepertinya terunggah tidak utuh. Coba kirim ulang ya.',
      409,
    );
  }

  // ── Catat ke spreadsheet ──
  try {
    await siapkanJudulKolom();
    await catatPesanan({
      kode: isi.kode,
      dibuat: new Date().toISOString(),
      namaPembeli: isi.namaPembeli,
      namaPenerima: isi.namaPenerima,
      judul: isi.judul,
      pesan: isi.pesan,
      folderId: isi.folderId,
      fileId: file.id,
      status: 'aktif',
    });
  } catch (err) {
    console.error('[selesai] gagal mencatat ke Sheets:', err);
    // Video sudah aman di Drive, jadi jangan bilang gagal total — beri tahu
    // kode tetap berlaku, hanya pencatatannya yang perlu dibereskan pemilik.
    throw new KesalahanRamah(
      'Videonya sudah tersimpan, tetapi pencatatan pesanan gagal. Kabari pemilik toko ya — kode Anda: ' +
        isi.kode,
      502,
    );
  }

  kirimOk(res, {
    kode: isi.kode,
    tampilKode: tampilkanKode(isi.kode),
    namaPenerima: isi.namaPenerima,
    ukuranMb: Math.round((file.ukuranByte / 1024 / 1024) * 10) / 10,
  });
});
