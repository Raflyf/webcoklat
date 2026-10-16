/**
 * TEST: kode pesanan, token, validasi, dan pembatas percobaan.
 *
 * Yang diuji di sini adalah bagian yang menentukan KEAMANAN dan KEBENARAN data:
 *   - kode tidak boleh mudah ditebak, tetapi harus mudah diketik penerima
 *   - token tidak boleh bisa dipalsukan atau dipakai setelah kedaluwarsa
 *   - berkas yang bukan video harus ditolak sebelum menyentuh Google Drive
 *   - batas percobaan harus benar-benar menghentikan penebakan kode
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Nilai lingkungan untuk pengujian — HARUS diset sebelum modul dimuat.
process.env.TOKEN_SECRET = 'uji-rahasia-token-yang-panjangnya-lebih-dari-32-karakter';
process.env.GOOGLE_CLIENT_EMAIL = 'uji@contoh.iam.gserviceaccount.com';
process.env.GOOGLE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nUJI\n-----END PRIVATE KEY-----';
process.env.GOOGLE_DRIVE_FOLDER_ID = 'folder-uji';
process.env.GOOGLE_SHEET_ID = 'sheet-uji';
process.env.MAKS_UKURAN_VIDEO_MB = '50';

const { buatKode, rapikanKode, variasiKode, tampilkanKode, kodeUntukUrl } = await import('../src/kode.ts');
const { buatTokenVideo, periksaTokenVideo, buatTokenSesi, periksaTokenSesi } = await import('../src/token.ts');
const { validasiPesanan, bersihkanNama } = await import('../src/validasi.ts');
const { cekBatas, lupakan, ambilIp } = await import('../src/rate_limit.ts');
const { KesalahanRamah } = await import('../src/http.ts');

// ── KODE PESANAN ────────────────────────────────────────────────────────────

test('kode: format benar dan memakai awalan CH', () => {
  for (let i = 0; i < 50; i++) {
    const k = buatKode();
    assert.match(k, /^CH-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/, `format kode salah: ${k}`);
  }
});

test('kode: TIDAK memuat karakter yang mudah tertukar saat dibaca', () => {
  // 0/O dan 1/I/L dibuang karena kode ditulis tangan di kartu.
  for (let i = 0; i < 200; i++) {
    const isi = buatKode().slice(3);
    assert.doesNotMatch(isi, /[01OIL]/, `kode memuat karakter mudah tertukar: ${isi}`);
  }
});

test('kode: tidak berulang (acak sungguhan)', () => {
  const kumpulan = new Set();
  for (let i = 0; i < 500; i++) kumpulan.add(buatKode());
  assert.equal(kumpulan.size, 500, 'ada kode yang terulang — keacakannya bermasalah');
});

test('kode: ketikan penerima dimaafkan (huruf kecil, spasi, tanda hubung hilang)', () => {
  const k = 'CH-7K9P2M4Q';
  for (const ketikan of ['ch-7k9p2m4q', 'CH7K9P2M4Q', ' ch 7k9p2m4q ', 'CH-7K9P-2M4Q', 'ch_7k9p2m4q']) {
    assert.equal(rapikanKode(ketikan), k, `gagal merapikan: "${ketikan}"`);
  }
});

test('kode: variasi salah-baca dibuat untuk pencocokan', () => {
  const variasi = variasiKode('CH-7K9P2M4Q');
  assert.ok(variasi.includes('CH-7K9P2M4Q'), 'kode asli harus ada di daftar variasi');
  // 0<->O dan 1<->I/L adalah salah baca yang paling sering.
  assert.ok(variasiKode('CH-A0B1C2D3').some((v) => v.includes('O')), 'variasi 0->O tidak dibuat');
  assert.ok(variasiKode('CH-A0B1C2D3').some((v) => v.includes('I') || v.includes('L')), 'variasi 1->I/L tidak dibuat');
  // Dibatasi supaya pencarian tidak melebar.
  assert.ok(variasi.length <= 6, `variasi terlalu banyak: ${variasi.length}`);
});

test('kode: tampilan dibagi dua kelompok agar mudah dibaca', () => {
  assert.equal(tampilkanKode('CH-7K9P2M4Q'), 'CH-7K9P-2M4Q');
  assert.equal(kodeUntukUrl('CH-7K9P-2M4Q'), 'CH7K9P2M4Q');
});

// ── TOKEN ───────────────────────────────────────────────────────────────────

test('token video: bisa dibuat dan dibaca kembali', () => {
  const t = buatTokenVideo('file-abc', 'CH-7K9P2M4Q');
  const isi = periksaTokenVideo(t);
  assert.ok(isi, 'token yang sah harus bisa dibaca');
  assert.equal(isi.f, 'file-abc');
  assert.equal(isi.k, 'CH-7K9P2M4Q');
});

test('token video: isi yang diubah membuat token ditolak', () => {
  const t = buatTokenVideo('file-abc', 'CH-7K9P2M4Q');
  const [payload, sig] = t.split('.');
  // Ganti isi token dengan file lain, tanda tangan dibiarkan.
  const payloadPalsu = Buffer.from(JSON.stringify({ f: 'file-ORANG-LAIN', k: 'CH-7K9P2M4Q', e: 9999999999 }))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  assert.equal(periksaTokenVideo(`${payloadPalsu}.${sig}`), null, 'token palsu harus DITOLAK');
  assert.ok(payload, 'payload asli harus ada');
});

test('token video: tanda tangan yang diubah ditolak', () => {
  const t = buatTokenVideo('file-abc', 'CH-7K9P2M4Q');
  const [payload] = t.split('.');
  assert.equal(periksaTokenVideo(`${payload}.tandatangan-palsu`), null);
});

test('token video: token cacat/kosong ditolak tanpa melempar', () => {
  for (const buruk of ['', '.', 'abc', 'abc.', '.abc', 'a.b.c', 'null', 'undefined']) {
    assert.equal(periksaTokenVideo(buruk), null, `token "${buruk}" harus ditolak`);
  }
});

test('token video: token kedaluwarsa ditolak', () => {
  // Buat token dengan masa berlaku yang sudah lewat dengan memalsukan waktu.
  const asli = Date.now;
  Date.now = () => asli() - 1000 * 60 * 60 * 24; // seolah dibuat 24 jam lalu
  const t = buatTokenVideo('file-abc', 'CH-7K9P2M4Q');
  Date.now = asli;
  assert.equal(periksaTokenVideo(t), null, 'token kedaluwarsa harus DITOLAK');
});

test('token sesi: menyimpan data pesanan dan tidak bisa dipalsukan', () => {
  const t = buatTokenSesi({
    folderId: 'folder-1',
    kode: 'CH-7K9P2M4Q',
    namaPembeli: 'Budi',
    namaPenerima: 'Sari',
    judul: 'Selamat ulang tahun',
    pesan: 'Semoga bahagia',
    namaFile: 'Sari - video.mp4',
    ukuranByte: 12345678,
  });
  const isi = periksaTokenSesi(t);
  assert.ok(isi);
  assert.equal(isi.folderId, 'folder-1');
  assert.equal(isi.namaPenerima, 'Sari');
  assert.equal(isi.ukuranByte, 12345678);
  assert.equal(periksaTokenSesi(`${t}x`), null, 'token yang diubah harus ditolak');
});

// ── VALIDASI ────────────────────────────────────────────────────────────────

test('validasi: data lengkap diterima', () => {
  const d = validasiPesanan({
    namaPembeli: 'Budi',
    namaPenerima: 'Sari',
    judul: 'Hai',
    pesan: 'Apa kabar',
    mime: 'video/mp4',
    ukuranByte: 5 * 1024 * 1024,
  });
  assert.equal(d.namaPembeli, 'Budi');
  assert.equal(d.namaPenerima, 'Sari');
  assert.equal(d.namaFile, 'Sari - video.mp4');
});

test('validasi: nama kurang dari 2 huruf ditolak dengan pesan jelas', () => {
  const dasar = { namaPenerima: 'Sari', mime: 'video/mp4', ukuranByte: 1000 };
  assert.throws(() => validasiPesanan({ ...dasar, namaPembeli: '' }), KesalahanRamah);
  assert.throws(() => validasiPesanan({ ...dasar, namaPembeli: 'B' }), /Nama Anda/);
  assert.throws(
    () => validasiPesanan({ namaPembeli: 'Budi', mime: 'video/mp4', ukuranByte: 1000 }),
    /Nama penerima/,
  );
});

test('validasi: berkas yang BUKAN video ditolak', () => {
  const dasar = { namaPembeli: 'Budi', namaPenerima: 'Sari', ukuranByte: 1000 };
  for (const mime of ['application/pdf', 'image/jpeg', 'text/plain', 'application/zip', '']) {
    assert.throws(() => validasiPesanan({ ...dasar, mime }), /bukan video/i, `mime "${mime}" harus ditolak`);
  }
});

test('validasi: video melebihi batas ditolak dan menyebut batasnya', () => {
  assert.throws(
    () =>
      validasiPesanan({
        namaPembeli: 'Budi',
        namaPenerima: 'Sari',
        mime: 'video/mp4',
        ukuranByte: 51 * 1024 * 1024, // batas uji 50 MB
      }),
    /terlalu besar/i,
  );
});

test('validasi: ukuran nol / tidak masuk akal ditolak', () => {
  const dasar = { namaPembeli: 'Budi', namaPenerima: 'Sari', mime: 'video/mp4' };
  assert.throws(() => validasiPesanan({ ...dasar, ukuranByte: 0 }), /tidak terbaca/i);
  assert.throws(() => validasiPesanan({ ...dasar, ukuranByte: -5 }), /tidak terbaca/i);
  assert.throws(() => validasiPesanan({ ...dasar, ukuranByte: 'abc' }), /tidak terbaca/i);
});

test('validasi: nama berbahaya dibersihkan (tidak bisa membuat folder bersarang)', () => {
  assert.equal(bersihkanNama('../../etc/passwd'), '....etcpasswd');
  assert.equal(bersihkanNama('Sari/Rahasia'), 'SariRahasia');
  assert.equal(bersihkanNama('Sari\\Rahasia'), 'SariRahasia');
  assert.equal(bersihkanNama('   '), 'Tanpa Nama');
  assert.equal(bersihkanNama('a'.repeat(200)).length, 60);
});

test('validasi: nama penerima dipakai sebagai nama berkas, aman', () => {
  const d = validasiPesanan({
    namaPembeli: 'Budi',
    namaPenerima: 'Sari/../Hack',
    mime: 'video/mp4',
    ukuranByte: 1000,
  });
  assert.doesNotMatch(d.namaFile, /[/\\]/);
  assert.match(d.namaFile, /\.mp4$/);
});

// ── PEMBATAS PERCOBAAN ──────────────────────────────────────────────────────

test('batas: mengizinkan sampai batas, lalu menolak', () => {
  const kunci = `uji-batas-${Date.now()}`;
  for (let i = 0; i < 5; i++) {
    const h = cekBatas(kunci, 5, 15);
    assert.equal(h.boleh, true, `percobaan ke-${i + 1} seharusnya boleh`);
  }
  const kelebihan = cekBatas(kunci, 5, 15);
  assert.equal(kelebihan.boleh, false, 'percobaan ke-6 seharusnya ditolak');
  assert.ok(kelebihan.tungguDetik > 0, 'harus memberi tahu berapa lama menunggu');
});

test('batas: kunci berbeda tidak saling memengaruhi', () => {
  const a = `uji-a-${Date.now()}`;
  const b = `uji-b-${Date.now()}`;
  cekBatas(a, 1, 15);
  assert.equal(cekBatas(a, 1, 15).boleh, false, 'kunci a seharusnya sudah penuh');
  assert.equal(cekBatas(b, 1, 15).boleh, true, 'kunci b seharusnya masih boleh');
});

test('batas: lupakan() mengosongkan hitungan setelah berhasil', () => {
  const kunci = `uji-lupakan-${Date.now()}`;
  cekBatas(kunci, 2, 15);
  cekBatas(kunci, 2, 15);
  assert.equal(cekBatas(kunci, 2, 15).boleh, false);
  lupakan(kunci);
  assert.equal(cekBatas(kunci, 2, 15).boleh, true, 'setelah dilupakan harus boleh lagi');
});

test('batas: alamat IP dibaca dari header proxy', () => {
  assert.equal(ambilIp({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }), '1.2.3.4');
  assert.equal(ambilIp({ 'x-forwarded-for': ['9.9.9.9'] }), '9.9.9.9');
  assert.equal(ambilIp({ 'x-real-ip': '2.2.2.2' }), '2.2.2.2');
  assert.equal(ambilIp({}), 'tidak-diketahui');
});
