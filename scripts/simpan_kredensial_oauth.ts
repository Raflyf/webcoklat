/**
 * Menyimpan kredensial OAuth dari berkas JSON yang diunduh dari Google Cloud.
 *
 * Hanya menulis dua nilai ke `.env` — TIDAK PERNAH mencetak isi rahasianya.
 */
import fs from 'node:fs';

const BERKAS = process.argv[2] ?? 'C:/Users/RaflyF/Downloads/client_secret_106796668571-7mpnti2palk19ood7khjm4nd4vmdoga7.apps.googleusercontent.com.json';

const mentah = JSON.parse(fs.readFileSync(BERKAS, 'utf8')) as {
  installed?: { client_id: string; client_secret: string; redirect_uris?: string[] };
  web?: { client_id: string; client_secret: string; redirect_uris?: string[] };
};
const k = mentah.installed ?? mentah.web;
if (!k) {
  console.error('❌ Berkas tidak memuat bagian "installed" atau "web".');
  process.exit(1);
}

let isi = fs.readFileSync('.env', 'utf8');
const set = (kunci: string, nilai: string): void => {
  const pola = new RegExp(`^${kunci}=.*$`, 'm');
  isi = pola.test(isi) ? isi.replace(pola, `${kunci}=${nilai}`) : `${isi}\n${kunci}=${nilai}`;
};

set('GOOGLE_OAUTH_CLIENT_ID', k.client_id);
set('GOOGLE_OAUTH_CLIENT_SECRET', k.client_secret);
fs.writeFileSync('.env', isi);

console.log('✅ Kredensial OAuth disimpan ke .env');
console.log(`   client_id     : ${k.client_id.slice(0, 40)}...`);
console.log(`   client_secret : [${k.client_secret.length} karakter — disembunyikan]`);
console.log(`   redirect_uris : ${JSON.stringify(k.redirect_uris ?? [])}`);
