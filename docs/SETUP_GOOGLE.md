# Panduan Setup Google (sekali saja, ± 10 menit)

Panduan ini menghubungkan website ke Google Drive dan Google Sheets milik Anda.

> **Penting:** semua langkah di bawah memakai **akun Google Anda**. Nanti kalau
> website ini diserahkan ke perusahaan, cukup ulangi langkah 3–5 dengan akun
> Google perusahaan, lalu ganti 3 nilai di `.env`. Tidak ada kode yang perlu diubah.

---

## Istilah singkat

| Istilah | Artinya |
|---|---|
| **Service account** | "Akun robot" yang dipakai website untuk mengakses Drive/Sheets. Ia punya alamat email sendiri, tapi tidak bisa login seperti manusia. |
| **Client email** | Alamat email service account, bentuknya `nama@proyek.iam.gserviceaccount.com`. Ini yang nanti dibagikan ke folder Drive. |
| **Private key** | Kunci rahasia service account. Ini seperti kata sandi — jangan sampai bocor. |

---

## Langkah 1 — Buat project di Google Cloud

1. Buka <https://console.cloud.google.com/>
2. Login dengan akun Google Anda
3. Di bagian atas, klik pemilih project → **New Project**
4. Nama project: `webcoklat` (bebas)
5. Klik **Create**, tunggu sampai selesai, lalu **pilih project itu**

---

## Langkah 2 — Aktifkan dua API

Masih di Google Cloud Console:

1. Buka menu ☰ → **APIs & Services** → **Library**
2. Cari **Google Drive API** → klik → **Enable**
3. Kembali ke Library, cari **Google Sheets API** → klik → **Enable**

> Kalau langkah ini dilewati, nanti muncul pesan
> *"Google Drive API has not been used in project ... or it is disabled"*.

---

## Langkah 3 — Buat service account

1. Buka menu ☰ → **APIs & Services** → **Credentials**
2. Klik **+ Create Credentials** → **Service account**
3. **Service account name**: `webcoklat-bot` (bebas)
4. Klik **Create and Continue**
5. Bagian *Grant this service account access to project* → **lewati saja** (klik Continue)
6. Bagian *Grant users access* → **lewati saja**
7. Klik **Done**

### Buat kuncinya

1. Di halaman **Credentials**, cari service account yang baru dibuat → klik namanya
2. Buka tab **Keys** → **Add Key** → **Create new key**
3. Pilih **JSON** → **Create**
4. Sebuah berkas `.json` akan terunduh otomatis. **Simpan berkas itu baik-baik.**

### Ambil dua nilai dari berkas JSON itu

Buka berkas JSON tadi dengan Notepad. Isinya seperti ini:

```json
{
  "type": "service_account",
  "project_id": "webcoklat",
  "private_key_id": "abc123...",
  "private_key": "<teks sangat panjang, satu blok utuh>",
  "client_email": "webcoklat-bot@webcoklat.iam.gserviceaccount.com",
  ...
}
```

Nilai `private_key` itu panjang (belasan baris) dan berisi kode acak — salin
**seluruhnya apa adanya**, jangan dipotong.

Catat dua baris ini — nanti dipakai di Langkah 6:

- `client_email` → untuk `GOOGLE_CLIENT_EMAIL`
- `private_key` → untuk `GOOGLE_PRIVATE_KEY` (**salin seluruhnya, termasuk baris `BEGIN` dan `END`**)

---

## Langkah 4 — Siapkan folder Google Drive

1. Buka <https://drive.google.com/>
2. Buat folder baru, beri nama misalnya **`Video Cokelat`**
3. Buka folder itu → klik **Share** (Bagikan)
4. Tempel **`client_email`** dari Langkah 3 ke kolom orang
5. Ubah izinnya menjadi **Editor**
6. **Hapus centang** "Notify people" (service account tidak bisa membaca email)
7. Klik **Share** / **Send**

### Ambil ID folder

Buka folder itu di peramban. Alamatnya seperti:

```
https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz
                                        └──────── ini ID folder ────────┘
```

Nilai setelah `/folders/` itulah `GOOGLE_DRIVE_FOLDER_ID`.

> **Jangan** menjadikan folder ini "siapa saja yang punya tautan". Biarkan privat —
> website yang akan mengurus aksesnya.

---

## Langkah 5 — Siapkan Google Sheets

1. Buka <https://sheets.google.com/> → buat spreadsheet baru
2. Beri nama misalnya **`Pesanan Cokelat`**
3. Klik **Share** → tempel **`client_email`** → ubah jadi **Editor** → **Send**

### Ambil ID spreadsheet

Alamat spreadsheet seperti:

```
https://docs.google.com/spreadsheets/d/1XyZ123AbC456DeF789GhI/edit
                                       └────────── ini ID sheet ──────────┘
```

Nilai di antara `/d/` dan `/edit` itulah `GOOGLE_SHEET_ID`.

> **Judul kolom tidak perlu dibuat manual.** Saat pesanan pertama masuk, website
> akan menuliskan baris judulnya sendiri.

---

## Langkah 6 — Isi berkas `.env`

Di folder proyek, salin `.env.example` menjadi `.env`:

```bash
cp .env.example .env
```

Lalu isi bagian Google:

```env
GOOGLE_CLIENT_EMAIL=webcoklat-bot@webcoklat.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADAN...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_FOLDER_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz
GOOGLE_SHEET_ID=1XyZ123AbC456DeF789GhI
GOOGLE_SHEET_TAB=Sheet1
```

Juga isi `TOKEN_SECRET` dengan kunci acak:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Dan `ADMIN_PIN` untuk halaman cetak QR:

```bash
node -e "console.log(require('crypto').randomInt(100000,999999))"
```

> `ADMIN_PIN` minimal 6 karakter. Kalau dikosongkan, halaman `/admin.html`
> otomatis **mati total** — tidak bisa dibuka siapa pun, termasuk Anda.

### Soal `GOOGLE_PRIVATE_KEY`

Nilai ini panjang dan berisi baris baru. Ada dua cara mengisinya dengan aman:

**Cara A — satu baris dengan `\n` (paling mudah untuk Vercel):**
Salin apa adanya dari JSON, biarkan `\n` sebagai teks. Kode akan mengubahnya
menjadi baris baru sungguhan secara otomatis.

**Cara B — tempel apa adanya dengan tanda kutip:**
Bungkus dengan tanda kutip ganda seperti contoh di atas.

> **Jangan** menaruh berkas JSON service account di dalam folder proyek.
> Simpan di luar folder, dan pastikan `.gitignore` sudah menutupinya.

---

## Langkah 7 — Uji

```bash
npm install
npx vercel dev
```

Buka <http://localhost:3000/kirim.html>, isi formulir, unggah video kecil.

Bila berhasil:
- Video muncul di folder Drive Anda (di dalam subfolder baru)
- Ada baris baru di spreadsheet
- Muncul kode di halaman

Bila gagal, pesan di halaman akan menyebutkan penyebabnya. Beberapa yang umum:

| Pesan | Artinya |
|---|---|
| "Service account tidak punya izin" | Folder Drive atau spreadsheet belum dibagikan ke `client_email` |
| "Google Drive/Sheets API belum diaktifkan" | Langkah 2 terlewat |
| "Kredensial Google ditolak" | `GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY` salah salin |
| "Folder atau file tidak ditemukan" | ID folder/sheet salah, atau ada spasi berlebih |

---

## Langkah 8 — Pindah ke Vercel

1. Unggah project ini ke GitHub (**pastikan `.env` tidak ikut ter-commit**)
2. Buka <https://vercel.com/new> → import repositori tersebut
3. Di bagian **Environment Variables**, tempel SEMUA isi `.env` satu per satu
   - Untuk `GOOGLE_PRIVATE_KEY`, tempel dengan `\n` (Cara A) — ini yang paling aman di Vercel
4. Klik **Deploy**
5. Setelah selesai, buka **Settings** → **Domains** → tambahkan domain Anda
6. Perbarui `SITUS_URL` di Environment Variables agar sesuai domain, lalu **Redeploy**

---

## Mengganti ke akun Google perusahaan nanti

Cukup tiga langkah, tanpa menyentuh kode:

1. Buat service account baru di project Google Cloud **milik perusahaan** (Langkah 1–3)
2. Bagikan folder Drive dan spreadsheet **milik perusahaan** ke `client_email` yang baru (Langkah 4–5)
3. Ganti tiga nilai di Environment Variables Vercel: `GOOGLE_CLIENT_EMAIL`,
   `GOOGLE_PRIVATE_KEY`, `GOOGLE_DRIVE_FOLDER_ID`, dan `GOOGLE_SHEET_ID`

Video lama tetap ada di Drive akun lama — pindahkan manual bila perlu.

---

## Catatan kuota

Akun Google gratis punya batas pemakaian harian. Untuk skala bisnis cokelat
(beberapa ratus pesanan per hari), batas gratis ini jauh lebih dari cukup.
Yang perlu diperhatikan:

- **Sheets API**: 60 permintaan per menit. Sudah diredam dengan cache 60 detik
  di `src/sheets.ts`.
- **Drive API**: kuota harian besar; batasnya baru terasa di puluhan ribu berkas.
