/**
 * Menampilkan isi folder penyimpanan di Google Drive, dan menghapus folder uji.
 *
 * CARA PAKAI:
 *   npx tsx --env-file=.env scripts/lihat_drive.ts                  (hanya lihat)
 *   npx tsx --env-file=.env scripts/lihat_drive.ts --bersihkan-uji  (hapus folder uji)
 */
import { config } from '../src/env.js';
import { klienDrive } from '../src/google.js';

const BERSIHKAN = process.argv.includes('--bersihkan-uji');

interface ItemDrive {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
}

async function main(): Promise<void> {
  const drive = klienDrive();

  const isi = await drive.files.list({
    q: `'${config.driveFolderId}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType,size,createdTime)',
    orderBy: 'createdTime desc',
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const daftar = (isi.data.files ?? []) as ItemDrive[];

  console.log(`=== Isi folder "Video coklat" (${daftar.length} item) ===\n`);
  if (daftar.length === 0) {
    console.log('(kosong)');
  }
  for (const f of daftar) {
    const mb = f.size ? ` — ${(Number(f.size) / 1024 / 1024).toFixed(2)} MB` : '';
    console.log(`  ${f.name}${mb}`);
  }

  if (!BERSIHKAN) {
    console.log('\nUntuk menghapus folder uji: tambahkan  --bersihkan-uji');
    return;
  }

  // Folder uji dibuat oleh script pengujian: namanya memuat "Uji " atau kode uji.
  const untukDihapus = daftar.filter(
    (f) =>
      f.mimeType === 'application/vnd.google-apps.folder' &&
      (/Uji \d+/.test(f.name) || f.name.includes('uji-kuota')),
  );

  if (untukDihapus.length === 0) {
    console.log('\nTidak ada folder uji yang perlu dihapus.');
    return;
  }

  console.log(`\nMenghapus ${untukDihapus.length} folder uji...`);
  for (const f of untukDihapus) {
    // Folder harus dikosongkan dulu — Drive menolak menghapus folder berisi berkas
    // lewat API ini, jadi isinya dihapus satu per satu.
    const anak = await drive.files.list({
      q: `'${f.id}' in parents and trashed = false`,
      fields: 'files(id,name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const a of anak.data.files ?? []) {
      await drive.files.delete({ fileId: a.id ?? '', supportsAllDrives: true });
    }
    await drive.files.delete({ fileId: f.id, supportsAllDrives: true });
    console.log(`  ✅ "${f.name}" dihapus`);
  }
  console.log('\nSelesai. Folder penyimpanan sudah bersih.');
}

main().catch((e) => {
  console.error('Gagal:', e instanceof Error ? e.message : e);
  process.exit(1);
});
