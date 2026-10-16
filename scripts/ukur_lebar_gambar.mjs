/**
 * Mengukur lebar konten dari sebuah tangkapan layar.
 *
 * KENAPA: supaya penilaian "terlalu sempit" tidak berdasarkan perkiraan mata,
 * melainkan angka. Latar halaman berwarna krem (#fdf8f3); konten (kartu putih
 * dan teks) berbeda dari warna itu. Jadi tepi kiri & kanan konten bisa dicari
 * dengan memindai piksel.
 *
 * CARA PAKAI:
 *   node scripts/ukur_lebar_gambar.mjs scratch/ui/pc-index.png
 */
import fs from 'node:fs';
import { PNG } from 'pngjs';

const berkas = process.argv[2];
if (!berkas) {
  console.error('Sertakan berkas gambar.');
  process.exit(1);
}

const png = PNG.sync.read(fs.readFileSync(berkas));
const { width, height, data } = png;

/** Warna latar halaman (--krem) dengan toleransi kecil. */
const LATAR = { r: 0xfd, g: 0xf8, b: 0xf3 };
const TOLERANSI = 10;

function miripLatar(x, y) {
  const i = (width * y + x) << 2;
  return (
    Math.abs(data[i] - LATAR.r) <= TOLERANSI &&
    Math.abs(data[i + 1] - LATAR.g) <= TOLERANSI &&
    Math.abs(data[i + 2] - LATAR.b) <= TOLERANSI
  );
}

// Pindai setiap baris, catat tepi paling kiri & paling kanan yang BUKAN latar.
let kiriMin = width;
let kananMax = -1;
let barisBerisi = 0;

for (let y = 0; y < height; y += 2) {
  let kiriBaris = -1;
  let kananBaris = -1;
  for (let x = 0; x < width; x++) {
    if (!miripLatar(x, y)) {
      if (kiriBaris < 0) kiriBaris = x;
      kananBaris = x;
    }
  }
  if (kiriBaris >= 0) {
    barisBerisi++;
    if (kiriBaris < kiriMin) kiriMin = kiriBaris;
    if (kananBaris > kananMax) kananMax = kananBaris;
  }
}

const lebarKonten = kananMax - kiriMin + 1;
const rasio = ((lebarKonten / width) * 100).toFixed(1);

console.log(`Berkas        : ${berkas}`);
console.log(`Lebar gambar  : ${width} px`);
console.log(`Tepi kiri     : ${kiriMin} px`);
console.log(`Tepi kanan    : ${kananMax} px`);
console.log(`Lebar konten  : ${lebarKonten} px`);
console.log(`Terpakai      : ${rasio}% dari lebar layar`);
console.log(`Ruang samping : ${kiriMin} px kiri, ${width - kananMax - 1} px kanan`);
console.log('');
if (lebarKonten / width < 0.7) {
  console.log('⚠️  Konten memakai kurang dari 70% lebar layar — masih terasa sempit di PC.');
} else if (lebarKonten / width > 0.92) {
  console.log('⚠️  Konten nyaris menyentuh tepi — kurang napas.');
} else {
  console.log('✅ Proporsi konten wajar untuk layar ini.');
}
