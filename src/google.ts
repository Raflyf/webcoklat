/**
 * AUTENTIKASI GOOGLE
 *
 * Memakai SERVICE ACCOUNT: sejenis "akun robot" yang dibuat di Google Cloud.
 * Kenapa bukan login akun Google biasa (OAuth)?
 *   - Service account tidak perlu login ulang dan tidak bisa kedaluwarsa
 *     karena orang mengganti kata sandi.
 *   - Untuk mengganti ke akun Google perusahaan nanti, cukup: buat service
 *     account baru di project perusahaan, lalu bagikan folder Drive mereka
 *     ke email service account itu. Tidak ada kode yang perlu diubah.
 *
 * HAK AKSES YANG DIMINTA (sengaja dibatasi):
 *   - drive      : membuat folder, mengunggah, membaca file video
 *   - spreadsheets: mencatat & mencari kode pesanan
 * Tidak ada akses ke Gmail, kontak, kalender, atau lainnya.
 */
import { google } from 'googleapis';
import type { Auth } from 'googleapis';
import { config } from './env.js';

const SCOPE = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
] as const;

let authTersimpan: Auth.JWT | Auth.OAuth2Client | null = null;

/**
 * Ambil klien autentikasi (dibuat sekali per proses).
 *
 * DUA CARA, DIPILIH OTOMATIS:
 *
 *   1. OAuth akun pemilik (DIPAKAI BILA TERSEDIA) — berkas yang diunggah
 *      menjadi milik akun Google pemilik, sehingga masuk kuota penyimpanan
 *      mereka.
 *
 *   2. Service account (cadangan) — bisa MEMBUAT FOLDER dan MEMBACA, tetapi
 *      TIDAK BISA MENYIMPAN berkas: service account tidak punya kuota
 *      penyimpanan, jadi unggahan gagal dengan HTTP 403.
 *
 *   Karena itu, untuk sistem yang benar-benar menyimpan video, OAuth wajib
 *   diisi. Service account tetap didukung agar setup bisa diuji bertahap.
 *
 * Disimpan di variabel modul agar token akses hasil penukaran bisa dipakai
 * ulang. Tanpa ini, setiap permintaan harus menukar ulang ke Google —
 * menambah ~200-400 ms.
 */
export function authGoogle(): Auth.JWT | Auth.OAuth2Client {
  if (authTersimpan) return authTersimpan;

  if (config.googleOauthClientId && config.googleOauthClientSecret && config.googleOauthRefreshToken) {
    const oauth2 = new google.auth.OAuth2(config.googleOauthClientId, config.googleOauthClientSecret);
    oauth2.setCredentials({ refresh_token: config.googleOauthRefreshToken });
    authTersimpan = oauth2;
    return oauth2;
  }

  authTersimpan = new google.auth.JWT({
    email: config.googleClientEmail,
    key: config.googlePrivateKey,
    scopes: [...SCOPE],
  });
  return authTersimpan;
}

export function klienDrive() {
  return google.drive({ version: 'v3', auth: authGoogle() });
}

export function klienSheets() {
  return google.sheets({ version: 'v4', auth: authGoogle() });
}

/** Ambil token akses mentah — dipakai untuk memanggil REST Drive langsung. */
export async function tokenAkses(): Promise<string> {
  const hasil = await authGoogle().getAccessToken();
  const token = typeof hasil === 'string' ? hasil : hasil?.token;
  if (!token) throw new Error('Gagal memperoleh token akses Google.');
  return token;
}

/**
 * Ubah error Google menjadi pesan yang bisa ditindaklanjuti.
 *
 * Error asli Google panjang dan teknis ("insufficientPermissions",
 * "The user does not have sufficient permissions for this file"). Pemilik
 * produk perlu tahu APA yang harus dilakukan, bukan kode errornya.
 */
export function jelaskanErrorGoogle(err: unknown): string {
  const e = err as { code?: number; message?: string; response?: { status?: number; data?: { error?: { message?: string } } } };
  const pesan = String(e?.response?.data?.error?.message ?? e?.message ?? err ?? '');
  const status = e?.response?.status ?? e?.code;

  if (status === 401 || /invalid_grant|Invalid JWT|unauthorized_client/i.test(pesan)) {
    return 'Kredensial Google ditolak. Periksa GOOGLE_CLIENT_EMAIL dan GOOGLE_PRIVATE_KEY (lihat docs/SETUP_GOOGLE.md).';
  }
  if (status === 403 && /permission|forbidden/i.test(pesan)) {
    return 'Service account tidak punya izin. Pastikan folder Drive dan spreadsheet SUDAH dibagikan ke GOOGLE_CLIENT_EMAIL sebagai Editor.';
  }
  if (status === 404 || /notFound|File not found/i.test(pesan)) {
    return 'Folder atau file tidak ditemukan. Periksa GOOGLE_DRIVE_FOLDER_ID dan GOOGLE_SHEET_ID.';
  }
  if (/API has not been used|is disabled/i.test(pesan)) {
    return 'Google Drive/Sheets API belum diaktifkan di project Google Cloud Anda. Lihat docs/SETUP_GOOGLE.md langkah 3.';
  }
  if (/quota|rateLimit|userRateLimitExceeded/i.test(pesan)) {
    return 'Kuota Google sedang penuh. Coba lagi beberapa saat lagi.';
  }
  return `Gagal menghubungi Google: ${pesan.slice(0, 200)}`;
}
