# Dokumentasi Proyek Web Coklat

Dokumen ini mencatat keputusan teknis, arsitektur, dan riwayat iterasi antarmuka.

---

## Riwayat Perubahan

### 16 Oktober 2026 — Perbaikan Tata Letak Teks & Peningkatan UI/UX Antarmuka

#### 1. Perbaikan Bug Tata Letak (Pemusatan Elemen Header)
- **Akar Masalah:**
  Pada layar desktop (lebar $\ge 1000\text{ px}$), kelas `.kepala__keterangan` memiliki aturan `max-width: 56ch` dengan nilai margin bawaan `margin: 0`. Sebagai elemen blok (`<p>`), pembatasan lebar tanpa `margin: auto` menyebabkan kontainer teks menempel di tepi kiri wadah (`.kepala`), meskipun properti `text-align: center` aktif. Hal ini menyebabkan teks deskripsi pada halaman depan (`index.html`), form kirim (`kirim.html`), buka video (`v.html`), dan login admin (`admin.html`) bergeser ke kiri.
- **Solusi:**
  - Menetapkan `display: flex; flex-direction: column; align-items: center;` pada induk `.kepala`.
  - Menambahkan `margin: 0 auto; max-width: 52ch; text-align: center; text-wrap: balance;` pada `.kepala__keterangan`.
  - Memastikan kueri media pada breakpoint `760px` dan `1000px` menyertakan `margin-left: auto; margin-right: auto; text-align: center;`.
  - Menerapkan `text-wrap: balance;` pada `.kepala__judul` untuk mencegah pemenggalan kata gantung.

#### 2. Peningkatan Visual & Pengalaman Pengguna (UI/UX)
- **Tipografi:**
  - Mengintegrasikan font Google: **Outfit** untuk heading (`.kepala__judul`, `.kartu__judul`, `.pilihan__judul`, `.tombol`) dan **Plus Jakarta Sans** untuk teks isi, label formulir, serta navigasi.
  - Menggunakan **JetBrains Mono** untuk kotak kode pesanan (`.kode-input`, `.pin-kotak`, `.kode-hasil__nilai`) untuk keterbacaan kode karakter alfanumerik.
- **Palet Warna & Nuansa Brand:**
  - Latar belakang diperkaya gradien radial lembut (`--krem: #faf5ee` dengan aksen madu-karamel halus) untuk menciptakan atmosfer toko cokelat artisanal.
  - Warna kontras tinggi yang ramah aksesibilitas (rasio kontras teks $\ge 5.5:1$ memenuhi standar WCAG AA).
  - Label badge produk (`.kepala__nama`) didesain menyerupai label segel pita kemasan cokelat premium.
- **Komponen & Mikro-Interaksi:**
  - Kartu pilihan (`.pilihan__item`) dilengkapi transisi elevasi lembut (`translateY(-3px)` dan bayangan mendalam) serta skala ikon dinamis saat kursor melintas.
  - Indikator urutan langkah (`.langkah li::before`) dipercantik dengan bentuk bulat kontras dan tipografi Outfit.
  - Tombol aksi utama (`.tombol`) menggunakan gradien cokelat pekat dengan *inner highlight* dan efek tekan halus (`translateY(1px)`).
  - Kotak hasil kode pesanan (`.kode-hasil`) didesain dengan tema *dark chocolate luxury* dengan aksen emas bergradien.
  - Semua elemen input dan tombol dilengkapi *focus ring* (`:focus-visible`) yang ramah aksesibilitas keyboard.
- **Verifikasi Fungsionalitas:**
  - Seluruh 52/52 unit test lolos tanpa regresi.
  - Struktur ID DOM, atribut formulir, dan antarmuka JavaScript tetap utuh 100%.
