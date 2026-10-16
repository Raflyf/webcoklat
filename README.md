# Web Coklat

> Sistem kartu ucapan video personal untuk hadiah cokelat menggunakan satu QR code kemasan seragam dan kode verifikasi unik.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-green.svg)](https://nodejs.org/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black.svg)](https://vercel.com/)
[![Tests](https://img.shields.io/badge/Tests-52%20passed-brightgreen.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Ringkasan Proyek

**Web Coklat** memungkinkan pembeli hadiah cokelat menyertakan rekaman video personal yang hanya dapat dibuka oleh penerima yang berhak. Sistem ini dirancang untuk efisiensi rantai produksi fisik:

- **Satu QR Code untuk Seluruh Kemasan:** Pabrik/toko cukup mencetak satu master desain QR pada kotak kemasan.
- **Kode Pesanan Unik di Kartu:** Setiap pembeli mendapatkan kode unik (misalnya `CH-7K9P-2M4Q`) untuk ditulis pada kartu ucapan di dalam kotak.
- **Privasi Terjamin:** Video diunggah langsung ke Google Drive privat milik pemilik toko dan hanya dapat diakses melalui token bertanda tangan sementara.

Arsitektur teknis lengkap dan panduan desain dapat dilihat di [DOCUMENTATION.md](DOCUMENTATION.md).

---

## Fitur Utama

- **Direct Upload ke Google Drive:** Menembus batas payload serverless Vercel (4.5 MB) sehingga video besar (20–100 MB) dapat diunggah langsung dari peramban ke Google Drive.
- **Penerbitan Token HMAC:** Mencegah pencurian URL video dan kebocoran riwayat peramban.
- **Dukungan HTTP Range Streaming:** Memungkinkan *seeking/scrubbing* video yang mulus tanpa mengunduh seluruh berkas sekaligus.
- **Alfabet Kode Anti-Salah Baca:** Mengeliminasi karakter ambigu (`0`/`O`, `1`/`I`/`L`) untuk kenyamanan penulisan tangan di kartu ucapan.
- **Panel Admin Terproteksi:** Halaman pengelola berbasis PIN untuk menghasilkan QR beresolusi tinggi (PNG/SVG) dan memantau pesanan terkini.
- **Desain Responsif Mobile-First:** Antarmuka bertema cokelat artisanal dengan tipografi modern, aksesibilitas tinggi (WCAG AA), dan tata letak terpusat presisi.

---

## Tumpukan Teknologi

| Komponen | Teknologi |
|---|---|
| **Runtime & Bahasa** | Node.js $\ge 20$, TypeScript 5.6 |
| **Arsitektur Backend** | Vercel Serverless Functions (`/api/*`) |
| **Penyimpanan Berkas** | Google Drive API v3 (Resumable Upload & Streaming) |
| **Database Transaksi** | Google Sheets API v4 |
| **Antarmuka Pengguna** | Vanilla HTML5, Modern CSS (Design Tokens, Google Fonts), Vanilla JS |
| **Pengujian** | Node.js Test Runner & `tsx` (52 skenario pengujian) |

---

## Memulai Cepat

### 1. Prasyarat
- Node.js versi 20 atau lebih baru.
- Akun Google Cloud dengan Google Drive API & Google Sheets API aktif (lihat [Panduan Setup Google](docs/SETUP_GOOGLE.md)).

### 2. Pemasangan
```bash
# Klon repositori
git clone https://github.com/username/webcoklat.git
cd webcoklat

# Pasang dependensi
npm install
```

### 3. Konfigurasi Lingkungan
Salin berkas contoh konfigurasi:
```bash
cp .env.example .env
```
Isi variabel yang diperlukan seperti kredensial Service Account Google, ID folder Drive, ID Sheet, `TOKEN_SECRET`, dan `ADMIN_PIN`.

### 4. Menjalankan Server Lokal
```bash
npx vercel dev
```
Buka <http://localhost:3000> pada peramban Anda.

### 5. Menjalankan Pengujian
```bash
npm test
npm run typecheck
```

---

## Struktur Direktori

```text
├── api/                  # Endpoint Vercel Serverless Functions
│   ├── admin.ts          # Autentikasi PIN & data panel pengelola
│   ├── cek.ts            # Validasi kode kartu penerima
│   ├── info.ts           # Metadata publik toko & limit unggahan
│   ├── mulai.ts          # Inisiasi folder Drive & sesi unggah
│   ├── selesai.ts        # Finalisasi video & pencatatan pesanan ke Sheets
│   └── video.ts          # Streaming video terproteksi token
├── src/                  # Modul logika bisnis inti
│   ├── drive.ts          # Integrasi Google Drive
│   ├── sheets.ts         # Integrasi Google Sheets
│   ├── kode.ts           # Generator kode acak kriptografis
│   ├── token.ts          # Penandatangan & verifikator token HMAC
│   └── validasi.ts       # Validasi masukan & sanitasi berkas
├── public/               # Aset statis & tampilan web
│   ├── index.html        # Beranda & panduan cara kerja
│   ├── kirim.html        # Formulir pengiriman video
│   ├── v.html            # Halaman penerima untuk memutar video
│   ├── admin.html        # Dasbor admin & cetak QR
│   ├── css/style.css     # Sistem desain antarmuka
│   └── js/               # Skrip logika interaktif per halaman
├── docs/                 # Panduan konfigurasi eksternal
├── scripts/              # Skrip pembuatan QR code kemasan
└── tests/                # Skenario pengujian unit & integrasi
```

---

## Dokumentasi Pendukung

- [DOCUMENTATION.md](DOCUMENTATION.md) — Arsitektur sistem lengkap, keputusan keamanan, dan log UI/UX.
- [docs/SETUP_GOOGLE.md](docs/SETUP_GOOGLE.md) — Langkah demi langkah konfigurasi Google Cloud Service Account.

---

## Lisensi

Didistribusikan di bawah lisensi [MIT](LICENSE).
