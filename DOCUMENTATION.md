# Dokumentasi Teknis & Arsitektur Web Coklat

Dokumen ini berisi spesifikasi arsitektur menyeluruh, keputusan teknis mendalam, panduan operasional, dan riwayat iterasi sistem **Web Coklat**.

---

## 1. Masalah Bisnis & Konsep Solusi

### Masalah
Sebuah produsen hadiah cokelat ingin pembeli dapat menyertakan video pesan personal untuk penerima hadiah.
Tantangan operasional di lapangan:
1. **Pemisahan Hak Akses:** Penerima hanya boleh membuka video miliknya sendiri, bukan video pembeli lain.
2. **Efisiensi Produksi Cetak:** Kemasan cokelat dicetak massal di percetakan. Perusahaan menghendaki **satu QR code seragam** untuk semua kemasan — bukan mencetak QR unik per pesanan yang mahal dan rentan tertukar saat pengemasan.
3. **Keterbatasan QR Code Fisik:** QR code statis tidak membawa identitas dinamis pembeli. Bila QR mengarah langsung ke folder penyimpanan publik (misal folder cloud Drive), privasi pembeli dan penerima akan bocor.

### Konsep Solusi
- **QR Code Statis:** Dicetak satu kali untuk seluruh batch kemasan, mengarah ke halaman web penerima (`/v.html`).
- **Kode Unik Kartu:** Dicetak atau ditulis pada kartu ucapan di dalam kemasan (misal `CH-7K9P-2M4Q`).
- **Pencocokan Sisi Server:** Penerima memindai QR, memasukkan kode kartu, lalu server memvalidasi dan mengeluarkan token video sementara berumur pendek.

```text
Pembeli                          Penerima
   │                                │
   ├─ Isi formulir kirim            ├─ Pindai QR di kemasan (URL sama untuk semua)
   ├─ Unggah video langsung         ├─ Masukkan kode unik kartu
   │     ↓                          │     ↓
   │  Google Drive                  │  Server validasi & verifikasi token
   │  (Folder pesanan privat)       │     ↓
   │     ↓                          └─ Video diputar aman di browser
   └─ Salin kode pesanan
      (tulis di kartu kemasan)
```

---

## 2. Arsitektur Sistem & Aliran Data

### 2.1 Alur Pengiriman Video (`/kirim.html`)
1. **Inisiasi (`POST /api/mulai`):**
   - Server menerima metadata (nama pembeli, nama penerima, judul, pesan singkat, nama file video).
   - Server membuat subfolder khusus di Google Drive dengan format `[KODE] Nama Penerima`.
   - Server meminta *resumable upload session URI* langsung ke Google Drive API.
   - Sesi unggahan terenkripsi dikembalikan ke browser dalam bentuk token sesi (`sessionToken`).
2. **Unggahan Langsung ke Google Drive (Direct Upload):**
   - Browser mengunggah file video langsung ke URI Google Drive via `XMLHttpRequest` / `fetch`.
   - **Rasional:** Vercel serverless membatasi ukuran request payload maksimal **4,5 MB**. Video pengguna berkisar 20–100 MB. Dengan mengunggah langsung ke endpoint Google, file video tidak membebani server Vercel dan tidak terbentur batasan payload serverless.
3. **Penyelesaian Pesanan (`POST /api/selesai`):**
   - Browser memberi sinyal bahwa unggahan selesai.
   - Server mengonfirmasi keberadaan file di Drive, mencatat baris transaksi baru di Google Sheets, dan menghasilkan kode pesanan final.

### 2.2 Alur Penerimaan Video (`/v.html`)
1. **Verifikasi Kode (`POST /api/cek`):**
   - Penerima memasukkan kode (toleran huruf kecil, spasi, dan tanda hubung).
   - Server mencocokkan kode di Google Sheets.
   - Jika valid, server menerbitkan **token video bertanda tangan HMAC** yang mencakup `fileId`, batas waktu (TTL), dan identitas video.
2. **Pemutaran Video Aman (`GET /api/video?t=<token>`):**
   - Video di-stream melalui server menggunakan token bertanda tangan.
   - Server mendukung HTTP Range Request (`206 Partial Content`) untuk kemampuan *scrubbing* / *seeking* pemutar video.
   - Tautan langsung Google Drive tidak pernah diekspos ke klien.

---

## 3. Keputusan Desain & Keamanan

### 3.1 Format Kode Pesanan Kriptografis
- **Struktur:** `CH-XXXX-XXXX` (diawali `CH-` dan 8 karakter acak).
- **Alfabet Bersih (Anti-Salah Baca):** Mengeliminasi karakter yang membingungkan saat ditulis tangan di kartu kemasan:
  - Dihapus: angka `0`, huruf `O`, angka `1`, huruf `I`, huruf `L`.
  - Menggunakan alfabet 31 karakter unik.
- **Kapasitas Entropi:** $31^8 \approx 852\text{ miliar}$ kombinasi unik, mencegah serangan tebakan (*brute-force*).
- **Parser Toleran:** Karakter `0`/`O` dan `1`/`I`/`L` ditoleransi dan dinormalisasi otomatis saat diketik oleh penerima.

### 3.2 Token Bertanda Tangan (HMAC-SHA256)
- Kode pesanan tidak pernah diletakkan sebagai query parameter di URL (`/v.html?kode=...`) demi mencegah kebocoran di riwayat browser atau access log perantara.
- Token video dan token sesi admin memiliki masa kedaluwarsa dan diisolasi berdasarkan *peran*: token admin ditolak jika dipakai memutar video, begitu pula sebaliknya.

### 3.3 Mitigasi Brute Force & Sanitasi Input
- Algoritma pembatas laju percobaan (*rate limiting*) berbasis IP memblokir percobaan tebakan kode berulang.
- Validasi tipe MIME dan ekstensi berkas mencegah file berbahaya sebelum request menyentuh Google Drive.
- Sanitasi nama file dan folder mencegah serangan *directory traversal* (`../../`).

---

## 4. Panduan Penyiapan Lingkungan

### 4.1 Variabel Lingkungan (`.env`)
Salin berkas contoh:
```bash
cp .env.example .env
```

| Variabel | Deskripsi | Contoh |
|---|---|---|
| `SITUS_URL` | Domain publik situs produksi | `https://cokelatku.com` |
| `GOOGLE_CLIENT_EMAIL` | Email akun layanan Google Cloud | `service-acc@project.iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY` | Kunci privat RSA akun layanan | `"-----BEGIN PRIVATE KEY-----\n..."` |
| `GOOGLE_DRIVE_FOLDER_ID` | ID folder induk penyimpanan di Drive | `1AbCdEfGhIjKlMnOpQrStUvWxYz` |
| `GOOGLE_SHEET_ID` | ID spreadsheet pencatatan pesanan | `1XyZaBcDeFgHiJkLmNoPqRsTuVw` |
| `TOKEN_SECRET` | Kunci rahasia penandatangan HMAC (min. 32 karakter) | Dibuat via `crypto.randomBytes(32)` |
| `ADMIN_PIN` | PIN untuk akses dasbor admin (min. 6 digit) | `849201` |
| `NAMA_PERUSAHAAN` | Nama merek yang ditampilkan di UI | `Cokelat Kita` |

Panduan detail pembuatan akun layanan Google tersedia di [docs/SETUP_GOOGLE.md](file:///d:/code/project/webcoklat/docs/SETUP_GOOGLE.md).

---

## 5. Pembuatan & Pencetakan QR Code

### 5.1 Opsi Cetak
1. **Melalui Panel Web Admin (`/admin.html`):**
   - Masukkan `ADMIN_PIN`.
   - Pilih tombol **Cetak QR** atau **Unduh PNG/SVG**.
2. **Melalui Skrip Terminal:**
   ```bash
   npm run qr
   # Atau dengan URL kustom:
   npx tsx scripts/buat_qr.ts https://cokelatku.com
   ```
   Skrip akan menghasilkan `qr-kemasan.png` (resolusi tinggi 2000×2000 px) dan `qr-kemasan.svg` (vektor tajam).

### 5.2 Standar Kualitas Cetak Fisik
- **Koreksi Galat:** QR code digenerate dengan *Error Correction Level H* (tahan kerusakan/kotor hingga 30%).
- **Dimensi Fisik Minimum:** $2 \times 2\text{ cm}$ (disarankan $3 \times 3\text{ cm}$).
- **Kontras & Margin:** Wajib cetak gelap di atas latar terang dan menyisakan *quiet zone* (ruang putih tanpa potongan) di sekeliling QR.

---

## 6. Riwayat Perubahan Antarmuka (UI/UX Log)

### 16 Oktober 2026 — Perbaikan Pemusatan Header & Peningkatan Visual Artisanal
- **Pemusatan Elemen Header:**
  - Memperbaiki bug pada layar desktop ($\ge 1000\text{ px}$) di mana `.kepala__keterangan` memiliki `max-width: 56ch` dengan `margin: 0`, yang menyebabkan kontainer teks menempel di kiri wadah.
  - Menetapkan `display: flex; flex-direction: column; align-items: center;` pada kontainer `.kepala`, serta `margin: 0 auto; text-wrap: balance; text-align: center;` pada `.kepala__keterangan`.
- **Evolusi Desain Tema Cokelat:**
  - Mengadopsi font display modern **Outfit** untuk judul dan kartu, dipadukan dengan **Plus Jakarta Sans** untuk kenyamanan membaca teks tubuh, dan **JetBrains Mono** untuk kotak kode.
  - Memperkaya latar belakang dengan gradien radial hangat menyerupai nuansa kemasan cokelat artisanal.
  - Memperbarui interaktivitas kartu pilihan (`.pilihan__item`) dengan transisi elevasi lembut (`translateY(-3px)`), penataan nomor langkah berbingkai melingkar, dan *focus ring* aksesibel.
