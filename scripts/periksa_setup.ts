/**
 * SCRIPT PEMERIKSAAN SETUP (satu kali pakai)
 *
 * Memastikan SEMUA yang dibutuhkan sudah benar SEBELUM pembeli mencoba mengunggah:
 *   1. Kredensial service account diterima Google
 *   2. Folder Drive bisa diakses & boleh menulis
 *   3. Spreadsheet bisa diakses & boleh menulis
 *   4. Nama tab spreadsheet benar
 *
 * Kalau ada yang salah, pesannya menyebutkan APA yang harus diperbaiki.
 */
import { config, caraAksesGoogle } from '../src/env.js';
import { klienDrive, klienSheets, jelaskanErrorGoogle } from '../src/google.js';

let gagal = 0;

function ok(teks: string): void {
  console.log(`  ✅ ${teks}`);
}
function tidak(teks: string): void {
  console.log(`  ❌ ${teks}`);
  gagal++;
}

async function main(): Promise<void> {
  console.log('Memeriksa setup...\n');

  // ── 0. Cara akses Google ──
  console.log('0. Cara akses Google');
  const cara = caraAksesGoogle();
  if (cara === 'oauth') {
    ok('memakai OAuth akun pemilik — video bisa disimpan');
  } else if (cara === 'service-account') {
    tidak('memakai service account — video TIDAK AKAN BISA disimpan (kuota 0)');
    console.log('     Perbaikan: jalankan scripts/dapatkan_token_oauth.ts');
    console.log('     Panduan: docs/SETUP_OAUTH.md');
  } else {
    tidak('belum ada kredensial Google sama sekali');
    return;
  }

  // ── 1. Kredensial ──
  console.log('\n1. Kredensial');
  if (cara === 'oauth') {
    console.log(`   Client ID: ${config.googleOauthClientId.slice(0, 30)}...`);
    ok('client ID, secret, dan refresh token terisi');
  } else {
    console.log(`   Akun: ${config.googleClientEmail}`);
    if (!config.googlePrivateKey.includes('BEGIN')) {
      tidak('GOOGLE_PRIVATE_KEY tidak berbentuk kunci yang benar');
      return;
    }
    ok('format kunci terlihat benar');
  }

  // ── 2. Folder Drive ──
  console.log('\n2. Folder Google Drive');
  try {
    const drive = klienDrive();
    const info = await drive.files.get({
      fileId: config.driveFolderId,
      fields: 'id,name,mimeType,capabilities(canAddChildren)',
      supportsAllDrives: true,
    });
    const nama = info.data.name ?? '(tanpa nama)';
    const bolehTulis = info.data.capabilities?.canAddChildren;
    ok(`folder ditemukan: "${nama}"`);
    if (info.data.mimeType !== 'application/vnd.google-apps.folder') {
      tidak('ID yang diberikan BUKAN sebuah folder');
    } else {
      ok('jenisnya folder');
    }
    if (bolehTulis) {
      ok('boleh membuat subfolder (Editor)');
    } else {
      tidak('TIDAK boleh menulis. Bagikan folder itu ke akun di atas sebagai EDITOR.');
    }
  } catch (err) {
    tidak(jelaskanErrorGoogle(err));
  }

  // ── 3. Spreadsheet ──
  console.log('\n3. Google Spreadsheet');
  try {
    const sheets = klienSheets();
    const info = await sheets.spreadsheets.get({
      spreadsheetId: config.sheetId,
      fields: 'properties.title,sheets.properties.title',
    });
    ok(`spreadsheet ditemukan: "${info.data.properties?.title ?? '(tanpa nama)'}"`);

    const daftarTab = (info.data.sheets ?? []).map((s) => s.properties?.title ?? '');
    console.log(`   Tab yang ada: ${daftarTab.map((t) => `"${t}"`).join(', ') || '(kosong)'}`);

    if (daftarTab.includes(config.sheetTab)) {
      ok(`tab "${config.sheetTab}" ada (sesuai GOOGLE_SHEET_TAB)`);
    } else {
      tidak(
        `tab "${config.sheetTab}" TIDAK ada. Isi GOOGLE_SHEET_TAB dengan salah satu dari: ${daftarTab.join(', ')}`,
      );
    }
  } catch (err) {
    tidak(jelaskanErrorGoogle(err));
  }

  // ── 4. Uji tulis ke spreadsheet ──
  console.log('\n4. Uji tulis ke spreadsheet');
  try {
    const sheets = klienSheets();
    // Menulis ke sel jauh di luar data supaya tidak mengganggu isi sungguhan.
    // Kolom maksimal sheet bawaan adalah Z (26 kolom), jadi jangan memakai ZZ.
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.sheetId,
      range: `${config.sheetTab}!Z1`,
      valueInputOption: 'RAW',
      requestBody: { values: [['uji-tulis']] },
    });
    // Bersihkan lagi.
    await sheets.spreadsheets.values.clear({
      spreadsheetId: config.sheetId,
      range: `${config.sheetTab}!Z1`,
    });
    ok('boleh menulis & menghapus di spreadsheet');
  } catch (err) {
    tidak(jelaskanErrorGoogle(err));
  }

  // ── Ringkasan ──
  console.log('');
  if (gagal === 0) {
    console.log('🎉 SEMUA SIAP. Sistem sudah bisa dipakai.');
  } else {
    console.log(`⚠️  Ada ${gagal} masalah yang perlu diperbaiki (lihat ❌ di atas).`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('Gagal memeriksa:', e);
  process.exit(1);
});
