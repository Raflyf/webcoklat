/**
 * Membersihkan folder uji yang dibuat oleh SERVICE ACCOUNT.
 *
 * KENAPA PERLU SCRIPT TERPISAH:
 *   Folder yang dibuat service account DIMILIKI oleh service account itu.
 *   Akun pemilik (OAuth) tidak punya izin menghapusnya, sehingga muncul
 *   "The user does not have sufficient permissions for this file".
 *   Jadi penghapusannya harus memakai kunci service account.
 *
 * CARA PAKAI:
 *   npx tsx --env-file=.env scripts/bersihkan_sisa_service_account.ts
 */
import { google } from 'googleapis';
import { config } from '../src/env.js';

async function main(): Promise<void> {
  if (!config.googleClientEmail || !config.googlePrivateKey) {
    console.log('Kredensial service account tidak ada — tidak ada yang perlu dibersihkan.');
    return;
  }

  const auth = new google.auth.JWT({
    email: config.googleClientEmail,
    key: config.googlePrivateKey,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const drive = google.drive({ version: 'v3', auth });

  const isi = await drive.files.list({
    q: `'${config.driveFolderId}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType,owners(emailAddress))',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const daftar = isi.data.files ?? [];
  console.log(`Memeriksa ${daftar.length} item di folder penyimpanan...\n`);

  let dihapus = 0;
  for (const f of daftar) {
    const pemilik = f.owners?.[0]?.emailAddress ?? '';
    const milikServiceAccount = pemilik.includes('iam.gserviceaccount.com');

    if (!milikServiceAccount) {
      console.log(`  lewati  "${f.name}" (milik: ${pemilik || 'tidak diketahui'})`);
      continue;
    }

    // Hapus isinya dulu — Drive menolak menghapus folder yang masih berisi berkas.
    const anak = await drive.files.list({
      q: `'${f.id}' in parents and trashed = false`,
      fields: 'files(id,name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const a of anak.data.files ?? []) {
      await drive.files.delete({ fileId: a.id ?? '', supportsAllDrives: true });
    }
    await drive.files.delete({ fileId: f.id ?? '', supportsAllDrives: true });
    console.log(`  ✅ dihapus "${f.name}" (milik service account)`);
    dihapus++;
  }

  console.log('');
  console.log(dihapus > 0 ? `${dihapus} folder sisa dibersihkan.` : 'Tidak ada folder milik service account.');
}

main().catch((e) => {
  console.error('Gagal:', e instanceof Error ? e.message : e);
  process.exit(1);
});
