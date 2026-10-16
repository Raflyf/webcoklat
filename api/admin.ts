/**
 * HALAMAN ADMIN — CETAK QR CODE
 * POST /api/admin   { pin }        -> masuk, dapat token sesi
 * GET  /api/admin?t=<token>        -> data untuk halaman admin
 *
 * KENAPA PIN DIPERIKSA DI SERVER:
 *   Kalau PIN disimpan/diperiksa di JavaScript browser, siapa pun bisa membuka
 *   "View Source" atau Network tab dan membacanya. PIN harus selalu diperiksa
 *   di server, dan browser hanya menerima token sesi setelah PIN benar.
 *
 * KENAPA ADA BATAS PERCOBAAN:
 *   Tanpa batas, PIN 6 angka bisa dicoba habis dalam beberapa menit. Dengan
 *   batas 5 percobaan per 15 menit, menebak seluruh kemungkinan butuh waktu
 *   puluhan tahun.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import QRCode from 'qrcode';
import { config } from '../src/env.js';
import { adminAktif, buatTokenAdmin, PANJANG_PIN_MINIMAL, periksaTokenAdmin, pinBenar } from '../src/admin.js';
import { ambilIp, cekBatas, lupakan } from '../src/rate_limit.js';
import { bacaJson, KesalahanRamah, kirimOk, denganPenangananError } from '../src/http.js';
import { pesananTerbaru } from '../src/sheets.js';
import { jelaskanErrorGoogle } from '../src/google.js';

/** Opsi QR — HARUS sama dengan scripts/buat_qr.ts dan tests/qr.test.mjs. */
const OPSI_QR = {
  errorCorrectionLevel: 'H' as const, // tahan kotor/terlipat di kemasan
  margin: 4,
  color: { dark: '#3d2417', light: '#ffffff' },
};

/** Batas percobaan PIN. Sengaja ketat karena hanya staf yang memakainya. */
const BATAS_PERCOBAAN_PIN = 5;
const JENDELA_PIN_MENIT = 15;

export default denganPenangananError('admin', async (req: VercelRequest, res: VercelResponse) => {
  // Jangan pernah memberi petunjuk apa pun bila fitur admin tidak diaktifkan.
  if (!adminAktif()) {
    throw new KesalahanRamah('Halaman admin tidak diaktifkan.', 404);
  }

  const ip = ambilIp(req.headers as Record<string, string | string[] | undefined>);
  const kunciBatas = `admin:${ip}`;

  // ── MASUK: periksa PIN ──
  if (req.method === 'POST') {
    const batas = cekBatas(kunciBatas, BATAS_PERCOBAAN_PIN, JENDELA_PIN_MENIT);
    if (!batas.boleh) {
      const menit = Math.ceil(batas.tungguDetik / 60);
      throw new KesalahanRamah(`Terlalu banyak percobaan PIN. Coba lagi dalam ${menit} menit.`, 429);
    }

    const { pin } = bacaJson<{ pin?: string }>(req);
    if (!pinBenar(String(pin ?? ''))) {
      // Pesan sengaja tidak menyebut berapa digit yang benar.
      throw new KesalahanRamah('PIN salah.', 401);
    }

    lupakan(kunciBatas); // PIN benar -> hitungan percobaan direset
    kirimOk(res, { token: buatTokenAdmin(), sesiJam: config.adminSesiJam });
    return;
  }

  // ── AMBIL DATA: butuh token sesi ──
  if (req.method === 'GET') {
    const token = String((req.query?.t as string | undefined) ?? '');
    if (!periksaTokenAdmin(token)) {
      throw new KesalahanRamah('Sesi admin sudah berakhir. Masukkan PIN lagi.', 401);
    }

    // Alamat yang ditanam di QR: halaman penerima, bukan halaman depan.
    const alamat = `${config.situsUrl.replace(/\/+$/, '')}/v`;

    const [qrPng, qrSvg] = await Promise.all([
      QRCode.toDataURL(alamat, { ...OPSI_QR, width: 900 }),
      QRCode.toString(alamat, { ...OPSI_QR, type: 'svg' }),
    ]);

    // Daftar pesanan terbaru — berguna untuk memastikan sistemnya berjalan.
    // Bila gagal (mis. Sheets belum siap), halaman admin tetap boleh tampil;
    // QR-nya tidak bergantung pada data pesanan.
    let pesanan: Array<Record<string, string>> = [];
    let catatanPesanan = '';
    try {
      const daftar = await pesananTerbaru(15);
      pesanan = daftar.map((p) => ({
        kode: p.kode,
        dibuat: p.dibuat,
        penerima: p.namaPenerima,
        pembeli: p.namaPembeli,
        judul: p.judul,
        status: p.status,
      }));
    } catch (err) {
      console.warn('[admin] gagal membaca daftar pesanan:', err);
      catatanPesanan = jelaskanErrorGoogle(err);
    }

    res.setHeader('Cache-Control', 'no-store');
    kirimOk(res, {
      namaPerusahaan: config.namaPerusahaan,
      alamat,
      qrPng,
      qrSvg,
      pesanan,
      catatanPesanan,
      panjangPinMinimal: PANJANG_PIN_MINIMAL,
    });
    return;
  }

  throw new KesalahanRamah('Metode permintaan tidak didukung.', 405);
});
