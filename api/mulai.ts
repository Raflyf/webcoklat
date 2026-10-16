/**
 * LANGKAH 1 — MULAI PESANAN
 * POST /api/mulai
 *
 * Yang dikerjakan:
 *   1. Periksa data formulir (nama, jenis & ukuran video)
 *   2. Buat folder khusus untuk pesanan ini di Google Drive
 *   3. Minta Google membuat "sesi unggah" untuk video tersebut
 *   4. Kembalikan URI unggah + KODE pesanan ke browser
 *
 * KENAPA VIDEO TIDAK DIUNGGAH LEWAT SINI:
 *   Vercel membatasi isi permintaan ke fungsi serverless sekitar 4,5 MB,
 *   sedangkan video pembeli 20-100 MB. Karena itu endpoint ini hanya
 *   MENYIAPKAN tempat; browser pembeli mengunggah videonya LANGSUNG ke Google.
 *   Isi video tidak pernah melewati server kita.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { config, konfigurasiKurang } from '../src/env.js';
import { ambilIp, cekBatas } from '../src/rate_limit.js';
import { bacaJson, KesalahanRamah, kirimOk, wajibMetode, denganPenangananError } from '../src/http.js';
import { bersihkanNama, validasiPesanan } from '../src/validasi.js';
import { buatKode, tampilkanKode } from '../src/kode.js';
import { buatFolderPesanan, buatSesiUpload } from '../src/drive.js';
import { buatTokenSesi } from '../src/token.js';
import { jelaskanErrorGoogle } from '../src/google.js';

export default denganPenangananError('mulai', async (req: VercelRequest, res: VercelResponse) => {
  wajibMetode(req, 'POST');

  const kurang = konfigurasiKurang();
  if (kurang.length > 0) {
    console.error('[mulai] konfigurasi kurang:', kurang.join(', '));
    throw new KesalahanRamah(
      'Layanan belum siap dipakai. Pemilik situs perlu melengkapi pengaturan Google dulu.',
      503,
    );
  }

  // Batasi jumlah pengiriman per alamat IP supaya Drive tidak dibanjiri.
  const ip = ambilIp(req.headers as Record<string, string | string[] | undefined>);
  const batas = cekBatas(`kirim:${ip}`, config.batasKirimPerHari, 24 * 60);
  if (!batas.boleh) {
    throw new KesalahanRamah(
      `Sudah terlalu banyak pengiriman dari jaringan ini hari ini (maksimal ${config.batasKirimPerHari}). Coba lagi besok ya.`,
      429,
    );
  }

  const data = validasiPesanan(bacaJson(req));
  const kode = buatKode();

  // Nama folder memuat kode di depan supaya pemilik mudah mencocokkan folder
  // dengan baris di spreadsheet, dan mudah mencari folder tertentu di Drive.
  const namaFolder = `${kode} - ${bersihkanNama(data.namaPenerima, 40)}`;

  let folderId: string;
  let uploadUri: string;
  try {
    folderId = await buatFolderPesanan(namaFolder);
    const sesi = await buatSesiUpload({
      folderId,
      namaFile: data.namaFile,
      mime: data.mime,
      ukuranByte: data.ukuranByte,
    });
    uploadUri = sesi.uri;
  } catch (err) {
    console.error('[mulai] gagal menyiapkan unggahan:', err);
    throw new KesalahanRamah(jelaskanErrorGoogle(err), 502);
  }

  // Data pesanan dititipkan ke browser dalam token bertanda tangan, lalu
  // dikembalikan saat langkah "selesai" — server tidak perlu menyimpan apa pun.
  const sesiToken = buatTokenSesi({
    folderId,
    kode,
    namaPembeli: data.namaPembeli,
    namaPenerima: data.namaPenerima,
    judul: data.judul,
    pesan: data.pesan,
    namaFile: data.namaFile,
    ukuranByte: data.ukuranByte,
  });

  kirimOk(res, {
    kode,
    tampilKode: tampilkanKode(kode),
    uploadUri,
    sesi: sesiToken,
  });
});
