/**
 * MEMERIKSA APAKAH UNGGAHAN DARI BROWSER BISA DIBACA HASILNYA (CORS)
 *
 * GEJALA YANG SEDANG DIPERIKSA:
 *   Pengguna melihat "Koneksi terputus saat mengunggah", TETAPI videonya
 *   ternyata SUDAH masuk ke Google Drive.
 *
 *   Artinya: unggahannya sebenarnya BERHASIL, tetapi browser tidak diizinkan
 *   MEMBACA balasan Google (diblokir kebijakan lintas-asal / CORS). Karena
 *   browser tidak bisa membaca balasannya, ia menganggapnya gagal.
 *
 * CARA PAKAI:
 *   npx tsx --env-file=.env scripts/uji_cors_unggah.ts
 */
import { config } from '../src/env.js';
import { klienDrive, tokenAkses } from '../src/google.js';
import { buatFolderPesanan } from '../src/drive.js';

const ASAL = 'https://webcoklat.vercel.app';

async function main(): Promise<void> {
  const drive = klienDrive();
  const token = await tokenAkses();

  // Folder sementara untuk pengujian
  const folderId = await buatFolderPesanan('uji-cors-sementara');
  console.log('Folder uji dibuat.\n');

  // Buat sesi unggah, sama seperti yang dilakukan server saat pembeli mengunggah
  const url = `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,size`;
  const buat = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'video/mp4',
      'X-Upload-Content-Length': '1000',
    },
    body: JSON.stringify({ name: 'uji-cors.mp4', parents: [folderId] }),
  });
  const sesiUri = buat.headers.get('location') ?? '';
  console.log(`Sesi unggah dibuat: ${sesiUri ? 'ya' : 'TIDAK'}\n`);

  // ── 1. Preflight (OPTIONS) — inilah yang dijalankan browser lebih dulu ──
  console.log('1. Preflight OPTIONS (dijalankan browser sebelum PUT)');
  const opsi = await fetch(sesiUri, {
    method: 'OPTIONS',
    headers: {
      Origin: ASAL,
      'Access-Control-Request-Method': 'PUT',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
  console.log(`   HTTP ${opsi.status}`);
  console.log(`   access-control-allow-origin : ${opsi.headers.get('access-control-allow-origin') ?? '(TIDAK ADA)'}`);
  console.log(`   access-control-allow-methods: ${opsi.headers.get('access-control-allow-methods') ?? '(TIDAK ADA)'}`);
  console.log(`   access-control-allow-headers: ${opsi.headers.get('access-control-allow-headers') ?? '(TIDAK ADA)'}`);

  // ── 2. PUT dengan Origin, seperti browser ──
  console.log('\n2. Unggahan PUT (dengan header Origin seperti browser)');
  const isi = Buffer.alloc(1000, 7);
  const put = await fetch(sesiUri, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4', Origin: ASAL },
    body: isi,
  });
  console.log(`   HTTP ${put.status}`);
  console.log(`   access-control-allow-origin: ${put.headers.get('access-control-allow-origin') ?? '(TIDAK ADA)'}`);

  let idBerkas = '';
  try {
    const data = (await put.json()) as { id?: string };
    idBerkas = data.id ?? '';
    console.log(`   berkas tersimpan dengan id: ${idBerkas || '(tidak ada)'}`);
  } catch {
    console.log('   (balasan bukan JSON)');
  }

  // ── Kesimpulan ──
  console.log('\n=== KESIMPULAN ===');
  const acaoPreflight = opsi.headers.get('access-control-allow-origin');
  const acaoPut = put.headers.get('access-control-allow-origin');

  if (put.status === 200 && !acaoPut) {
    console.log('❌ PENYEBAB DITEMUKAN.');
    console.log('   Unggahan BERHASIL (Google menerima berkasnya),');
    console.log('   TETAPI balasannya TIDAK memuat header CORS.');
    console.log('   Browser memblokir pembacaan balasan -> menganggapnya gagal.');
    console.log('');
    console.log('   Perbaikan yang tepat: JANGAN bergantung pada balasan browser.');
    console.log('   Setelah unggahan, server yang memeriksa apakah berkas benar-benar ada.');
  } else if (acaoPut) {
    console.log('✅ Balasan unggahan memuat header CORS.');
    console.log('   Penyebab lain perlu ditelusuri (mis. koneksi pengguna terputus).');
  } else {
    console.log(`   Status unggahan: HTTP ${put.status}`);
  }
  console.log(`   Preflight allow-origin: ${acaoPreflight ?? '(tidak ada)'}`);

  // Bersihkan folder uji
  try {
    const anak = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const a of anak.data.files ?? []) {
      await drive.files.delete({ fileId: a.id ?? '', supportsAllDrives: true });
    }
    await drive.files.delete({ fileId: folderId, supportsAllDrives: true });
    console.log('\n(folder uji dihapus)');
  } catch {
    console.log('\n(folder uji gagal dihapus — hapus manual bila perlu)');
  }
}

main().catch((e) => {
  console.error('Gagal:', e instanceof Error ? e.message : e);
  process.exit(1);
});
