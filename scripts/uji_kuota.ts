/**
 * UJI: apakah service account boleh menyimpan berkas?
 *
 * KENAPA DIUJI TERPISAH:
 *   Service account bisa MEMBUAT FOLDER di Drive mana pun yang dibagikan
 *   kepadanya, tetapi berkas yang ia unggah dihitung terhadap kuota
 *   penyimpanannya SENDIRI — dan kuota itu 0. Jadi folder berhasil dibuat,
 *   lalu unggahan videonya gagal dengan HTTP 403.
 *
 *   Uji ini memisahkan kedua hal itu supaya penyebabnya jelas.
 */
import { klienDrive } from '../src/google.js';
import { config } from '../src/env.js';

async function main(): Promise<void> {
  const drive = klienDrive();

  console.log('1. Membuat folder...');
  let folderId = '';
  try {
    const f = await drive.files.create({
      requestBody: {
        name: 'uji-kuota-folder',
        mimeType: 'application/vnd.google-apps.folder',
        parents: [config.driveFolderId],
      },
      fields: 'id',
      supportsAllDrives: true,
    });
    folderId = f.data.id ?? '';
    console.log(`   ✅ berhasil (id: ${folderId})`);
  } catch (err) {
    console.log('   ❌ gagal:', String((err as Error).message).slice(0, 200));
    return;
  }

  console.log('\n2. Mengunggah berkas kecil ke folder itu...');
  let bolehSimpan = false;
  try {
    const r = await drive.files.create({
      requestBody: { name: 'uji.txt', parents: [folderId] },
      media: { mimeType: 'text/plain', body: 'uji kuota' },
      fields: 'id,name,owners(emailAddress)',
      supportsAllDrives: true,
    });
    bolehSimpan = true;
    console.log('   ✅ BERHASIL menyimpan berkas');
    console.log(`   pemilik berkas: ${JSON.stringify(r.data.owners)}`);
    await drive.files.delete({ fileId: r.data.id ?? '', supportsAllDrives: true });
  } catch (err) {
    const pesan = String(
      (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        (err as Error).message,
    );
    console.log('   ❌ GAGAL menyimpan berkas');
    console.log(`   pesan Google: ${pesan.slice(0, 260)}`);
  }

  // Bersihkan folder uji
  try {
    await drive.files.delete({ fileId: folderId, supportsAllDrives: true });
    console.log('\n   (folder uji dihapus)');
  } catch {
    console.log('\n   (folder uji gagal dihapus — hapus manual bila perlu)');
  }

  console.log('');
  if (bolehSimpan) {
    console.log('✅ KESIMPULAN: service account BOLEH menyimpan. Setup aman.');
  } else {
    console.log('❌ KESIMPULAN: service account TIDAK BOLEH menyimpan berkas.');
    console.log('   Penyebab: akun service account tidak punya kuota penyimpanan.');
    console.log('   Perbaikan: pakai OAuth akun Google pemilik (lihat docs/SETUP_OAUTH.md).');
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
