/**
 * TOKEN VIDEO BERTANDA TANGAN
 *
 * KENAPA PERLU:
 *   Setelah penerima memasukkan kode dengan benar, kita TIDAK boleh menaruh
 *   kode itu di URL video (mis. `/api/video?kode=CH-7K9P2M4Q`). Alasannya:
 *   URL tersimpan di riwayat browser, log server, dan gampang diteruskan ke
 *   orang lain — sama saja membocorkan kode.
 *
 *   Jadi server mengeluarkan TOKEN sementara: berisi ID file video, ditandatangani
 *   dengan kunci rahasia, dan kedaluwarsa. Token ini tidak bisa dipalsukan tanpa
 *   kunci, dan tidak berguna setelah masa berlakunya habis.
 */
import crypto from 'node:crypto';
import { config } from './env.js';

interface IsiToken {
  /** ID file video di Google Drive */
  f: string;
  /** Kode pesanan (untuk pencatatan/log, bukan untuk otorisasi) */
  k: string;
  /** Kedaluwarsa (epoch detik) */
  e: number;
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function dariBase64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function tandaTangan(payload: string): string {
  return base64url(crypto.createHmac('sha256', config.tokenSecret).update(payload).digest());
}

/**
 * Periksa tanda tangan + kedaluwarsa, lalu kembalikan isinya.
 * Mengembalikan null bila token cacat, dipalsukan, atau sudah kedaluwarsa.
 */
function buka<T extends { e: number }>(token: string): T | null {
  const bagian = String(token || '').split('.');
  if (bagian.length !== 2) return null;
  const payload = bagian[0] as string;
  const sig = bagian[1] as string;
  if (!payload || !sig) return null;

  const diharapkan = tandaTangan(payload);
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(diharapkan, 'utf8');
  // Panjang berbeda sudah pasti tidak cocok (timingSafeEqual menolak panjang beda).
  if (a.length !== b.length) return null;
  // Dibandingkan timing-safe agar penyerang tidak bisa menebak tanda tangan
  // sedikit demi sedikit dari perbedaan waktu balasan.
  if (!crypto.timingSafeEqual(a, b)) return null;

  try {
    const isi = JSON.parse(dariBase64url(payload).toString('utf8')) as T;
    if (!isi || typeof isi.e !== 'number') return null;
    if (isi.e * 1000 < Date.now()) return null; // kedaluwarsa
    return isi;
  } catch {
    return null;
  }
}

/** Buat token untuk sebuah file video. */
export function buatTokenVideo(fileId: string, kode: string): string {
  const isi: IsiToken = {
    f: fileId,
    k: kode,
    e: Math.floor(Date.now() / 1000) + config.tokenMasaBerlakuJam * 3600,
  };
  const payload = base64url(Buffer.from(JSON.stringify(isi), 'utf8'));
  return `${payload}.${tandaTangan(payload)}`;
}

/**
 * Periksa token. Mengembalikan isinya bila sah, atau null bila tidak.
 *
 * Pemeriksaan meliputi: format, tanda tangan (timing-safe), dan kedaluwarsa.
 */
export function periksaTokenVideo(token: string): IsiToken | null {
  const isi = buka<IsiToken>(token);
  return isi?.f ? isi : null;
}

// ── TOKEN SESI PESANAN ────────────────────────────────────────────────────────
//
// KENAPA PERLU:
//   Alur unggah terbagi dua langkah yang terpisah oleh waktu (video 100 MB bisa
//   memakan beberapa menit):
//     1. `mulai`   -> buat folder + buat sesi unggah
//     2. `selesai` -> pastikan video benar-benar ada, lalu catat ke Sheets
//
//   Di antara kedua langkah itu server TIDAK menyimpan apa pun (serverless tidak
//   punya memori tetap). Jadi data pesanan dititipkan kembali ke browser dalam
//   bentuk token bertanda tangan: browser tidak bisa memalsukannya, dan server
//   tetap tidak perlu database tambahan.
//
//   Isi token ini juga dipakai untuk mencocokkan ulang setelah unggahan selesai,
//   sehingga data yang tercatat pasti sama dengan yang dikirim pembeli.

export interface IsiSesi {
  /** Folder Drive yang sudah dibuat untuk pesanan ini */
  folderId: string;
  /** Kode pesanan (sudah dibuat di langkah 1 agar pembeli bisa langsung melihatnya) */
  kode: string;
  namaPembeli: string;
  namaPenerima: string;
  judul: string;
  pesan: string;
  /** Nama file yang diharapkan muncul di folder */
  namaFile: string;
  /** Ukuran yang diklaim pembeli (byte) — dipakai untuk memastikan unggahan utuh */
  ukuranByte: number;
  /** Kedaluwarsa (epoch detik) */
  e: number;
}

/** Masa berlaku token sesi: cukup untuk mengunggah video besar dengan koneksi lambat. */
const MASA_SESI_JAM = 6;

export function buatTokenSesi(data: Omit<IsiSesi, 'e'>): string {
  const isi: IsiSesi = {
    ...data,
    e: Math.floor(Date.now() / 1000) + MASA_SESI_JAM * 3600,
  };
  const payload = base64url(Buffer.from(JSON.stringify(isi), 'utf8'));
  return `${payload}.${tandaTangan(payload)}`;
}

export function periksaTokenSesi(token: string): IsiSesi | null {
  const isi = buka<IsiSesi>(token);
  return isi?.folderId && isi?.kode ? isi : null;
}
