# webcoklat

Sistem kirim video personal untuk hadiah cokelat: **satu QR code untuk semua kemasan**, dan setiap penerima hanya bisa membuka videonya sendiri lewat kode unik.

---

## Masalah yang diselesaikan

Sebuah perusahaan cokelat ingin pembeli bisa menyertakan **video pesan** untuk penerima.

Kendalanya:

- Penerima harus bisa membuka **videonya sendiri**, bukan video orang lain.
- Perusahaan ingin **satu QR code yang sama** dicetak di semua kemasan — bukan QR berbeda per pesanan.
- QR code tidak bisa tahu siapa pemiliknya. Kalau QR mengarah langsung ke folder penyimpanan, semua orang bisa melihat video siapa pun.

**Solusinya:** QR hanya membuka halaman web. Yang membedakan video tiap penerima adalah **kode pesanan** yang ditulis di kartu di dalam kemasan.

```
Pembeli                          Penerima
   │                                │
   ├─ isi formulir                  ├─ pindai QR (sama untuk semua kemasan)
   ├─ unggah video                  ├─ masukkan kode dari kartu
   │     ↓                          │     ↓
   │  Google Drive                  │  sistem cocokkan kode
   │  (folder per pesanan)          │     ↓
   │     ↓                          └─ videonya terbuka
   └─ dapat kode (CH-7K9P-2M4Q)
```

---

## Cara kerja

| Langkah | Yang terjadi |
|---|---|
| 1 | Pembeli membuka `/kirim.html`, mengisi nama & mengunggah video |
| 2 | Server membuat folder khusus di Google Drive, browser mengunggah video **langsung ke Google** |
| 3 | Server memeriksa ulang videonya benar-benar ada, lalu mencatat pesanan ke Google Sheets |
| 4 | Pembeli menerima **kode pesanan** untuk ditulis di kartu |
| 5 | Penerima memindai QR → memasukkan kode → videonya terbuka |

---

## Halaman

| Alamat | Untuk | Keterangan |
|---|---|---|
| `/` | Umum | Halaman penjelasan |
| `/kirim.html` | Pembeli | Formulir unggah video |
| `/v.html` | Penerima | **Inilah yang dibuka oleh QR** — tempat memasukkan kode |
| `/admin.html` | Perusahaan | Cetak QR, dilindungi PIN |

---

## Kenapa dirancang seperti ini

Beberapa keputusan penting dan alasannya — supaya tidak perlu menebak lagi saat nanti diubah.

### Video tidak diunggah lewat server kita

Vercel membatasi isi permintaan ke fungsi serverless sekitar **4,5 MB**, sedangkan video pembeli 20-100 MB. Jadi server hanya **menyiapkan tempat unggah** ke Google, lalu browser pembeli mengunggah videonya langsung ke sana. Isi video tidak pernah melewati server kita.

### Video ditayangkan lewat server, bukan lewat tautan Google Drive

Kalau penerima diberi tautan Drive langsung, tautan itu bisa diteruskan ke siapa pun dan tidak bisa ditarik kembali. Dengan diteruskan lewat server, file di Drive **tetap privat**; penerima hanya memegang token sementara yang bisa kedaluwarsa.

### Kode pesanan tidak pernah muncul di alamat halaman

Alamat halaman tersimpan di riwayat peramban dan log server. Kalau kode ada di situ, kode itu ikut tersebar. Setelah kode diverifikasi, server mengeluarkan **token bertanda tangan** yang dipakai menggantikannya.

### Kode dibuat acak, bukan berurutan

Kode seperti `CH-0001`, `CH-0002` bisa ditebak — orang bisa membuka video orang lain hanya dengan mencoba beberapa angka. Kode di sini dibuat acak secara kriptografis: **31⁸ ≈ 852 miliar** kemungkinan, dan huruf yang mudah tertukar (`0`/`O`, `1`/`I`/`L`) sengaja dibuang karena kode ditulis tangan di kartu.

### Satu QR, bukan satu per pesanan

QR mengarah ke halaman penerima yang sama untuk semua kemasan. Yang berbeda hanyalah kode di kartu. Jadi perusahaan cukup mencetak satu desain QR.

---

## Menyiapkan

### 1. Google (sekali saja, ± 10 menit)

Ikuti **[docs/SETUP_GOOGLE.md](docs/SETUP_GOOGLE.md)** — membuat service account, folder Drive, dan spreadsheet.

### 2. Berkas `.env`

```bash
cp .env.example .env
```

Isi nilainya. Yang **wajib**:

| Variabel | Isinya |
|---|---|
| `SITUS_URL` | Alamat situs, mis. `https://cokelatku.com` |
| `GOOGLE_CLIENT_EMAIL` | Email service account |
| `GOOGLE_PRIVATE_KEY` | Private key service account |
| `GOOGLE_DRIVE_FOLDER_ID` | ID folder penyimpanan video |
| `GOOGLE_SHEET_ID` | ID spreadsheet pencatatan |
| `TOKEN_SECRET` | Kunci acak min. 32 karakter |
| `ADMIN_PIN` | PIN halaman admin (min. 6 karakter) |

Buat `TOKEN_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Jalankan

```bash
npm install
npx vercel dev
```

Buka <http://localhost:3000>.

---

## Mencetak QR

Ada **dua cara** — pilih salah satu:

**Cara A — halaman admin (disarankan)**

Buka `/admin.html`, masukkan `ADMIN_PIN`, lalu klik **Cetak QR** atau **Unduh PNG/SVG**.
Halaman ini juga menampilkan daftar pesanan terbaru, jadi bisa sekaligus memeriksa sistemnya berjalan.

**Cara B — lewat perintah**

```bash
npm run qr
# atau tentukan alamat sendiri:
npx tsx scripts/buat_qr.ts https://domain-anda.com
```

Menghasilkan `qr-kemasan.png` (2000×2000 px) dan `qr-kemasan.svg` (vektor) di folder proyek.

> **Penting:** QR berisi alamat situs. Kalau `SITUS_URL` masih `localhost`, QR-nya
> tidak akan bisa dibuka dari ponsel siapa pun. Pastikan domain sudah benar dulu.

**Tips cetak:** ukuran minimal 2×2 cm (disarankan 3×3 cm), cetak gelap di atas
latar terang, jangan memotong ruang putih di sekelilingnya, dan uji pindai dengan
2-3 ponsel berbeda sebelum mencetak banyak.

---

## Deploy ke Vercel

1. Unggah ke GitHub — **pastikan `.env` tidak ikut ter-commit**
2. Import repositori di <https://vercel.com/new>
3. Tempel semua isi `.env` ke **Environment Variables**
4. Deploy
5. Tambahkan domain di **Settings → Domains**
6. Perbarui `SITUS_URL` sesuai domain, lalu **Redeploy**
7. Buka `/admin.html` dan cetak QR-nya

---

## Mengganti ke akun Google perusahaan

Tanpa mengubah kode sama sekali:

1. Buat service account di project Google Cloud milik perusahaan
2. Bagikan folder Drive & spreadsheet perusahaan ke email service account baru
3. Ganti 4 nilai di Environment Variables: `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_DRIVE_FOLDER_ID`, `GOOGLE_SHEET_ID`

---

## Struktur berkas

```
api/                  Endpoint (Vercel serverless)
  mulai.ts              Mulai pesanan — buat folder + sesi unggah
  selesai.ts            Selesaikan pesanan — periksa video + catat ke Sheets
  cek.ts                Penerima memasukkan kode
  video.ts              Menayangkan video (dengan dukungan geser/seek)
  admin.ts              Masuk PIN + data halaman admin
  info.ts               Nama perusahaan & batas ukuran

src/                  Logika inti
  env.ts                Konfigurasi terpusat
  kode.ts               Pembuat & perapi kode pesanan
  token.ts              Token bertanda tangan (video & sesi)
  admin.ts              Verifikasi PIN (timing-safe) & token admin
  drive.ts              Google Drive — folder, unggah, tayang
  sheets.ts             Google Sheets — catat & cari pesanan
  google.ts             Autentikasi + penerjemah pesan error
  validasi.ts           Pemeriksaan data formulir
  rate_limit.ts         Pembatas percobaan
  http.ts               Pembantu endpoint

public/               Tampilan
  index.html            Halaman penjelasan
  kirim.html            Formulir pembeli
  v.html                Halaman penerima (dibuka QR)
  admin.html            Halaman admin
  css/style.css         Gaya bersama
  js/                   Logika tiap halaman

docs/                 Panduan
  SETUP_GOOGLE.md       Cara menyiapkan Google

scripts/
  buat_qr.ts            Pembuat berkas QR

tests/                Pengujian
```

---

## Pengujian

```bash
npm test        # 42 pengujian
npm run typecheck
```

Yang diuji bukan sekadar "kodenya jalan", tetapi hal-hal yang kalau salah akan
berdampak nyata:

- Kode pesanan benar-benar acak dan tidak memuat huruf yang mudah tertukar
- Token tidak bisa dipalsukan, tidak bisa dipakai lintas peran, dan menolak saat kedaluwarsa
- Berkas yang bukan video ditolak **sebelum** menyentuh Google Drive
- Nama berbahaya (`../../etc/passwd`) tidak bisa membuat folder bersarang
- Batas percobaan benar-benar menghentikan penebakan kode
- **QR tetap bisa dipindai walau sebagian tertutup** — ini yang diuji karena QR
  dicetak sekali dalam jumlah besar; kalau tidak terbaca, biaya cetaknya hangus

---

## Kalau ada masalah

| Gejala | Penyebab & perbaikan |
|---|---|
| "Service account tidak punya izin" | Folder Drive / spreadsheet belum dibagikan ke `GOOGLE_CLIENT_EMAIL` sebagai **Editor** |
| "Google Drive/Sheets API belum diaktifkan" | Langkah 2 di `docs/SETUP_GOOGLE.md` terlewat |
| "Kredensial Google ditolak" | `GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY` salah salin |
| QR tidak bisa dipindai | Pastikan `SITUS_URL` bukan localhost, cetak minimal 2×2 cm, jangan potong margin |
| Halaman admin bilang "tidak diaktifkan" | `ADMIN_PIN` kosong atau kurang dari 6 karakter |
| "Kode tidak ditemukan" padahal benar | Cek penulisan di spreadsheet — kolom `kode` harus berupa teks, bukan angka |

---

## Lisensi

MIT
