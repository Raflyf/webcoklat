/**
 * PEMBATAS PERCOBAAN (RATE LIMIT)
 *
 * DUA hal yang dibatasi:
 *   1. Percobaan memasukkan kode  -> mencegah orang menebak kode orang lain.
 *   2. Pengiriman video           -> mencegah satu orang membanjiri Drive.
 *
 * CATATAN JUJUR SOAL KETAHANAN:
 *   Penyimpanan hitungan ada di MEMORI proses. Di Vercel, satu proses melayani
 *   banyak permintaan (jadi ini tetap berguna), tetapi bila Vercel menyalakan
 *   beberapa proses sekaligus, batasnya berlaku per proses — bukan global.
 *
 *   Untuk bisnis kecil ini sudah memadai karena pertahanan utamanya BUKAN
 *   rate limit, melainkan ENTROPI KODE: 31^8 ≈ 852 miliar kemungkinan. Menebak
 *   satu kode yang benar secara acak praktis mustahil, bahkan tanpa rate limit.
 *
 *   Bila nanti butuh batas yang benar-benar global, ganti penyimpanan di bawah
 *   dengan Redis (mis. Upstash) — antarmukanya sengaja dibuat sederhana agar
 *   mudah ditukar.
 */

interface Catatan {
  hitungan: number;
  resetPada: number;
}

const peta = new Map<string, Catatan>();

/** Bersihkan catatan yang sudah kedaluwarsa supaya memori tidak menumpuk. */
function bersihkan(): void {
  const sekarang = Date.now();
  if (peta.size < 500) return; // cukup kecil, tidak perlu disapu
  for (const [kunci, catatan] of peta) {
    if (catatan.resetPada < sekarang) peta.delete(kunci);
  }
}

export interface HasilBatas {
  boleh: boolean;
  sisa: number;
  /** Detik sampai batas direset (0 bila belum kena batas) */
  tungguDetik: number;
}

/**
 * Periksa & tambah hitungan untuk sebuah kunci.
 *
 * @param kunci   pengenal, mis. `kode:1.2.3.4`
 * @param batas   jumlah maksimal dalam satu jendela
 * @param jendelaMenit panjang jendela dalam menit
 */
export function cekBatas(kunci: string, batas: number, jendelaMenit: number): HasilBatas {
  bersihkan();
  const sekarang = Date.now();
  const jendelaMs = jendelaMenit * 60_000;
  const ada = peta.get(kunci);

  if (!ada || ada.resetPada < sekarang) {
    peta.set(kunci, { hitungan: 1, resetPada: sekarang + jendelaMs });
    return { boleh: true, sisa: batas - 1, tungguDetik: 0 };
  }

  ada.hitungan += 1;
  if (ada.hitungan > batas) {
    return { boleh: false, sisa: 0, tungguDetik: Math.ceil((ada.resetPada - sekarang) / 1000) };
  }
  return { boleh: true, sisa: batas - ada.hitungan, tungguDetik: 0 };
}

/**
 * Hapus hitungan setelah berhasil — supaya penerima yang berkali-kali membuka
 * video dengan kode BENAR tidak ikut terkena batas.
 */
export function lupakan(kunci: string): void {
  peta.delete(kunci);
}

/** Ambil alamat IP pengunjung dari header proxy. */
export function ambilIp(headers: Record<string, string | string[] | undefined>): string {
  const ambil = (nama: string): string => {
    const v = headers[nama];
    const s = Array.isArray(v) ? v[0] : v;
    return String(s || '').split(',')[0]?.trim() ?? '';
  };
  return ambil('x-forwarded-for') || ambil('x-real-ip') || 'tidak-diketahui';
}
