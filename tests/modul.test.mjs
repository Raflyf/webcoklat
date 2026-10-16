/**
 * TEST: semua modul bisa dimuat.
 *
 * KENAPA PERLU:
 *   Kesalahan import (salah nama berkas, salah path, ketergantungan melingkar)
 *   hanya muncul saat modul itu benar-benar dimuat. Endpoint API tidak pernah
 *   dijalankan oleh pengujian lain — jadi tanpa test ini, satu salah ketik pada
 *   import baru ketahuan setelah di-deploy, saat pembeli sudah mencoba mengunggah.
 *
 *   Test ini memuat SEMUA modul, termasuk seluruh endpoint.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Nilai lingkungan harus diset SEBELUM modul dimuat.
process.env.TOKEN_SECRET = 'uji-rahasia-token-yang-panjangnya-lebih-dari-32-karakter';
process.env.ADMIN_PIN = '482913';
process.env.GOOGLE_CLIENT_EMAIL = 'uji@proyek.iam.gserviceaccount.com';
process.env.GOOGLE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nUJI\n-----END PRIVATE KEY-----';
process.env.GOOGLE_DRIVE_FOLDER_ID = 'folder-uji';
process.env.GOOGLE_SHEET_ID = 'sheet-uji';
process.env.SITUS_URL = 'https://cokelatku.com';

const MODUL_INTI = [
  'env',
  'kode',
  'token',
  'admin',
  'drive',
  'sheets',
  'google',
  'validasi',
  'rate_limit',
  'http',
];

const MODUL_ENDPOINT = ['mulai', 'selesai', 'cek', 'video', 'admin', 'info'];

test('semua modul inti bisa dimuat', async () => {
  for (const nama of MODUL_INTI) {
    const modul = await import(`../src/${nama}.ts`);
    assert.ok(modul, `modul src/${nama}.ts gagal dimuat`);
    assert.ok(Object.keys(modul).length > 0, `src/${nama}.ts tidak mengekspor apa pun`);
  }
});

test('semua endpoint bisa dimuat dan mengekspor handler', async () => {
  for (const nama of MODUL_ENDPOINT) {
    const modul = await import(`../api/${nama}.ts`);
    assert.equal(
      typeof modul.default,
      'function',
      `api/${nama}.ts harus mengekspor fungsi handler sebagai default`,
    );
  }
});

test('endpoint info membalas tanpa menyentuh Google', async () => {
  // Endpoint ini sengaja tidak memanggil Google sama sekali, sehingga bisa
  // dipakai memastikan situs hidup walau kredensial Google bermasalah.
  const { default: handler } = await import('../api/info.ts');
  let dikirim = null;
  const resPalsu = {
    setHeader() {},
    status(kode) {
      this._kode = kode;
      return this;
    },
    json(data) {
      dikirim = { kode: this._kode, data };
    },
  };
  await handler({ method: 'GET' }, resPalsu);
  assert.ok(dikirim, 'handler harus mengirim balasan');
  assert.equal(dikirim.kode, 200);
  assert.equal(dikirim.data.ok, true);
  assert.equal(dikirim.data.namaPerusahaan, 'Cokelat Kita');
  assert.equal(dikirim.data.siap, true, 'konfigurasi uji seharusnya lengkap');
});

test('endpoint info menolak metode selain GET', async () => {
  const { default: handler } = await import('../api/info.ts');
  let dikirim = null;
  const resPalsu = {
    status(kode) {
      this._kode = kode;
      return this;
    },
    json(data) {
      dikirim = { kode: this._kode, data };
    },
  };
  await handler({ method: 'POST' }, resPalsu);
  assert.equal(dikirim.kode, 405);
  assert.equal(dikirim.data.ok, false);
});

test('endpoint video menolak permintaan tanpa token', async () => {
  const { default: handler } = await import('../api/video.ts');
  let dikirim = null;
  const resPalsu = {
    status(kode) {
      this._kode = kode;
      return this;
    },
    json(data) {
      dikirim = { kode: this._kode, data };
    },
    setHeader() {},
  };
  await handler({ method: 'GET', query: {}, headers: {} }, resPalsu);
  assert.equal(dikirim.kode, 403, 'tanpa token harus ditolak');
  assert.equal(dikirim.data.ok, false);
});

test('endpoint video menolak token palsu', async () => {
  const { default: handler } = await import('../api/video.ts');
  let dikirim = null;
  const resPalsu = {
    status(kode) {
      this._kode = kode;
      return this;
    },
    json(data) {
      dikirim = { kode: this._kode, data };
    },
    setHeader() {},
  };
  await handler({ method: 'GET', query: { t: 'palsu.palsu' }, headers: {} }, resPalsu);
  assert.equal(dikirim.kode, 403);
});

test('endpoint admin menolak PIN salah tanpa menyentuh Google', async () => {
  const { default: handler } = await import('../api/admin.ts');
  let dikirim = null;
  const resPalsu = {
    status(kode) {
      this._kode = kode;
      return this;
    },
    json(data) {
      dikirim = { kode: this._kode, data };
    },
  };
  await handler(
    { method: 'POST', body: { pin: '000000' }, headers: { 'x-forwarded-for': '9.9.9.9' } },
    resPalsu,
  );
  assert.equal(dikirim.kode, 401, 'PIN salah harus ditolak');
  assert.equal(dikirim.data.ok, false);
});

test('endpoint admin menerima PIN benar dan mengeluarkan token', async () => {
  const { default: handler } = await import('../api/admin.ts');
  let dikirim = null;
  const resPalsu = {
    status(kode) {
      this._kode = kode;
      return this;
    },
    json(data) {
      dikirim = { kode: this._kode, data };
    },
  };
  await handler(
    { method: 'POST', body: { pin: '482913' }, headers: { 'x-forwarded-for': '8.8.8.8' } },
    resPalsu,
  );
  assert.equal(dikirim.kode, 200);
  assert.equal(dikirim.data.ok, true);
  assert.ok(dikirim.data.token, 'harus mengeluarkan token sesi');

  // Token itu harus sah menurut pemeriksa token admin.
  const { periksaTokenAdmin } = await import('../src/admin.ts');
  assert.equal(periksaTokenAdmin(dikirim.data.token), true);
});

test('endpoint cek menolak kode kosong tanpa menyentuh Google', async () => {
  const { default: handler } = await import('../api/cek.ts');
  let dikirim = null;
  const resPalsu = {
    status(kode) {
      this._kode = kode;
      return this;
    },
    json(data) {
      dikirim = { kode: this._kode, data };
    },
  };
  await handler(
    { method: 'POST', body: { kode: '' }, headers: { 'x-forwarded-for': '7.7.7.7' } },
    resPalsu,
  );
  assert.equal(dikirim.data.ok, false);
  assert.match(String(dikirim.data.pesan), /belum lengkap/i);
});

test('endpoint mulai menolak metode GET', async () => {
  const { default: handler } = await import('../api/mulai.ts');
  let dikirim = null;
  const resPalsu = {
    status(kode) {
      this._kode = kode;
      return this;
    },
    json(data) {
      dikirim = { kode: this._kode, data };
    },
  };
  await handler({ method: 'GET', headers: {} }, resPalsu);
  assert.equal(dikirim.kode, 405);
});
