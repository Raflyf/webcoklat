/**
 * TEST: keamanan halaman admin (PIN).
 *
 * Halaman admin menampilkan QR kemasan. Kalau PIN-nya bocor atau bisa ditebak,
 * orang luar bisa mengambil alih QR dan mengarahkannya ke situs lain — semua
 * kemasan perusahaan akan mengarah ke sana. Karena itu PIN diuji serius.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.TOKEN_SECRET = 'uji-rahasia-token-yang-panjangnya-lebih-dari-32-karakter';
process.env.ADMIN_PIN = '482913';

const { adminAktif, pinBenar, buatTokenAdmin, periksaTokenAdmin, PANJANG_PIN_MINIMAL } = await import('../src/admin.ts');

test('PIN: panjang minimal 6 karakter', () => {
  assert.equal(PANJANG_PIN_MINIMAL, 6);
});

test('PIN: fitur admin aktif karena ADMIN_PIN memenuhi syarat', () => {
  assert.equal(adminAktif(), true);
});

test('PIN: PIN yang benar diterima', () => {
  assert.equal(pinBenar('482913'), true);
});

test('PIN: PIN yang salah ditolak', () => {
  for (const salah of ['482914', '000000', '48291', '4829133', '', 'admin', '482913 ']) {
    assert.equal(pinBenar(salah), false, `PIN "${salah}" seharusnya DITOLAK`);
  }
});

test('PIN: spasi di ujung tidak dimaafkan (PIN harus persis)', () => {
  // Membedakan ini penting: " 482913" bukan PIN yang benar.
  assert.equal(pinBenar(' 482913'), false);
  assert.equal(pinBenar('482913 '), false);
});

test('PIN: kosong tidak pernah dianggap benar', () => {
  assert.equal(pinBenar(''), false);
});

test('token admin: bisa dibuat dan diperiksa', () => {
  const t = buatTokenAdmin();
  assert.equal(periksaTokenAdmin(t), true);
});

test('token admin: token yang diubah ditolak', () => {
  const t = buatTokenAdmin();
  assert.equal(periksaTokenAdmin(t + 'x'), false);
  assert.equal(periksaTokenAdmin('x' + t), false);

  const [payload] = t.split('.');
  assert.equal(periksaTokenAdmin(`${payload}.palsu`), false);
});

test('token admin: bentuk cacat ditolak tanpa melempar', () => {
  for (const buruk of ['', '.', 'abc', 'abc.', '.abc', 'a.b.c', 'null', 'undefined', '{}']) {
    assert.equal(periksaTokenAdmin(buruk), false, `token "${buruk}" harus ditolak`);
  }
});

test('token admin: token kedaluwarsa ditolak', () => {
  const asli = Date.now;
  Date.now = () => asli() - 1000 * 60 * 60 * 24 * 2; // seolah dibuat 2 hari lalu
  const t = buatTokenAdmin();
  Date.now = asli;
  assert.equal(periksaTokenAdmin(t), false, 'token kedaluwarsa harus DITOLAK');
});

test('token admin: TIDAK bisa dipakai sebagai token video (peran dipisah)', async () => {
  // Kalau token admin bisa dipakai untuk membuka video, itu kelemahan besar:
  // staf bisa membuka video siapa pun tanpa kode pesanan.
  const { periksaTokenVideo } = await import('../src/token.ts');
  const tokenAdmin = buatTokenAdmin();
  assert.equal(periksaTokenVideo(tokenAdmin), null, 'token admin tidak boleh lolos sebagai token video');
});

test('token video: TIDAK bisa dipakai sebagai token admin', async () => {
  const { buatTokenVideo } = await import('../src/token.ts');
  const tokenVideo = buatTokenVideo('file-abc', 'CH-7K9P2M4Q');
  assert.equal(periksaTokenAdmin(tokenVideo), false, 'token video tidak boleh lolos sebagai token admin');
});
