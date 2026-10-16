/**
 * MEMULIHKAN PESANAN YANG TIDAK TERCATAT
 *
 * KENAPA PERLU:
 *   Sebelum perbaikan CORS, ada pesanan yang videonya BERHASIL masuk ke Drive
 *   tetapi gagal tercatat di spreadsheet — karena browser melaporkan gagal
 *   padahal berhasil. Akibatnya kode pesanan itu tidak bisa dipakai penerima.
 *
 *   Script ini memindai folder penyimpanan, mencari folder yang videonya ada
 *   tetapi kodenya TIDAK ada di spreadsheet, lalu mencatatnya.
 *
 *   Data pembeli/penerima yang hilang diisi seadanya dari nama folder, karena
 *   data aslinya ikut hilang bersama sesi unggahan yang tidak pernah selesai.
 *
 * CARA PAKAI:
 *   npx tsx --env-file=.env scripts/pulihkan_pesanan.ts           (lihat saja)
 *   npx tsx --env-file=.env scripts/pulihkan_pesanan.ts --jalankan
 */
import { config } from '../src/env.js';
import { klienDrive, klienSheets } from '../src/google.js';
import { catatPesanan, siapkanJudulKolom } from '../src/sheets.js';

const JALANKAN = process.argv.includes('--jalankan');

async function main(): Promise<void> {
  const drive = klienDrive();
  const sheets = klienSheets();

  // Kode yang sudah tercatat
  const sheet = await sheets.spreadsheets.values.get({
    spreadsheetId: config.sheetId,
    range: `${config.sheetTab}!A2:A`,
  });
  const tercatat = new Set(
    (sheet.data.values ?? []).map((r) => String(r[0] ?? '').replace(/[^A-Z0-9]/g, '')),
  );

  // Folder di Drive
  const isi = await drive.files.list({
    q: `'${config.driveFolderId}' in parents and trashed = false`,
    fields: 'files(id,name,createdTime)',
    orderBy: 'createdTime desc',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  console.log('=== Memindai pesanan yang belum tercatat ===\n');
  const yatim: Array<{ kode: string; folderId: string; fileId: string; namaVideo: string; penerima: string }> = [];

  for (const f of isi.data.files ?? []) {
    const nama = String(f.name ?? '');
    const kode = nama.split(' - ')[0]?.trim() ?? '';
    if (!kode.startsWith('CH-')) continue;

    const kodeBersih = kode.replace(/[^A-Z0-9]/g, '');
    if (tercatat.has(kodeBersih)) continue;

    // Cari videonya
    const anak = await drive.files.list({
      q: `'${f.id}' in parents and trashed = false`,
      fields: 'files(id,name,mimeType)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const video = (anak.data.files ?? []).find((a) => String(a.mimeType ?? '').startsWith('video/'));
    if (!video?.id) {
      console.log(`  ${kode} — dilewati (videonya tidak ada)`);
      continue;
    }

    const penerima = nama.includes(' - ') ? nama.split(' - ').slice(1).join(' - ').trim() : '';
    console.log(`  ${kode} — ADA video "${video.name}" (belum tercatat)`);
    yatim.push({
      kode,
      folderId: String(f.id ?? ''),
      fileId: String(video.id),
      namaVideo: String(video.name ?? ''),
      penerima,
    });
  }

  if (yatim.length === 0) {
    console.log('\nTidak ada pesanan yang perlu dipulihkan. Semua sudah tercatat.');
    return;
  }

  console.log(`\n${yatim.length} pesanan perlu dipulihkan.`);

  if (!JALANKAN) {
    console.log('\nIni baru PEMINDAIAN. Untuk benar-benar mencatat, jalankan:');
    console.log('   npx tsx --env-file=.env scripts/pulihkan_pesanan.ts --jalankan');
    return;
  }

  console.log('\nMencatat ke spreadsheet...');
  await siapkanJudulKolom();
  for (const y of yatim) {
    await catatPesanan({
      kode: y.kode,
      dibuat: new Date().toISOString(),
      // Data asli hilang bersama sesi yang tidak selesai — ditandai jelas
      // supaya tidak disangka data sungguhan bila ditelusuri nanti.
      namaPembeli: 'DIPULIHKAN',
      namaPenerima: y.penerima || '(tidak diketahui)',
      judul: '',
      pesan: '',
      folderId: y.folderId,
      fileId: y.fileId,
      status: 'aktif',
    });
    console.log(`  ✅ ${y.kode} dicatat (video: ${y.namaVideo})`);
  }
  console.log('\nSelesai. Kode-kode itu sekarang bisa dipakai penerima.');
}

main().catch((e) => {
  console.error('Gagal:', e instanceof Error ? e.message : e);
  process.exit(1);
});
