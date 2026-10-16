/**
 * PENERIMA MEMASUKKAN KODE
 * POST /api/cek
 *
 * Yang dikerjakan:
 *   1. Batasi jumlah percobaan per alamat IP (mencegah orang menebak-nebak kode)
 *   2. Rapikan kode yang diketik (huruf kecil, spasi, tanda hubung hilang — dimaafkan)
 *   3. Cari pesanan yang cocok di spreadsheet
 *   4. Bila cocok, keluarkan TOKEN VIDEO sementara
 *
 * KENAPA BALASANNYA TIDAK MENYEBUT KODE SALAH/BENAR SECARA RINCI:
 *   Pesan "kode tidak ditemukan" untuk kode yang salah dan "kode tidak aktif"
 *   untuk kode yang ada tapi dimatikan bisa dipakai menebak kode mana yang
 *   benar-benar terdaftar. Untuk kode yang gagal, balasan disamakan.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { config, konfigurasiKurang } from '../src/env.js';
import { ambilIp, cekBatas, lupakan } from '../src/rate_limit.js';
import { bacaJson, KesalahanRamah, kirimOk, wajibMetode, denganPenangananError } from '../src/http.js';
import { rapikanKode, variasiKode } from '../src/kode.js';
import { cariPesanan } from '../src/sheets.js';
import { buatTokenVideo } from '../src/token.js';
import { jelaskanErrorGoogle } from '../src/google.js';

export default denganPenangananError('cek', async (req: VercelRequest, res: VercelResponse) => {
  wajibMetode(req, 'POST');

  if (konfigurasiKurang().length > 0) {
    throw new KesalahanRamah('Layanan belum siap dipakai. Kabari pemilik toko ya.', 503);
  }

  const ip = ambilIp(req.headers as Record<string, string | string[] | undefined>);
  const kunciBatas = `kode:${ip}`;
  const batas = cekBatas(kunciBatas, config.batasPercobaanKode, config.jendelaPercobaanMenit);
  if (!batas.boleh) {
    const menit = Math.ceil(batas.tungguDetik / 60);
    throw new KesalahanRamah(
      `Terlalu banyak percobaan. Coba lagi dalam ${menit} menit ya.`,
      429,
    );
  }

  const { kode } = bacaJson<{ kode?: string }>(req);
  const ketikan = String(kode ?? '');
  if (ketikan.replace(/[^a-zA-Z0-9]/g, '').length < 5) {
    throw new KesalahanRamah('Kode belum lengkap. Periksa lagi kartu di dalam kemasan ya.');
  }

  // Coba kode apa adanya, lalu variasi salah-baca yang umum (0/O, 1/I/L, 5/S, 8/B, 2/Z).
  // Kartu sering ditulis tangan, jadi toleransi ini menyelamatkan penerima yang
  // sebenarnya memegang kode yang benar.
  const kandidat = variasiKode(rapikanKode(ketikan));

  let pesanan: Awaited<ReturnType<typeof cariPesanan>>;
  try {
    pesanan = await cariPesanan(kandidat);
  } catch (err) {
    console.error('[cek] gagal membaca daftar pesanan:', err);
    throw new KesalahanRamah(jelaskanErrorGoogle(err), 502);
  }

  if (!pesanan || !pesanan.fileId) {
    // Pesan sengaja umum: jangan beri tahu apakah kodenya ada atau tidak.
    throw new KesalahanRamah(
      'Kode tidak ditemukan. Periksa lagi penulisannya (contoh: CH-7K9P-2M4Q).',
      404,
    );
  }

  if (pesanan.status && !['aktif', 'ditonton'].includes(pesanan.status.toLowerCase())) {
    throw new KesalahanRamah(
      'Video untuk kode ini sedang tidak dapat dibuka. Hubungi pemilik toko ya.',
      403,
    );
  }

  // Berhasil -> hitungan percobaan gagal direset, supaya penerima yang membuka
  // videonya berkali-kali tidak ikut terkena batas.
  lupakan(kunciBatas);

  const token = buatTokenVideo(pesanan.fileId, pesanan.kode);

  kirimOk(res, {
    token,
    judul: pesanan.judul,
    pengirim: pesanan.namaPembeli,
    penerima: pesanan.namaPenerima,
    pesan: pesanan.pesan,
    masaBerlakuJam: config.tokenMasaBerlakuJam,
  });
});
