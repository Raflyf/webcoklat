/**
 * INFORMASI UMUM
 * GET /api/info
 *
 * Dipakai halaman tampilan untuk mengambil nama perusahaan dan batas ukuran
 * video. Tujuannya supaya nama perusahaan cukup diubah di SATU tempat
 * (environment variable), tidak perlu mengedit banyak berkas HTML.
 *
 * Endpoint ini sengaja TIDAK menampilkan konfigurasi apa pun yang sensitif —
 * hanya nilai yang memang boleh dilihat pengunjung.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { config, konfigurasiKurang } from '../src/env.js';
import { kirimOk } from '../src/http.js';

export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, pesan: 'Metode tidak didukung.' });
    return;
  }

  const kurang = konfigurasiKurang();

  res.setHeader('Cache-Control', 'public, max-age=60');
  kirimOk(res, {
    namaPerusahaan: config.namaPerusahaan,
    maksUkuranVideoMb: config.maksUkuranVideoMb,
    // Hanya penanda siap/tidak — TIDAK menyebutkan variabel mana yang kurang,
    // karena itu informasi internal.
    siap: kurang.length === 0,
  });
}
