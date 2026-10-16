# Setup OAuth Google (wajib, ± 5 menit)

## Kenapa ini perlu?

Saat pengujian, unggahan video gagal dengan pesan Google:

```
403: Service Accounts do not have storage quota.
```

**Artinya:** akun *service account* bisa **membuat folder** di Drive Anda, tetapi
**tidak bisa menyimpan berkas** — karena berkas yang ia unggah dihitung terhadap
kuota penyimpanannya sendiri, dan kuota itu **0**.

Ini batasan Google, bukan kesalahan konfigurasi. Folder tetap berhasil dibuat,
jadi masalahnya baru terlihat saat videonya diunggah.

**Solusinya:** penyimpanan video memakai izin **akun Google Anda sendiri** (OAuth).
Sekali Anda menyetujui akses, sistem menyimpan *refresh token* yang bisa dipakai
terus-menerus tanpa login lagi.

> Service account **tetap berguna** dan tidak perlu dihapus — ia masih dipakai
> sebagai cadangan untuk memeriksa folder dan spreadsheet.

---

## Langkah 1 — Buat OAuth Client ID

1. Buka <https://console.cloud.google.com/apis/credentials>
2. **Pastikan project yang benar sudah dipilih** di bagian atas
   (project `kinetic-valor-443707-r1` — project yang sama dengan service account)
3. Klik **+ Create Credentials** → **OAuth client ID**

   > **Bila muncul peringatan "To create an OAuth client ID, you must first
   > configure a consent screen"** — klik **Configure consent screen** dulu,
   > lihat Langkah 1b di bawah, lalu kembali ke sini.

4. **Application type:** pilih **Desktop app**
5. **Name:** `webcoklat` (bebas)
6. Klik **Create**
7. Muncul kotak berisi **Client ID** dan **Client Secret** — salin keduanya

### Langkah 1b — Bila diminta mengisi consent screen

1. **User Type:** pilih **External** → **Create**
2. **App name:** `webcoklat`
3. **User support email:** pilih email Anda
4. **Developer contact information:** isi email Anda
5. Klik **Save and Continue** (lewati bagian Scopes dan Test users)
6. Klik **Back to Dashboard**
7. **PENTING — klik "Publish app"** lalu konfirmasi.
   Selama statusnya masih *Testing*, refresh token akan kedaluwarsa setelah
   7 hari. Setelah *In production*, token berlaku terus.

> Tidak perlu menunggu verifikasi Google. Aplikasi tetap bisa dipakai oleh
> pemiliknya sendiri; yang perlu verifikasi hanya bila dipakai orang lain.

---

## Langkah 2 — Isi Client ID & Secret ke `.env`

```env
GOOGLE_OAUTH_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx
```

---

## Langkah 3 — Ambil refresh token

```bash
npx tsx scripts/dapatkan_token_oauth.ts
```

Terminal akan menampilkan **tautan persetujuan**. Buka di peramban, pilih akun
Google Anda, lalu klik **Izinkan**.

Setelah disetujui:
- Halaman peramban menampilkan "✅ Berhasil!"
- Terminal menampilkan "🎉 SELESAI"
- `.env` otomatis terisi `GOOGLE_OAUTH_REFRESH_TOKEN`

### Bila muncul "Google tidak memberikan refresh token"

Ini terjadi kalau Anda pernah menyetujui akses ini sebelumnya — Google hanya
memberi refresh token pada persetujuan pertama.

Perbaikan:
1. Buka <https://myaccount.google.com/permissions>
2. Cari aplikasi `webcoklat` → **Hapus akses**
3. Jalankan script lagi

---

## Langkah 4 — Kirim ke Vercel & deploy ulang

```bash
npx tsx scripts/unggah_env_vercel.ts
npx vercel --prod
```

---

## Langkah 5 — Uji ulang

```bash
npx tsx scripts/uji_alur.ts
```

Harusnya sekarang seluruh pemeriksaan lulus.

---

## Keamanan

- **Refresh token = akses penuh ke Drive dan Spreadsheet akun Anda.** Jangan
  pernah dikirim ke siapa pun, jangan ditempel di chat, jangan di-commit ke Git.
- `.env` sudah masuk `.gitignore` — jangan diubah.
- Untuk **mencabut akses** kapan saja: <https://myaccount.google.com/permissions>
  → hapus `webcoklat`. Sistem akan berhenti bisa menyimpan, tetapi berkas yang
  sudah ada tetap aman di Drive Anda.
- Saat proyek ini diserahkan ke perusahaan: buat OAuth client baru di akun Google
  **perusahaan**, lalu ulangi Langkah 1–4. Hapus akses di akun lama setelahnya.
