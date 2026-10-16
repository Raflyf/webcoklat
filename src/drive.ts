/**
 * GOOGLE DRIVE — penyimpanan video
 *
 * KENAPA UNGGAHAN TIDAK LEWAT SERVER KITA:
 *   Vercel membatasi ukuran isi permintaan ke serverless function sekitar 4,5 MB.
 *   Video pembeli 20-100 MB, jadi mustahil dikirim lewat server.
 *
 *   Solusinya: server hanya MEMBUAT SESI UNGGAH ke Google, lalu browser pembeli
 *   mengunggah videonya LANGSUNG ke Google. Server kita tidak pernah menyentuh
 *   isi videonya — tidak ada batas ukuran, dan hemat kuota.
 *
 *   URI sesi unggah itu sudah membawa izinnya sendiri, jadi browser tidak perlu
 *   (dan tidak boleh) memegang kredensial service account.
 */
import { config } from './env.js';
import { klienDrive, tokenAkses } from './google.js';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

/** Buat subfolder baru di dalam folder induk, mis. "CH-7K9P2M4Q - Budi". */
export async function buatFolderPesanan(namaFolder: string): Promise<string> {
  const drive = klienDrive();
  const hasil = await drive.files.create({
    requestBody: {
      name: namaFolder,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [config.driveFolderId],
    },
    fields: 'id',
    supportsAllDrives: true,
  });
  const id = hasil.data.id;
  if (!id) throw new Error('Google Drive tidak mengembalikan ID folder.');
  return id;
}

export interface SesiUpload {
  /** URI untuk di-PUT oleh browser pembeli */
  uri: string;
}

/**
 * Buat sesi unggah (resumable) untuk satu file video.
 *
 * Memakai REST langsung, bukan helper googleapis, karena helper itu dirancang
 * untuk mengunggah DARI server. Kita butuh URI sesi agar BROWSER yang mengunggah.
 */
export async function buatSesiUpload(opsi: {
  folderId: string;
  namaFile: string;
  mime: string;
  ukuranByte: number;
}): Promise<SesiUpload> {
  const token = await tokenAkses();
  const url = `${DRIVE_UPLOAD}/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,size,mimeType`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': opsi.mime,
      'X-Upload-Content-Length': String(opsi.ukuranByte),
    },
    body: JSON.stringify({ name: opsi.namaFile, parents: [opsi.folderId] }),
  });

  if (!res.ok) {
    const teks = await res.text().catch(() => '');
    throw new Error(`Gagal membuat sesi unggah (HTTP ${res.status}): ${teks.slice(0, 300)}`);
  }

  const uri = res.headers.get('location');
  if (!uri) throw new Error('Google tidak mengembalikan URI sesi unggah.');
  return { uri };
}

export interface InfoFile {
  id: string;
  nama: string;
  ukuranByte: number;
  mime: string;
  trashed: boolean;
}

/** Ambil keterangan sebuah file. Dipakai untuk memastikan video benar-benar ada. */
export async function infoFile(fileId: string): Promise<InfoFile | null> {
  const drive = klienDrive();
  try {
    const hasil = await drive.files.get({
      fileId,
      fields: 'id,name,size,mimeType,trashed',
      supportsAllDrives: true,
    });
    const d = hasil.data;
    if (!d.id) return null;
    return {
      id: d.id,
      nama: String(d.name ?? ''),
      ukuranByte: Number(d.size ?? 0),
      mime: String(d.mimeType ?? 'video/mp4'),
      trashed: Boolean(d.trashed),
    };
  } catch {
    return null;
  }
}

/**
 * Buat izin baca untuk file video tertentu saja (opsional).
 *
 * TIDAK dipakai oleh alur utama — video ditayangkan lewat server kita agar file
 * tetap privat. Fungsi ini disediakan bila suatu saat ingin memakai pemutar
 * Google Drive langsung. Sengaja HANYA untuk satu file, TIDAK PERNAH untuk folder,
 * supaya video pembeli lain tidak bisa ditelusuri.
 */
export async function izinkanFilePublik(fileId: string): Promise<void> {
  const drive = klienDrive();
  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  });
}

/**
 * Ambil isi video dari Drive sebagai respons HTTP mentah (untuk diteruskan ke
 * pemutar penerima).
 *
 * `range` diteruskan apa adanya supaya Google yang menangani pemotongan data —
 * ini yang membuat video bisa di-geser/di-seek tanpa mengunduh seluruhnya.
 */
export async function ambilIsiVideo(fileId: string, range?: string): Promise<Response> {
  const token = await tokenAkses();
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (range) headers.Range = range;

  return fetch(
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    { headers },
  );
}

/** Hapus file/folder (dipakai untuk membatalkan pesanan yang gagal di tengah jalan). */
export async function hapusFile(fileId: string): Promise<void> {
  const drive = klienDrive();
  await drive.files.delete({ fileId, supportsAllDrives: true });
}

/**
 * Cari file video di dalam sebuah folder.
 *
 * Dipakai sebagai pemeriksaan cadangan: kalau pencatatan ke Sheets gagal padahal
 * video sudah terunggah, kita masih bisa menemukan videonya dan tidak kehilangan
 * kiriman pembeli.
 */
export async function cariFileDiFolder(folderId: string): Promise<InfoFile | null> {
  const drive = klienDrive();
  const hasil = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id,name,size,mimeType,trashed)',
    pageSize: 10,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const f = hasil.data.files?.[0];
  if (!f?.id) return null;
  return {
    id: f.id,
    nama: String(f.name ?? ''),
    ukuranByte: Number(f.size ?? 0),
    mime: String(f.mimeType ?? 'video/mp4'),
    trashed: Boolean(f.trashed),
  };
}
