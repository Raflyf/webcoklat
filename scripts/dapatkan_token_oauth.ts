/**
 * MENGAMBIL TOKEN OAuth DARI AKUN GOOGLE PEMILIK (satu kali saja)
 *
 * KENAPA INI PERLU:
 *   Service account tidak punya kuota penyimpanan, jadi video TIDAK BISA
 *   diunggah dengannya (HTTP 403 "Service Accounts do not have storage quota").
 *   Supaya video tersimpan di Drive Anda, sistem harus memakai izin AKUN ANDA.
 *   Caranya: sekali ini saja Anda menyetujui akses, lalu sistem menyimpan
 *   "refresh token" yang bisa dipakai terus-menerus tanpa login lagi.
 *
 * CARA PAKAI:
 *   1. Buat OAuth Client ID di Google Cloud (lihat docs/SETUP_OAUTH.md)
 *   2. Isi GOOGLE_OAUTH_CLIENT_ID dan GOOGLE_OAUTH_CLIENT_SECRET di `.env`
 *   3. Jalankan:  npx tsx scripts/dapatkan_token_oauth.ts
 *   4. Buka tautan yang muncul di terminal, setujui aksesnya
 *   5. Token tersimpan otomatis ke `.env`
 *
 * CATATAN: script ini membuka server kecil di komputer Anda hanya untuk
 * menerima jawaban dari Google, lalu langsung ditutup.
 */
import fs from 'node:fs';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { google } from 'googleapis';

const PORT = 5555;
const ENV_FILE = '.env';
const SCOPE = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
];

/** Baca satu nilai dari `.env`. */
function dariEnv(kunci: string): string {
  if (!fs.existsSync(ENV_FILE)) return '';
  const m = new RegExp(`^${kunci}=(.*)$`, 'm').exec(fs.readFileSync(ENV_FILE, 'utf8'));
  if (!m) return '';
  let v = (m[1] ?? '').trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

/** Set atau ganti satu baris di `.env`. */
function setEnv(kunci: string, nilai: string): void {
  let isi = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';
  const pola = new RegExp(`^${kunci}=.*$`, 'm');
  const baris = `${kunci}=${nilai}`;
  isi = pola.test(isi) ? isi.replace(pola, baris) : `${isi}\n${baris}`;
  fs.writeFileSync(ENV_FILE, isi);
}

async function main(): Promise<void> {
  const clientId = process.argv[2]?.trim() || dariEnv('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = process.argv[3]?.trim() || dariEnv('GOOGLE_OAUTH_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    console.error('❌ GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET belum ada.');
    console.error('   Buat dulu OAuth Client ID di Google Cloud — lihat docs/SETUP_OAUTH.md');
    console.error('   Lalu isi keduanya di berkas .env, atau jalankan:');
    console.error('     npx tsx scripts/dapatkan_token_oauth.ts <CLIENT_ID> <CLIENT_SECRET>');
    process.exit(1);
  }

  const redirectUri = `http://localhost:${PORT}`;
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const urlPersetujuan = oauth2.generateAuthUrl({
    access_type: 'offline', // WAJIB: tanpa ini Google tidak memberi refresh token
    prompt: 'consent', // paksa layar persetujuan agar refresh token selalu keluar
    scope: SCOPE,
  });

  console.log('Menyiapkan penerimaan jawaban dari Google di ' + redirectUri + '\n');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('BUKA TAUTAN INI DI PERAMBAN, LALU KLIK "Izinkan":');
  console.log('');
  console.log(urlPersetujuan);
  console.log('');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('Menunggu persetujuan...\n');

  const kode = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const alamat = new URL(req.url ?? '/', redirectUri);
      const kodeDiterima = alamat.searchParams.get('code');
      const errorDiterima = alamat.searchParams.get('error');

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      if (kodeDiterima) {
        res.end(
          '<h2 style="font-family:sans-serif">✅ Berhasil!</h2>' +
            '<p style="font-family:sans-serif">Akses sudah diberikan. ' +
            'Silakan kembali ke terminal — halaman ini boleh ditutup.</p>',
        );
        server.close();
        resolve(kodeDiterima);
      } else {
        res.end(
          '<h2 style="font-family:sans-serif">❌ Ditolak</h2>' +
            '<p style="font-family:sans-serif">Akses tidak diberikan.</p>',
        );
        server.close();
        reject(new Error(errorDiterima ?? 'Persetujuan ditolak.'));
      }
    });

    server.on('error', (e: NodeJS.ErrnoException) => {
      if (e.code === 'EADDRINUSE') {
        reject(
          new Error(
            `Port ${PORT} sedang dipakai program lain. Tutup program itu, atau ubah PORT di script ini.`,
          ),
        );
      } else {
        reject(e);
      }
    });

    server.listen(PORT, '127.0.0.1', () => {
      const alamat = server.address() as AddressInfo;
      if (alamat.port !== PORT) {
        // Seharusnya tidak terjadi, tapi kalau port bergeser redirect-nya jadi salah.
        reject(new Error(`Port bergeser ke ${alamat.port}. Batalkan dan coba lagi.`));
      }
    });
  });

  console.log('✅ Persetujuan diterima. Menukar dengan token...');
  const { tokens } = await oauth2.getToken(kode);

  if (!tokens.refresh_token) {
    console.error('❌ Google tidak memberikan refresh token.');
    console.error('   Biasanya karena akses ini pernah disetujui sebelumnya.');
    console.error('   Buka https://myaccount.google.com/permissions — hapus akses aplikasi ini,');
    console.error('   lalu jalankan script ini lagi.');
    process.exit(1);
  }

  setEnv('GOOGLE_OAUTH_CLIENT_ID', clientId);
  setEnv('GOOGLE_OAUTH_CLIENT_SECRET', clientSecret);
  setEnv('GOOGLE_OAUTH_REFRESH_TOKEN', tokens.refresh_token);

  console.log('');
  console.log('🎉 SELESAI. Token tersimpan di .env');
  console.log(`   refresh_token: [${tokens.refresh_token.length} karakter — disembunyikan]`);
  console.log('');
  console.log('Langkah berikutnya:');
  console.log('  1. Pastikan folder Drive & spreadsheet dibagikan ke akun Anda (biasanya sudah,');
  console.log('     karena ini akun Anda sendiri).');
  console.log('  2. Jalankan: npx tsx --env-file=.env scripts/periksa_setup.ts');
  console.log('  3. Kirim ulang token ke Vercel: npx tsx scripts/unggah_env_vercel.ts');
  console.log('  4. Deploy ulang: npx vercel --prod');
}

main().catch((e) => {
  console.error('Gagal:', e instanceof Error ? e.message : e);
  process.exit(1);
});
