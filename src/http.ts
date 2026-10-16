/**
 * PEMBANTU HTTP UNTUK ENDPOINT API
 *
 * Dikumpulkan di satu tempat supaya semua endpoint membalas dengan bentuk yang
 * SAMA: `{ ok: true, ... }` atau `{ ok: false, pesan: "..." }`. Dengan begitu
 * sisi tampilan (JavaScript di browser) cukup punya satu cara menangani error.
 *
 * ATURAN PENTING: pesan error yang dikirim ke browser HARUS ramah pengguna.
 * Detail teknis (nama variabel, jejak tumpukan) hanya dicatat di log server,
 * tidak pernah ditampilkan — detail teknis membingungkan pembeli dan bisa
 * membocorkan struktur sistem.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Batas ukuran isi permintaan untuk endpoint JSON (bukan video). */
const BATAS_BODY_BYTE = 64 * 1024; // 64 KB — cukup untuk teks formulir

export class KesalahanRamah extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/** Baca isi permintaan sebagai JSON dengan batas ukuran. */
export function bacaJson<T = Record<string, unknown>>(req: VercelRequest): T {
  const raw = (req as unknown as { body?: unknown }).body;
  if (raw === undefined || raw === null || raw === '') {
    throw new KesalahanRamah('Permintaan tidak berisi data.');
  }

  let isi: unknown = raw;
  if (typeof raw === 'string') {
    if (Buffer.byteLength(raw, 'utf8') > BATAS_BODY_BYTE) {
      throw new KesalahanRamah('Data yang dikirim terlalu besar.', 413);
    }
    try {
      isi = JSON.parse(raw);
    } catch {
      throw new KesalahanRamah('Format data tidak dikenali.');
    }
  }

  if (typeof isi !== 'object' || isi === null || Array.isArray(isi)) {
    throw new KesalahanRamah('Format data tidak dikenali.');
  }
  return isi as T;
}

/** Kirim balasan sukses. */
export function kirimOk(res: VercelResponse, data: Record<string, unknown> = {}): void {
  res.status(200).json({ ok: true, ...data });
}

/** Kirim balasan gagal dengan pesan ramah pengguna. */
export function kirimGagal(res: VercelResponse, pesan: string, status = 400): void {
  res.status(status).json({ ok: false, pesan });
}

/**
 * Bungkus handler: menangani error yang tidak terduga dan memastikan setiap
 * kegagalan tercatat di log server, sementara browser hanya menerima pesan ramah.
 */
export function denganPenangananError(
  nama: string,
  handler: (req: VercelRequest, res: VercelResponse) => Promise<void>,
): (req: VercelRequest, res: VercelResponse) => Promise<void> {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      if (err instanceof KesalahanRamah) {
        kirimGagal(res, err.message, err.status);
        return;
      }
      console.error(`[${nama}] error tak terduga:`, err);
      kirimGagal(res, 'Terjadi gangguan di server. Coba lagi sebentar lagi.', 500);
    }
  };
}

/** Tolak bila bukan metode yang diharapkan. */
export function wajibMetode(req: VercelRequest, metode: 'GET' | 'POST'): void {
  if (req.method !== metode) {
    throw new KesalahanRamah('Metode permintaan tidak didukung.', 405);
  }
}

/**
 * Ambil teks dari data kiriman, rapikan, dan batasi panjangnya.
 * Mengembalikan string kosong bila tidak ada — pemanggil yang memutuskan
 * apakah kolom itu wajib atau tidak.
 */
export function ambilTeks(nilai: unknown, maks: number): string {
  return String(nilai ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maks);
}
