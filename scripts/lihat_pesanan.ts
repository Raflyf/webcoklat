/**
 * Menampilkan isi spreadsheet pesanan, dan menghapus baris uji bila diminta.
 *
 * CARA PAKAI:
 *   npx tsx --env-file=.env scripts/lihat_pesanan.ts           (hanya lihat)
 *   npx tsx --env-file=.env scripts/lihat_pesanan.ts --bersihkan-uji
 *                                                              (hapus baris "Penguji Otomatis")
 */
import { config } from '../src/env.js';
import { klienSheets } from '../src/google.js';

const BERSIHKAN = process.argv.includes('--bersihkan-uji');

async function main(): Promise<void> {
  const sheets = klienSheets();
  const hasil = await sheets.spreadsheets.values.get({
    spreadsheetId: config.sheetId,
    range: `${config.sheetTab}!A1:I`,
  });
  const baris = (hasil.data.values ?? []) as string[][];

  if (baris.length === 0) {
    console.log('Spreadsheet masih kosong.');
    return;
  }

  console.log('=== Isi spreadsheet ===\n');
  console.log(
    ['BARIS', 'KODE', 'PENERIMA', 'PEMBELI', 'STATUS'].map((h) => h.padEnd(14)).join(''),
  );
  console.log('-'.repeat(70));
  baris.forEach((r, i) => {
    const kolom = [String(i + 1), r[0] ?? '', r[3] ?? '', r[2] ?? '', r[8] ?? ''];
    console.log(kolom.map((c) => c.slice(0, 13).padEnd(14)).join(''));
  });

  if (!BERSIHKAN) {
    console.log(`\nTotal ${baris.length} baris (termasuk baris judul).`);
    console.log('Untuk menghapus baris uji: tambahkan  --bersihkan-uji');
    return;
  }

  // Hapus dari BELAKANG supaya nomor baris di atasnya tidak bergeser.
  const untukDihapus: number[] = [];
  baris.forEach((r, i) => {
    if (i === 0) return; // lewati baris judul
    if (String(r[2] ?? '').includes('Penguji Otomatis')) untukDihapus.push(i + 1);
  });

  if (untukDihapus.length === 0) {
    console.log('\nTidak ada baris uji yang perlu dihapus.');
    return;
  }

  console.log(`\nMenghapus ${untukDihapus.length} baris uji...`);
  for (const nomor of untukDihapus.sort((a, b) => b - a)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: config.sheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: { sheetId: 0, dimension: 'ROWS', startIndex: nomor - 1, endIndex: nomor },
            },
          },
        ],
      },
    });
    console.log(`  ✅ baris ${nomor} dihapus`);
  }
  console.log('\nSelesai. Spreadsheet sudah bersih.');
}

main().catch((e) => {
  console.error('Gagal:', e instanceof Error ? e.message : e);
  process.exit(1);
});
