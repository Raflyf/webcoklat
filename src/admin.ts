/**
 * OTORISASI HALAMAN ADMIN
 *
 * Halaman admin dipakai untuk melihat dan mencetak QR code kemasan.
 * Hanya orang dalam perusahaan yang boleh membukanya.
 *
 * CARA KERJA:
 *   1. Admin memasukkan PIN di halaman /admin
 *   2. PIN diperiksa di server (BUKAN di browser — kalau di browser, PIN-nya
 *      bisa dibaca siapa pun lewat "View Source")
 *   3. Bila benar, server mengeluarkan TOKEN SESI bertanda tangan
 *   4. Token itu dipakai untuk permintaan berikutnya, dan kedaluwarsa
 *
 * KENAPA PIN DIBANDINGKAN SECARA TIMING-SAFE:
 *   Perbandingan biasa (`===`) berhenti di karakter pertama yang berbeda.
 *   Dari selisih waktu balasan, penyerang bisa menebak PIN satu karakter demi
 *   satu karakter. Karena itu kedua nilai di-hash lebih dulu (supaya panjangnya
 *   selalu sama), lalu dibandingkan dengan waktu yang selalu seragam.
 */
import crypto from 'node:crypto';
import { config } from './env.js';

/** Panjang PIN minimal. PIN pendek bisa ditebak habis dalam hitungan detik. */
export const PANJANG_PIN_MINIMAL = 6;

/** Apakah fitur admin aktif? Butuh ADMIN_PIN yang cukup panjang. */
export function adminAktif(): boolean {
  return config.adminPin.length >= PANJANG_PIN_MINIMAL;
}

/**
 * Bandingkan PIN yang diketik dengan PIN yang benar, tanpa membocorkan
 * informasi lewat selisih waktu.
 */
export function pinBenar(ketikan: string): boolean {
  if (!adminAktif()) return false;

  // Hash lebih dulu: hasilnya selalu 32 byte, jadi panjangnya tidak lagi
  // membocorkan berapa digit PIN yang benar.
  const a = crypto.createHash('sha256').update(String(ketikan ?? ''), 'utf8').digest();
  const b = crypto.createHash('sha256').update(config.adminPin, 'utf8').digest();
  return crypto.timingSafeEqual(a, b);
}

interface IsiTokenAdmin {
  /** Peran — dipakai agar token admin tidak bisa dipakai sebagai token video. */
  r: 'admin';
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
  // Kunci diturunkan dari TOKEN_SECRET + PIN, sehingga mengganti PIN otomatis
  // membatalkan semua sesi admin yang masih berjalan.
  const kunci = crypto.createHash('sha256').update(`${config.tokenSecret}|admin|${config.adminPin}`).digest();
  return base64url(crypto.createHmac('sha256', kunci).update(payload).digest());
}

export function buatTokenAdmin(): string {
  const isi: IsiTokenAdmin = {
    r: 'admin',
    e: Math.floor(Date.now() / 1000) + config.adminSesiJam * 3600,
  };
  const payload = base64url(Buffer.from(JSON.stringify(isi), 'utf8'));
  return `${payload}.${tandaTangan(payload)}`;
}

export function periksaTokenAdmin(token: string): boolean {
  const bagian = String(token || '').split('.');
  if (bagian.length !== 2) return false;
  const payload = bagian[0] as string;
  const sig = bagian[1] as string;
  if (!payload || !sig) return false;

  const diharapkan = tandaTangan(payload);
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(diharapkan, 'utf8');
  if (a.length !== b.length) return false;
  if (!crypto.timingSafeEqual(a, b)) return false;

  try {
    const isi = JSON.parse(dariBase64url(payload).toString('utf8')) as IsiTokenAdmin;
    if (isi?.r !== 'admin') return false;
    if (typeof isi.e !== 'number' || isi.e * 1000 < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}
