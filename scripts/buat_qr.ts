/**
 * PEMBUAT QR CODE UNTUK KEMASAN
 *
 * KENAPA SCRIPT, BUKAN HALAMAN DI WEBSITE:
 *   Perusahaan mencetak QR ini SEKALI dalam jumlah banyak. Jadi QR-nya tidak
 *   perlu tampil di website — cukup dihasilkan sebagai berkas gambar, lalu
 *   dikirim ke perusahaan untuk dicetak. Website cukup melayani halaman
 *   penerima yang dibuka setelah QR dipindai.
 *
 * CARA PAKAI:
 *   npx tsx scripts/buat_qr.ts
 *   npx tsx scripts/buat_qr.ts https://domain-anda.com     (tentukan alamat sendiri)
 *
 * HASIL:
 *   qr-kemasan.png  — siap dicetak / dikirim lewat WhatsApp
 *   qr-kemasan.svg  — versi vektor, tajam di ukuran berapa pun (untuk percetakan)
 *
 * PENTING: jalankan ulang script ini SETELAH website punya domain tetap.
 * QR yang dibuat dari alamat `localhost` TIDAK bisa dipakai di kemasan.
 */
import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import { config } from '../src/env.js';

/** Alamat yang ditanam di dalam QR: halaman penerima, bukan halaman depan. */
function alamatTujuan(situsUrl: string): string {
  return `${situsUrl.replace(/\/+$/, '')}/v`;
}

async function main(): Promise<void> {
  const dariArgumen = process.argv[2]?.trim();
  const situsUrl = dariArgumen || config.situsUrl;
  const tujuan = alamatTujuan(situsUrl);

  console.log('Membuat QR code untuk kemasan...\n');
  console.log(`  Alamat di dalam QR : ${tujuan}`);

  if (/localhost|127\.0\.0\.1/i.test(tujuan)) {
    console.log('');
    console.log('  ⚠️  PERHATIAN: alamatnya masih localhost.');
    console.log('     QR ini TIDAK akan bisa dibuka dari ponsel orang lain.');
    console.log('     Jalankan ulang setelah website punya domain, contoh:');
    console.log('       npx tsx scripts/buat_qr.ts https://domain-anda.com');
  }

  const opsi = {
    errorCorrectionLevel: 'H' as const, // tahan kotor/terlipat di kemasan
    margin: 4, // ruang putih di sekeliling — WAJIB agar kamera bisa fokus
    color: {
      dark: '#3d2417', // cokelat tua, senada tema
      light: '#ffffff',
    },
  };

  const keluar = process.cwd();
  const berkasPng = path.join(keluar, 'qr-kemasan.png');
  const berkasSvg = path.join(keluar, 'qr-kemasan.svg');

  // PNG resolusi tinggi: 2000 px supaya tetap tajam saat dicetak besar.
  await QRCode.toFile(berkasPng, tujuan, { ...opsi, type: 'png', width: 2000 });
  // SVG vektor: untuk percetakan profesional yang butuh skala bebas.
  await QRCode.toFile(berkasSvg, tujuan, { ...opsi, type: 'svg' });

  console.log(`  ✅ ${path.basename(berkasPng)}  (2000×2000 px — untuk dicetak)`);
  console.log(`  ✅ ${path.basename(berkasSvg)}  (vektor — untuk percetakan)`);

  // Ukuran berkas dipakai sebagai pemeriksaan cepat bahwa berkasnya benar-benar jadi.
  for (const f of [berkasPng, berkasSvg]) {
    const ukuran = fs.statSync(f).size;
    console.log(`     ${path.basename(f)}: ${(ukuran / 1024).toFixed(1)} KB`);
  }

  console.log('\nTips mencetak:');
  console.log('  • Ukuran minimal 2×2 cm, disarankan 3×3 cm.');
  console.log('  • Jangan memotong ruang putih di sekeliling QR.');
  console.log('  • Cetak gelap di atas latar terang (jangan dibalik).');
  console.log('  • Uji pindai dengan 2-3 ponsel berbeda sebelum cetak banyak.');
  console.log('\nKirim kedua berkas itu ke perusahaan untuk dicetak.');
}

main().catch((e) => {
  console.error('Gagal membuat QR:', e);
  process.exit(1);
});
