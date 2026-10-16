/**
 * KONFIGURASI TERPUSAT
 *
 * Semua nilai rahasia dibaca dari environment variable — TIDAK ADA yang
 * ditulis di kode. Kalau ada nilai yang kurang, program berhenti dengan
 * pesan jelas alih-alih gagal diam-diam di tengah jalan.
 */

function teks(nama: string, bawaan = ''): string {
  const v = process.env[nama];
  return (v ?? bawaan).trim();
}

function angka(nama: string, bawaan: number): number {
  const v = Number(teks(nama));
  return Number.isFinite(v) && v > 0 ? v : bawaan;
}

/** Private key Google sering tersimpan dengan `\n` literal — ubah jadi baris baru asli. */
function rapikanPrivateKey(raw: string): string {
  let k = raw.trim();
  // Buang tanda kutip pembungkus bila ada
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1);
  }
  return k.replace(/\\n/g, '\n').trim();
}

export const config = {
  situsUrl: teks('SITUS_URL', 'http://localhost:3000').replace(/\/+$/, ''),
  namaPerusahaan: teks('NAMA_PERUSAHAAN', 'Cokelat Kita'),

  // ── Google ──
  googleClientEmail: teks('GOOGLE_CLIENT_EMAIL'),
  googlePrivateKey: rapikanPrivateKey(teks('GOOGLE_PRIVATE_KEY')),
  driveFolderId: teks('GOOGLE_DRIVE_FOLDER_ID'),
  sheetId: teks('GOOGLE_SHEET_ID'),
  sheetTab: teks('GOOGLE_SHEET_TAB', 'Sheet1'),

  // ── Google OAuth (akun pemilik) ──
  // KENAPA DIPERLUKAN, PADAHAL SUDAH ADA SERVICE ACCOUNT:
  //   Service account TIDAK PUNYA KUOTA penyimpanan. Ia bisa MEMBUAT FOLDER di
  //   Drive Anda, tetapi berkas yang ia unggah dihitung terhadap kuotanya
  //   sendiri — yaitu 0. Hasilnya unggahan video gagal dengan HTTP 403
  //   "Service Accounts do not have storage quota".
  //
  //   Jadi untuk MENYIMPAN berkas, sistem harus memakai izin akun Google
  //   PEMILIK (OAuth). Service account tetap dipakai bila OAuth belum diisi,
  //   supaya setup bisa diuji bertahap.
  googleOauthClientId: teks('GOOGLE_OAUTH_CLIENT_ID'),
  googleOauthClientSecret: teks('GOOGLE_OAUTH_CLIENT_SECRET'),
  googleOauthRefreshToken: teks('GOOGLE_OAUTH_REFRESH_TOKEN'),

  // ── Keamanan ──
  tokenSecret: teks('TOKEN_SECRET'),
  tokenMasaBerlakuJam: angka('TOKEN_MASA_BERLAKU_JAM', 2),
  batasPercobaanKode: angka('BATAS_PERCOBAAN_KODE', 20),
  jendelaPercobaanMenit: angka('JENDELA_PERCOBAAN_MENIT', 15),
  batasKirimPerHari: angka('BATAS_KIRIM_PER_HARI', 30),
  maksUkuranVideoMb: angka('MAKS_UKURAN_VIDEO_MB', 200),

  // ── Opsional ──
  resendApiKey: teks('RESEND_API_KEY'),
  emailNotifikasi: teks('EMAIL_NOTIFIKASI'),
  resendFrom: teks('RESEND_FROM', 'Cokelat Kita <notifikasi@resend.dev>'),

  // ── Halaman admin (cetak QR) ──
  // PIN untuk membuka /admin. Minimal 6 karakter. Kosong = halaman admin mati
  // total (fail-closed) — lebih baik tidak bisa diakses daripada terbuka bebas.
  adminPin: teks('ADMIN_PIN'),
  /** Berapa jam sesi admin berlaku setelah PIN dimasukkan dengan benar. */
  adminSesiJam: angka('ADMIN_SESI_JAM', 8),

  isServerless: Boolean(process.env.VERCEL),
} as const;

/**
 * Periksa konfigurasi wajib. Dipanggil di awal setiap endpoint.
 * Mengembalikan daftar nama yang belum diisi (kosong = semua siap).
 *
 * CATATAN SOAL GOOGLE:
 *   Cukup SALAH SATU cara akses yang lengkap — service account ATAU OAuth.
 *   Tetapi untuk MENYIMPAN berkas, OAuth-lah yang bekerja (service account
 *   tidak punya kuota penyimpanan). Karena itu OAuth diperiksa lebih dulu.
 */
export function konfigurasiKurang(): string[] {
  const kurang: string[] = [];

  const oauthLengkap =
    config.googleOauthClientId && config.googleOauthClientSecret && config.googleOauthRefreshToken;
  const saLengkap = config.googleClientEmail && config.googlePrivateKey;

  if (!oauthLengkap && !saLengkap) {
    kurang.push(
      'GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET + GOOGLE_OAUTH_REFRESH_TOKEN (atau kredensial service account)',
    );
  }

  if (!config.driveFolderId) kurang.push('GOOGLE_DRIVE_FOLDER_ID');
  if (!config.sheetId) kurang.push('GOOGLE_SHEET_ID');
  if (!config.tokenSecret || config.tokenSecret.length < 32) kurang.push('TOKEN_SECRET (minimal 32 karakter)');
  return kurang;
}

/**
 * Apakah sistem memakai OAuth (akun pemilik) atau service account?
 * Dipakai untuk memberi peringatan jelas: dengan service account, unggahan
 * PASTI gagal karena kuota penyimpanannya nol.
 */
export function caraAksesGoogle(): 'oauth' | 'service-account' | 'tidak-ada' {
  if (config.googleOauthClientId && config.googleOauthClientSecret && config.googleOauthRefreshToken) {
    return 'oauth';
  }
  if (config.googleClientEmail && config.googlePrivateKey) return 'service-account';
  return 'tidak-ada';
}
