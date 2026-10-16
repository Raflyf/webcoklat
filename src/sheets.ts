/**
 * GOOGLE SHEETS — buku catatan pesanan
 *
 * KENAPA SHEETS, BUKAN DATABASE:
 *   Perusahaan perlu bisa MEMBUKA dan MELIHAT sendiri daftar pesanannya tanpa
 *   alat khusus. Spreadsheet sudah mereka kenal, bisa diurutkan/difilter, dan
 *   bisa diekspor. Untuk skala bisnis cokelat, ini lebih berguna daripada
 *   database yang hanya bisa dibaca lewat program.
 *
 * URUTAN KOLOM (baris pertama WAJIB persis seperti ini):
 *   kode | dibuat | nama_pembeli | nama_penerima | judul | pesan | folder_id | file_id | status
 *
 * CATATAN SOAL KODE: kolom `kode` disimpan sebagai TEKS. Kalau Sheets mengubahnya
 * jadi format lain, pencocokan bisa gagal — karena itu saat menulis kita paksa
 * formatnya teks.
 */
import { config } from './env.js';
import { klienSheets } from './google.js';

const JUDUL_KOLOM = [
  'kode',
  'dibuat',
  'nama_pembeli',
  'nama_penerima',
  'judul',
  'pesan',
  'folder_id',
  'file_id',
  'status',
] as const;

export interface BarisPesanan {
  kode: string;
  dibuat: string;
  namaPembeli: string;
  namaPenerima: string;
  judul: string;
  pesan: string;
  folderId: string;
  fileId: string;
  status: string;
}

/** Ubah data pesanan menjadi satu baris spreadsheet. */
function keBaris(p: BarisPesanan): string[] {
  return [p.kode, p.dibuat, p.namaPembeli, p.namaPenerima, p.judul, p.pesan, p.folderId, p.fileId, p.status];
}

/** Ubah baris spreadsheet menjadi data pesanan. */
function dariBaris(b: string[]): BarisPesanan {
  const ambil = (i: number): string => String(b[i] ?? '').trim();
  return {
    kode: ambil(0),
    dibuat: ambil(1),
    namaPembeli: ambil(2),
    namaPenerima: ambil(3),
    judul: ambil(4),
    pesan: ambil(5),
    folderId: ambil(6),
    fileId: ambil(7),
    status: ambil(8),
  };
}

// ── Cache singkat ─────────────────────────────────────────────────────────────
// Sheets API membatasi 60 permintaan per menit. Setiap kali penerima membuka
// video kita perlu membaca sheet; tanpa cache, beberapa penerima sekaligus bisa
// menembus batas itu. Cache 60 detik sudah cukup dan langsung dibuang setiap ada
// pesanan baru supaya data tidak basi.
let cache: { baris: BarisPesanan[]; pada: number } | null = null;
const CACHE_MS = 60_000;

function buangCache(): void {
  cache = null;
}

/** Baca seluruh baris pesanan (dengan cache singkat). */
async function bacaSemua(paksa = false): Promise<BarisPesanan[]> {
  if (!paksa && cache && Date.now() - cache.pada < CACHE_MS) return cache.baris;

  const sheets = klienSheets();
  const hasil = await sheets.spreadsheets.values.get({
    spreadsheetId: config.sheetId,
    range: `${config.sheetTab}!A2:I`,
  });
  const baris = (hasil.data.values ?? []).map((r) => dariBaris(r as string[]));
  cache = { baris, pada: Date.now() };
  return baris;
}

/**
 * Pastikan baris judul kolom ada.
 *
 * Kalau spreadsheet baru masih kosong, kita tulis judulnya otomatis supaya
 * pemilik tidak perlu menyiapkan apa pun secara manual.
 */
export async function siapkanJudulKolom(): Promise<void> {
  const sheets = klienSheets();
  const ada = await sheets.spreadsheets.values.get({
    spreadsheetId: config.sheetId,
    range: `${config.sheetTab}!A1:I1`,
  });
  const isi = (ada.data.values?.[0] ?? []) as string[];
  if (isi.length >= JUDUL_KOLOM.length && String(isi[0]).toLowerCase() === 'kode') return;

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.sheetId,
    range: `${config.sheetTab}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [[...JUDUL_KOLOM]] },
  });
  buangCache();
}

/** Catat satu pesanan baru ke spreadsheet. */
export async function catatPesanan(p: BarisPesanan): Promise<void> {
  const sheets = klienSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: config.sheetId,
    range: `${config.sheetTab}!A2`,
    // RAW penting: tanpa ini Sheets bisa menafsirkan kode sebagai rumus/tanggal.
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [keBaris(p)] },
  });
  buangCache();
}

/**
 * Cari pesanan berdasarkan kode.
 *
 * `kodeKandidat` berisi kode yang sudah dirapikan beserta variasi salah-baca
 * (0/O, 1/I/L, dst). Pencocokan mengabaikan huruf besar/kecil dan tanda hubung.
 */
export async function cariPesanan(kodeKandidat: string[]): Promise<BarisPesanan | null> {
  const normal = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const target = new Set(kodeKandidat.map(normal));

  const cocok = (baris: BarisPesanan[]): BarisPesanan | null =>
    baris.find((p) => target.has(normal(p.kode))) ?? null;

  const dariCache = cocok(await bacaSemua());
  if (dariCache) return dariCache;

  // Belum ketemu -> baca ulang tanpa cache, untuk kasus pesanan baru dibuat
  // beberapa detik lalu (mis. penerima langsung mencoba saat itu juga).
  return cocok(await bacaSemua(true));
}

/** Perbarui status sebuah pesanan (mis. `aktif` -> `ditonton`). */
export async function perbaruiStatus(kode: string, status: string): Promise<void> {
  const baris = await bacaSemua(true);
  const normal = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const indeks = baris.findIndex((p) => normal(p.kode) === normal(kode));
  if (indeks < 0) return;

  const nomorBaris = indeks + 2; // +1 judul kolom, +1 karena indeks mulai 0
  const sheets = klienSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.sheetId,
    range: `${config.sheetTab}!I${nomorBaris}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[status]] },
  });
  buangCache();
}

/** Hitung berapa pesanan yang dibuat sejak awal hari ini (waktu Indonesia). */
export async function hitungPesananHariIni(): Promise<number> {
  const baris = await bacaSemua();
  const hariIni = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' });
  return baris.filter((p) => {
    if (!p.dibuat) return false;
    const d = new Date(p.dibuat);
    if (Number.isNaN(d.getTime())) return false;
    return d.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' }) === hariIni;
  }).length;
}

/** Ambil beberapa pesanan terbaru (untuk halaman ringkas pemilik). */
export async function pesananTerbaru(jumlah = 20): Promise<BarisPesanan[]> {
  const baris = await bacaSemua(true);
  return baris.slice(-jumlah).reverse();
}
