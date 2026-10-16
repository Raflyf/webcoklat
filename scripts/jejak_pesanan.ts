/**
 * Menampilkan waktu pembuatan folder & berkas pesanan, untuk memastikan apakah
 * sebuah pesanan sudah lengkap (folder + video + tercatat) atau berhenti di tengah.
 *
 * CARA PAKAI:
 *   npx tsx --env-file=.env scripts/jejak_pesanan.ts
 */
import { config } from '../src/env.js';
import { klienDrive } from '../src/google.js';
import { klienSheets } from '../src/google.js';

async function main(): Promise<void> {
  const drive = klienDrive();

  const isi = await drive.files.list({
    q: `'${config.driveFolderId}' in parents and trashed = false`,
    fields: 'files(id,name,createdTime,owners(emailAddress))',
    orderBy: 'createdTime desc',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  console.log('=== Jejak pesanan di Drive ===\n');
  for (const f of isi.data.files ?? []) {
    const waktu = f.createdTime ? new Date(f.createdTime) : null;
    const wib = waktu
      ? waktu.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' })
      : '?';
    console.log(`${f.name}`);
    console.log(`   dibuat  : ${wib} WIB`);
    console.log(`   pemilik : ${f.owners?.[0]?.emailAddress ?? '?'}`);

    const anak = await drive.files.list({
      q: `'${f.id}' in parents and trashed = false`,
      fields: 'files(name,size,createdTime)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const a of anak.data.files ?? []) {
      const wa = a.createdTime
        ? new Date(a.createdTime).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', timeStyle: 'short' })
        : '?';
      console.log(`   video   : ${a.name} — ${(Number(a.size ?? 0) / 1024 / 1024).toFixed(2)} MB (${wa} WIB)`);
    }
    if ((anak.data.files ?? []).length === 0) console.log('   video   : (TIDAK ADA — unggahan gagal)');
    console.log('');
  }

  // Bandingkan dengan yang tercatat di spreadsheet.
  const sheets = klienSheets();
  const s = await sheets.spreadsheets.values.get({
    spreadsheetId: config.sheetId,
    range: `${config.sheetTab}!A2:A`,
  });
  const kodeTercatat = (s.data.values ?? []).map((r) => String(r[0] ?? '').trim()).filter(Boolean);

  console.log('=== Tercatat di spreadsheet ===');
  console.log(kodeTercatat.length ? kodeTercatat.join(', ') : '(belum ada pesanan)');
  console.log('');
  console.log('CATATAN: kode pesanan = awalan nama folder (sebelum " - ").');
  console.log('Bila ada folder tanpa kode yang cocok di spreadsheet, artinya');
  console.log('videonya terunggah tetapi pencatatannya gagal.');
}

main().catch((e) => {
  console.error('Gagal:', e instanceof Error ? e.message : e);
  process.exit(1);
});
