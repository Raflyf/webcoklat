/**
 * PEMBUAT KODE PESANAN
 *
 * KENAPA KODE, BUKAN LINK LANGSUNG:
 *   Perusahaan memakai SATU QR code yang sama di semua kemasan. QR itu hanya
 *   membuka halaman web. Yang membedakan video penerima adalah KODE ini.
 *
 * KENAPA KODE INI HARUS SULIT DITEBAK:
 *   Siapa pun yang memegang QR bisa mencoba memasukkan kode berulang kali.
 *   Kalau kode mudah ditebak (mis. urut CH-0001, CH-0002), orang bisa membuka
 *   video milik orang lain. Karena itu kode dibuat ACAK secara kriptografis.
 */
import crypto from 'node:crypto';

/**
 * Alfabet kode: TANPA karakter yang mudah tertukar saat dibaca manusia.
 * Dibuang: 0 (nol) vs O, 1 (satu) vs I/L, dan huruf kecil semua.
 * Kode sering ditulis tangan di kartu, jadi salah baca = penerima gagal buka.
 */
const ALFABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // 31 karakter

/** Panjang bagian acak. 8 karakter -> 31^8 ≈ 852 miliar kemungkinan. */
const PANJANG = 8;

/** Awalan kode, biar mudah dikenali sebagai kode Cokelat. */
const AWALAN = 'CH';

/**
 * Buat kode pesanan baru, contoh: `CH-7K9P2M4Q`.
 *
 * Memakai `crypto.randomInt` (bukan `Math.random`) agar tidak bisa diprediksi
 * dari kode-kode sebelumnya.
 */
export function buatKode(): string {
  let isi = '';
  for (let i = 0; i < PANJANG; i++) {
    isi += ALFABET[crypto.randomInt(0, ALFABET.length)];
  }
  return `${AWALAN}-${isi}`;
}

/**
 * Rapikan kode yang diketik penerima sebelum dicocokkan.
 *
 * Penerima sering mengetik dengan spasi, huruf kecil, tanpa tanda hubung,
 * atau salah menyalin huruf yang mirip. Semua itu dimaafkan di sini supaya
 * mereka tidak gagal hanya karena format.
 *
 * Contoh yang diterima:
 *   "ch-7k9p2m4q"  -> CH-7K9P2M4Q
 *   "CH7K9P2M4Q"   -> CH-7K9P2M4Q
 *   " ch 7k9p2m4q" -> CH-7K9P2M4Q
 */
export function rapikanKode(masukan: string): string {
  const bersih = String(masukan || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ''); // buang spasi, tanda hubung, dan simbol lain

  // Buang awalan CH bila ikut diketik
  const tanpaAwalan = bersih.startsWith(AWALAN) ? bersih.slice(AWALAN.length) : bersih;

  // Perbaiki huruf yang sering tertukar saat dibaca dari kartu.
  // Ini hanya untuk KEMUDAHAN penerima: kita coba beberapa variasi saat
  // mencocokkan, bukan mengubah kode yang tersimpan.
  return `${AWALAN}-${tanpaAwalan}`;
}

/**
 * Buat variasi kode untuk dicoba saat pencocokan, menoleransi salah baca
 * karakter yang mirip: 0<->O, 1<->I<->L, 5<->S, 8<->B, 2<->Z.
 *
 * Mengembalikan maksimal `batas` variasi (termasuk kode aslinya di depan)
 * supaya pencarian di Sheets tidak melebar tak terkendali.
 */
export function variasiKode(kodeBersih: string, batas = 6): string[] {
  const isi = kodeBersih.replace(`${AWALAN}-`, '');
  const peta: Record<string, string[]> = {
    '0': ['O'], O: ['0'],
    '1': ['I', 'L'], I: ['1', 'L'], L: ['1', 'I'],
    '5': ['S'], S: ['5'],
    '8': ['B'], B: ['8'],
    '2': ['Z'], Z: ['2'],
  };

  const hasil = new Set<string>([`${AWALAN}-${isi}`]);
  for (let i = 0; i < isi.length && hasil.size < batas; i++) {
    const pengganti = peta[isi[i] as string];
    if (!pengganti) continue;
    for (const g of pengganti) {
      if (hasil.size >= batas) break;
      hasil.add(`${AWALAN}-${isi.slice(0, i)}${g}${isi.slice(i + 1)}`);
    }
  }
  return [...hasil];
}

/** Format tampilan kode agar mudah dibaca manusia: CH-7K9P-2M4Q */
export function tampilkanKode(kode: string): string {
  const isi = kode.replace(`${AWALAN}-`, '');
  if (isi.length < 8) return kode;
  return `${AWALAN}-${isi.slice(0, 4)}-${isi.slice(4)}`;
}

/** Buang tanda hubung agar kode aman dipakai sebagai bagian URL bila perlu. */
export function kodeUntukUrl(kode: string): string {
  return kode.replace(/[^A-Z0-9]/g, '');
}
