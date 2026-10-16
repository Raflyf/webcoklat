/**
 * SCRIPT BANTUAN SETUP (satu kali pakai) — mengisi berkas `.env`.
 *
 * KENAPA DIBUAT SCRIPT, BUKAN DIKETIK MANUAL:
 *   Private key service account sangat panjang dan berisi baris baru. Menyalinnya
 *   manual ke `.env` gampang terpotong atau berubah. Script ini menulisnya persis
 *   seperti aslinya.
 *
 * KEAMANAN: script ini TIDAK PERNAH mencetak isi kunci. Yang ditampilkan hanya
 * panjangnya, sebagai penanda bahwa nilainya benar-benar terisi.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const BERKAS_KREDENSIAL = 'C:/Users/RaflyF/Downloads/kinetic-valor-443707-r1-62ce00ecae31.json';

const kred = JSON.parse(fs.readFileSync(BERKAS_KREDENSIAL, 'utf8')) as {
  client_email: string;
  private_key: string;
};

let isi = fs.existsSync('.env.example') ? fs.readFileSync('.env.example', 'utf8') : '';

/** Set atau ganti satu baris `KUNCI=nilai` di dalam berkas. */
function set(kunci: string, nilai: string): void {
  const pola = new RegExp(`^${kunci}=.*$`, 'm');
  const baris = `${kunci}=${nilai}`;
  isi = pola.test(isi) ? isi.replace(pola, baris) : `${isi}\n${baris}`;
}

set('SITUS_URL', 'https://webcoklat.vercel.app');
set('NAMA_PERUSAHAAN', 'Pesanan Cokelat');
set('GOOGLE_CLIENT_EMAIL', kred.client_email);
// JSON.stringify membungkus dengan tanda kutip dan mempertahankan \n —
// persis bentuk yang diminta berkas .env.
set('GOOGLE_PRIVATE_KEY', JSON.stringify(kred.private_key));
set('GOOGLE_DRIVE_FOLDER_ID', '1G16oqALS5AqOCvGkF4Y_LOsPHi1Gxg2q');
set('GOOGLE_SHEET_ID', '12hb2oIoT8qmgc14QIxEKFmgbvQxqzabyfGpjFjgMXlk');
set('GOOGLE_SHEET_TAB', 'Sheet1');
set('TOKEN_SECRET', crypto.randomBytes(32).toString('hex'));
set('ADMIN_PIN', String(crypto.randomInt(100000, 999999)));

fs.writeFileSync('.env', isi);

console.log('.env selesai ditulis.\n');
console.log('=== ringkasan (nilai rahasia TIDAK ditampilkan) ===');
for (const baris of fs.readFileSync('.env', 'utf8').split('\n')) {
  if (!baris.includes('=') || baris.trim().startsWith('#')) continue;
  const idx = baris.indexOf('=');
  const kunci = baris.slice(0, idx);
  const nilai = baris.slice(idx + 1);
  const rahasia = /PRIVATE_KEY|TOKEN_SECRET|ADMIN_PIN/.test(kunci);
  const tampil = !nilai
    ? '(kosong)'
    : rahasia
      ? `[${nilai.length} karakter — disembunyikan]`
      : nilai.slice(0, 60);
  console.log(`  ${kunci.padEnd(24)}= ${tampil}`);
}

// Simpan PIN ke berkas terpisah supaya mudah dilihat pemilik, tapi TIDAK
// ikut ter-commit (sudah masuk .gitignore lewat pola .env*).
const pin = /^ADMIN_PIN=(.*)$/m.exec(fs.readFileSync('.env', 'utf8'))?.[1] ?? '';
if (pin) {
  fs.writeFileSync('PIN-ADMIN.txt', `PIN halaman admin: ${pin}\n\nBuka: https://webcoklat.vercel.app/admin.html\n\nGANTI PIN INI setelah dipakai, dan hapus berkas ini.\n`);
  console.log(`\nPIN admin disimpan di PIN-ADMIN.txt`);
}
