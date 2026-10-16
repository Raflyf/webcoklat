/**
 * MENAYANGKAN VIDEO
 * GET /api/video?t=<token>
 *
 * KENAPA VIDEO DITERUSKAN LEWAT SERVER, BUKAN MEMAKAI TAUTAN GOOGLE DRIVE:
 *   Kalau kita memberi tautan Drive langsung, tautan itu bisa diteruskan ke
 *   siapa pun — dan kalau file dibuat "siapa saja yang punya tautan", video
 *   pembeli bisa tersebar tanpa bisa ditarik lagi.
 *
 *   Dengan diteruskan lewat server, file di Drive TETAP PRIVAT (hanya service
 *   account dan pemilik yang bisa membukanya). Yang diterima penerima hanyalah
 *   token sementara yang bisa kedaluwarsa dan tidak bisa dipakai ulang di
 *   perangkat lain tanpa kode lagi.
 *
 * DUKUNGAN GESER (SEEK):
 *   Permintaan pemutar video diteruskan apa adanya ke Google lewat header
 *   `Range`. Google yang memotong datanya, jadi video bisa digeser tanpa harus
 *   mengunduh seluruhnya lebih dulu.
 */
import { Readable } from 'node:stream';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { periksaTokenVideo } from '../src/token.js';
import { ambilIsiVideo } from '../src/drive.js';
import { konfigurasiKurang } from '../src/env.js';

/** Ubah ReadableStream (standar web) menjadi stream Node agar bisa diteruskan ke respons. */
function keStreamNode(body: ReadableStream<Uint8Array>): Readable {
  return Readable.fromWeb(body as unknown as Parameters<typeof Readable.fromWeb>[0]);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).json({ ok: false, pesan: 'Metode tidak didukung.' });
    return;
  }

  if (konfigurasiKurang().length > 0) {
    res.status(503).json({ ok: false, pesan: 'Layanan belum siap dipakai.' });
    return;
  }

  const token = String((req.query?.t as string | undefined) ?? '');
  const isi = periksaTokenVideo(token);
  if (!isi) {
    // Token palsu atau kedaluwarsa. Balasan sengaja tidak menjelaskan yang mana,
    // supaya tidak membantu siapa pun menebak-nebak.
    res.status(403).json({
      ok: false,
      pesan: 'Tautan video sudah tidak berlaku. Masukkan kode sekali lagi ya.',
    });
    return;
  }

  const range = typeof req.headers.range === 'string' ? req.headers.range : undefined;

  let dariGoogle: Response;
  try {
    dariGoogle = await ambilIsiVideo(isi.f, range);
  } catch (err) {
    console.error('[video] gagal mengambil dari Drive:', err);
    res.status(502).json({ ok: false, pesan: 'Video sedang tidak bisa dimuat. Coba lagi ya.' });
    return;
  }

  // 200 = seluruh video, 206 = potongan (normal saat pemutar menggeser posisi).
  if (dariGoogle.status !== 200 && dariGoogle.status !== 206) {
    console.error(`[video] Google menolak: HTTP ${dariGoogle.status}`);
    res.status(502).json({ ok: false, pesan: 'Video sedang tidak bisa dimuat. Coba lagi ya.' });
    return;
  }

  res.status(dariGoogle.status);
  const jenis = dariGoogle.headers.get('content-type');
  const panjang = dariGoogle.headers.get('content-length');
  const potongan = dariGoogle.headers.get('content-range');
  if (jenis) res.setHeader('Content-Type', jenis);
  if (panjang) res.setHeader('Content-Length', panjang);
  if (potongan) res.setHeader('Content-Range', potongan);
  res.setHeader('Accept-Ranges', 'bytes');
  // private: hanya untuk perangkat penerima ini. no-store: jangan disimpan di
  // cache perantara, supaya tautan tidak bisa dipakai ulang dari cache.
  res.setHeader('Cache-Control', 'private, no-store');

  if (req.method === 'HEAD' || !dariGoogle.body) {
    res.end();
    return;
  }

  const aliran = keStreamNode(dariGoogle.body);
  aliran.on('error', (err) => {
    // Penerima menutup pemutar di tengah streaming itu normal — jangan dianggap rusak.
    console.warn('[video] aliran terputus:', String(err).slice(0, 160));
    res.destroy();
  });
  // Bila penerima menutup halaman, hentikan pengambilan dari Google agar kuota
  // tidak terbuang untuk data yang sudah tidak ditonton.
  res.on('close', () => aliran.destroy());
  aliran.pipe(res);
}
