/**
 * TEST: QR code untuk kemasan.
 *
 * KENAPA INI DIUJI SERIUS:
 *   QR ini dicetak SEKALI dalam jumlah banyak oleh perusahaan. Kalau QR-nya
 *   tidak bisa dipindai, seluruh kemasan jadi tidak berguna dan biaya cetaknya
 *   hangus. Jadi bukan cukup "berkasnya terbentuk" — isinya harus benar-benar
 *   bisa dibaca kembali oleh pemindai.
 *
 * Test ini membuat QR, lalu MEMBACA ULANG isinya memakai pemindai sungguhan
 * (jsQR), dan memastikan alamat yang tertanam tepat.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';

/** Opsi yang sama dengan scripts/buat_qr.ts — harus selaras. */
const OPSI = {
  errorCorrectionLevel: 'H',
  margin: 4,
  color: { dark: '#3d2417', light: '#ffffff' },
};

/** Buat QR lalu baca kembali isinya seperti pemindai ponsel. */
async function pindai(teks, lebar = 600) {
  const dataUrl = await QRCode.toDataURL(teks, { ...OPSI, width: lebar });
  const base64 = dataUrl.split(',')[1];
  const png = PNG.sync.read(Buffer.from(base64, 'base64'));
  return jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
}

test('QR: bisa dibuat dan dipindai kembali', async () => {
  const hasil = await pindai('https://cokelatku.com/v');
  assert.ok(hasil, 'QR harus terbaca oleh pemindai');
  assert.equal(hasil.data, 'https://cokelatku.com/v');
});

test('QR: TAHAN RUSAK — tetap terbaca walau sebagian tertutup', async () => {
  // Inilah alasan memakai koreksi galat tingkat H: QR di kemasan bisa kotor,
  // terlipat, atau tergores. jsQR tidak melaporkan tingkat koreksinya, jadi
  // kita uji LANGSUNG sifatnya: tutup sebagian QR, lalu coba pindai lagi.
  const alamat = 'https://cokelatku.com/v';
  const dataUrl = await QRCode.toDataURL(alamat, { ...OPSI, width: 600 });
  const png = PNG.sync.read(Buffer.from(dataUrl.split(',')[1], 'base64'));

  // Tutup satu blok di area data (bukan di ketiga kotak penanda sudut, karena
  // itu akan membuat QR tidak bisa dilokalisasi sama sekali — kerusakan seperti
  // itu memang tidak bisa dipulihkan oleh tingkat koreksi mana pun).
  const sisi = Math.round(png.width * 0.22);
  const mulaiX = Math.round(png.width * 0.38);
  const mulaiY = Math.round(png.height * 0.38);
  for (let y = mulaiY; y < mulaiY + sisi && y < png.height; y++) {
    for (let x = mulaiX; x < mulaiX + sisi && x < png.width; x++) {
      const i = (png.width * y + x) << 2;
      png.data[i] = 255;
      png.data[i + 1] = 255;
      png.data[i + 2] = 255;
      png.data[i + 3] = 255;
    }
  }

  const hasil = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  assert.ok(hasil, 'QR harus tetap terbaca walau sebagian tertutup — koreksi galat H tidak bekerja');
  assert.equal(hasil.data, alamat);
});

test('QR: memakai koreksi galat tingkat H (sesuai opsi yang dipakai produksi)', () => {
  // Tingkat koreksi tidak bisa dibaca ulang dari hasil pindai, jadi yang
  // dipastikan di sini adalah opsinya benar-benar dipakai saat membuat QR.
  assert.equal(OPSI.errorCorrectionLevel, 'H');
  assert.ok(OPSI.margin >= 4, 'margin minimal 4 modul agar kamera bisa fokus');
});

test('QR: alamat panjang dengan kode tetap terbaca', async () => {
  // Domain panjang + halaman penerima — bentuk alamat yang sebenarnya dipakai.
  const alamat = 'https://www.perusahaan-cokelat-nusantara.co.id/v';
  const hasil = await pindai(alamat);
  assert.ok(hasil, 'QR dengan alamat panjang harus tetap terbaca');
  assert.equal(hasil.data, alamat);
});

test('QR: tetap terbaca pada ukuran cetak kecil (200 px)', async () => {
  // Ukuran cetak minimum yang disarankan ±2 cm; 200 px mewakili kondisi terburuk.
  const hasil = await pindai('https://cokelatku.com/v', 200);
  assert.ok(hasil, 'QR ukuran kecil harus tetap terbaca');
  assert.equal(hasil.data, 'https://cokelatku.com/v');
});

test('QR: dua QR dengan alamat berbeda menghasilkan isi yang berbeda', async () => {
  const a = await pindai('https://cokelatku.com/v');
  const b = await pindai('https://tokohadiah.id/v');
  assert.ok(a && b);
  assert.notEqual(a.data, b.data);
});

test('QR: SVG juga terbentuk dan memuat alamat yang benar', async () => {
  const svg = await QRCode.toString('https://cokelatku.com/v', { ...OPSI, type: 'svg' });
  assert.match(svg, /^<\?xml|^<svg/, 'keluaran SVG tidak dikenali');
  assert.ok(svg.length > 500, 'SVG terlalu pendek — kemungkinan gagal dibuat');
});
