/**
 * VALIDASI DATA PESANAN
 *
 * Dipisah dari endpoint supaya bisa diuji langsung tanpa server, dan supaya
 * aturan yang sama dipakai di mana pun data ini disentuh.
 *
 * PRINSIP: tolak dengan pesan yang memberi tahu APA yang harus diperbaiki,
 * bukan sekadar "data tidak valid".
 */
import { config } from './env.js';
import { KesalahanRamah } from './http.js';

export interface DataPesanan {
  namaPembeli: string;
  namaPenerima: string;
  judul: string;
  pesan: string;
  namaFile: string;
  mime: string;
  ukuranByte: number;
}

/** Jenis video yang boleh diunggah. Sengaja dibatasi agar tidak ada file aneh masuk. */
const MIME_DIIZINKAN = new Set([
  'video/mp4',
  'video/quicktime', // .mov dari iPhone
  'video/webm',
  'video/x-matroska', // .mkv
  'video/3gpp',
]);

/** Ekstensi yang dipetakan dari jenis file, dipakai menyusun nama file di Drive. */
const EKSTENSI: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-matroska': 'mkv',
  'video/3gpp': '3gp',
};

/**
 * Bersihkan nama untuk dipakai sebagai nama file/folder di Google Drive.
 *
 * Karakter seperti `/`, `\`, `:` bisa membingungkan Drive atau membuat folder
 * bersarang tanpa sengaja. Spasi dirapikan, karakter aneh dibuang.
 */
export function bersihkanNama(nama: string, maks = 60): string {
  const bersih = String(nama || '')
    .replace(/[\\/:*?"<>|]/g, '') // karakter terlarang di nama file
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maks)
    .trim();
  return bersih || 'Tanpa Nama';
}

export function validasiPesanan(masukan: Record<string, unknown>): DataPesanan {
  const namaPembeli = String(masukan.namaPembeli ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const namaPenerima = String(masukan.namaPenerima ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const judul = String(masukan.judul ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const pesan = String(masukan.pesan ?? '').replace(/\r\n/g, '\n').trim().slice(0, 800);

  if (namaPembeli.length < 2) {
    throw new KesalahanRamah('Nama Anda belum diisi (minimal 2 huruf).');
  }
  if (namaPenerima.length < 2) {
    throw new KesalahanRamah('Nama penerima belum diisi (minimal 2 huruf).');
  }

  const mime = String(masukan.mime ?? '').trim().toLowerCase();
  if (!MIME_DIIZINKAN.has(mime)) {
    throw new KesalahanRamah('Berkas yang dipilih bukan video. Pilih video MP4/MOV/WebM ya.');
  }

  const ukuranByte = Number(masukan.ukuranByte ?? 0);
  if (!Number.isFinite(ukuranByte) || ukuranByte <= 0) {
    throw new KesalahanRamah('Ukuran video tidak terbaca. Coba pilih ulang videonya.');
  }
  const maksByte = config.maksUkuranVideoMb * 1024 * 1024;
  if (ukuranByte > maksByte) {
    throw new KesalahanRamah(
      `Video terlalu besar (${Math.round(ukuranByte / 1024 / 1024)} MB). Maksimal ${config.maksUkuranVideoMb} MB.`,
    );
  }

  const ekstensi = EKSTENSI[mime] ?? 'mp4';
  const dasar = bersihkanNama(namaPenerima, 40);
  const namaFile = `${dasar} - video.${ekstensi}`;

  return { namaPembeli, namaPenerima, judul, pesan, namaFile, mime, ukuranByte };
}
