/**
 * Memeriksa isi satu folder pesanan di Drive.
 * Dipakai untuk memastikan folder itu benar-benar berisi video, atau hanya
 * sisa percobaan yang gagal di tengah jalan (folder dibuat, video tidak jadi).
 *
 * CARA PAKAI:
 *   npx tsx --env-file=.env scripts/periksa_folder.ts "<nama folder>"
 */
import { config } from '../src/env.js';
import { klienDrive } from '../src/google.js';

async function main(): Promise<void> {
  const kataKunci = process.argv[2] ?? '';
  const drive = klienDrive();

  const cari = await drive.files.list({
    q: `'${config.driveFolderId}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType,owners(emailAddress))',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const folder = (cari.data.files ?? []).find((f) => f.name?.includes(kataKunci));
  if (!folder?.id) {
    console.log(`Folder yang memuat "${kataKunci}" tidak ditemukan.`);
    return;
  }

  console.log(`Folder : ${folder.name}`);
  console.log(`ID     : ${folder.id}`);
  console.log(`Pemilik: ${folder.owners?.[0]?.emailAddress ?? 'tidak diketahui'}\n`);

  const isi = await drive.files.list({
    q: `'${folder.id}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType,size)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const berkas = isi.data.files ?? [];
  if (berkas.length === 0) {
    console.log('Isi folder: KOSONG');
    console.log('→ Kemungkinan folder dibuat tetapi unggahan videonya gagal.');
    return;
  }

  console.log(`Isi folder (${berkas.length} berkas):`);
  for (const f of berkas) {
    const mb = f.size ? ` — ${(Number(f.size) / 1024 / 1024).toFixed(2)} MB` : '';
    console.log(`  ${f.name} (${f.mimeType})${mb}`);
  }
}

main().catch((e) => {
  console.error('Gagal:', e instanceof Error ? e.message : e);
  process.exit(1);
});
