/**
 * HALAMAN KIRIM VIDEO — logika sisi browser
 *
 * ALUR TIGA LANGKAH:
 *   1. Kirim data formulir ke /api/mulai
 *      -> server membuat folder di Drive + menyiapkan tempat unggah
 *   2. Unggah videonya LANGSUNG ke Google memakai tempat yang sudah disiapkan
 *      -> video TIDAK melewati server kita, jadi ukurannya tidak dibatasi Vercel
 *   3. Kabari /api/selesai bahwa unggahan sudah beres
 *      -> server memeriksa ulang ke Google, mencatat pesanan, mengembalikan kode
 *
 * KENAPA LANGKAH 2 TIDAK LEWAT SERVER:
 *   Vercel membatasi isi permintaan ke fungsi serverless sekitar 4,5 MB.
 *   Video 20-100 MB akan selalu gagal kalau dikirim lewat server.
 */
(function () {
  'use strict';

  var elForm = document.getElementById('form');
  var elBagianForm = document.getElementById('bagian-form');
  var elBagianHasil = document.getElementById('bagian-hasil');
  var elBerkas = document.getElementById('berkas');
  var elPilihBerkas = document.getElementById('pilih-berkas');
  var elBerkasTerpilih = document.getElementById('berkas-terpilih');
  var elBerkasNama = document.getElementById('berkas-nama');
  var elBerkasUkuran = document.getElementById('berkas-ukuran');
  var elKemajuan = document.getElementById('kemajuan');
  var elKemajuanIsi = document.getElementById('kemajuan-isi');
  var elKemajuanPersen = document.getElementById('kemajuan-persen');
  var elKemajuanStatus = document.getElementById('kemajuan-status');
  var elPesanGagal = document.getElementById('pesan-gagal');
  var elTombolKirim = document.getElementById('tombol-kirim');
  var elKodeNilai = document.getElementById('kode-nilai');
  var elTombolSalin = document.getElementById('tombol-salin');
  var elTombolLagi = document.getElementById('tombol-lagi');

  var batasMb = 200; // diperbarui dari /api/info
  var kodeTerakhir = '';

  // ── Ambil batas ukuran & nama perusahaan dari server ──────────────────────
  fetch('/api/info')
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      if (!d || !d.ok) return;
      if (d.maksUkuranVideoMb) batasMb = d.maksUkuranVideoMb;
      var ket = document.getElementById('batas-ukuran');
      if (ket) ket.textContent = 'MP4, MOV, atau WebM · maksimal ' + batasMb + ' MB';
    })
    .catch(function () {
      /* biarkan nilai bawaan */
    });

  // ── Pilihan berkas ────────────────────────────────────────────────────────
  function ukuranTerbaca(byte) {
    if (byte < 1024 * 1024) return Math.round(byte / 1024) + ' KB';
    return (Math.round((byte / 1024 / 1024) * 10) / 10).toString().replace('.', ',') + ' MB';
  }

  function periksaBerkas(berkas) {
    if (!berkas) return 'Pilih videonya dulu ya.';
    if (berkas.size > batasMb * 1024 * 1024) {
      return 'Videonya terlalu besar (' + ukuranTerbaca(berkas.size) + '). Maksimal ' + batasMb + ' MB.';
    }
    if (berkas.size === 0) return 'Berkas videonya kosong. Coba pilih yang lain.';
    return '';
  }

  function tampilkanBerkas(berkas) {
    if (!berkas) {
      elBerkasTerpilih.classList.remove('tampil');
      return;
    }
    elBerkasNama.textContent = berkas.name;
    elBerkasUkuran.textContent = ukuranTerbaca(berkas.size);
    elBerkasTerpilih.classList.add('tampil');
  }

  elBerkas.addEventListener('change', function () {
    var berkas = elBerkas.files && elBerkas.files[0];
    tampilkanBerkas(berkas);
    if (berkas) {
      var salah = periksaBerkas(berkas);
      if (salah) tampilkanGagal(salah);
      else sembunyikanGagal();
    }
  });

  // Seret & lepas
  ['dragenter', 'dragover'].forEach(function (nama) {
    elPilihBerkas.addEventListener(nama, function (e) {
      e.preventDefault();
      elPilihBerkas.classList.add('seret');
    });
  });
  ['dragleave', 'drop'].forEach(function (nama) {
    elPilihBerkas.addEventListener(nama, function (e) {
      e.preventDefault();
      elPilihBerkas.classList.remove('seret');
    });
  });
  elPilihBerkas.addEventListener('drop', function (e) {
    var berkas = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!berkas) return;
    // Menyalin berkas yang dijatuhkan ke input file tidak bisa langsung di semua
    // browser, jadi kita hanya memberi tahu bila tidak didukung.
    try {
      var dt = new DataTransfer();
      dt.items.add(berkas);
      elBerkas.files = dt.files;
      tampilkanBerkas(berkas);
    } catch (err) {
      tampilkanGagal('Cara ini belum didukung di peramban kamu. Ketuk kotak di atas untuk memilih video ya.');
    }
  });

  function tampilkanGagal(pesan) {
    elPesanGagal.textContent = pesan;
    elPesanGagal.classList.add('tampil');
  }
  function sembunyikanGagal() {
    elPesanGagal.classList.remove('tampil');
  }

  function aturKemajuan(persen, status) {
    elKemajuan.classList.add('tampil');
    elKemajuanIsi.style.width = Math.max(0, Math.min(100, persen)) + '%';
    elKemajuanPersen.textContent = Math.round(persen) + '%';
    if (status) elKemajuanStatus.textContent = status;
  }

  // ── Kirim ─────────────────────────────────────────────────────────────────
  elForm.addEventListener('submit', function (e) {
    e.preventDefault();
    sembunyikanGagal();

    var namaPembeli = document.getElementById('nama-pembeli').value.trim();
    var namaPenerima = document.getElementById('nama-penerima').value.trim();
    var judul = document.getElementById('judul').value.trim();
    var pesan = document.getElementById('pesan').value.trim();
    var berkas = elBerkas.files && elBerkas.files[0];

    if (namaPembeli.length < 2) return tampilkanGagal('Nama kamu belum diisi.');
    if (namaPenerima.length < 2) return tampilkanGagal('Nama penerima belum diisi.');
    var salahBerkas = periksaBerkas(berkas);
    if (salahBerkas) return tampilkanGagal(salahBerkas);

    elTombolKirim.disabled = true;
    aturKemajuan(2, 'Menyiapkan tempat penyimpanan…');

    // ── Langkah 1: minta tempat unggah ──
    fetch('/api/mulai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        namaPembeli: namaPembeli,
        namaPenerima: namaPenerima,
        judul: judul,
        pesan: pesan,
        namaFile: berkas.name,
        mime: berkas.type,
        ukuranByte: berkas.size,
      }),
    })
      .then(function (r) {
        return r.json().then(function (d) {
          return { status: r.status, data: d };
        });
      })
      .then(function (hasil) {
        if (!hasil.data || !hasil.data.ok) {
          throw new Error((hasil.data && hasil.data.pesan) || 'Gagal menyiapkan unggahan.');
        }
        aturKemajuan(5, 'Mengunggah video…');
        return unggahKeGoogle(hasil.data.uploadUri, berkas, hasil.data.sesi);
      })
      .then(function (hasilSelesai) {
        aturKemajuan(100, 'Selesai');
        tampilkanHasil(hasilSelesai.tampilKode || hasilSelesai.kode);
      })
      .catch(function (err) {
        elTombolKirim.disabled = false;
        elKemajuan.classList.remove('tampil');
        tampilkanGagal(err && err.message ? err.message : 'Terjadi gangguan. Coba lagi ya.');
      });
  });

  /**
   * Langkah 2 & 3: unggah ke Google, lalu kabari server.
   *
   * Memakai XMLHttpRequest (bukan fetch) karena hanya XHR yang memberi
   * kejadian kemajuan unggahan — penting untuk video besar supaya pengguna
   * tahu prosesnya masih berjalan.
   */
  function unggahKeGoogle(uploadUri, berkas, sesi) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUri, true);
      xhr.setRequestHeader('Content-Type', berkas.type || 'application/octet-stream');

      xhr.upload.onprogress = function (ev) {
        if (!ev.lengthComputable) return;
        // Unggahan memakai 5-95% dari bilah, sisanya untuk pemeriksaan server.
        var persen = 5 + (ev.loaded / ev.total) * 90;
        aturKemajuan(persen, 'Mengunggah video… ' + ukuranTerbaca(ev.loaded) + ' / ' + ukuranTerbaca(ev.total));
      };

      xhr.onload = function () {
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error('Unggahan gagal (kode ' + xhr.status + '). Periksa koneksi lalu coba lagi.'));
          return;
        }
        aturKemajuan(96, 'Memeriksa & mencatat…');
        // ── Langkah 3: kabari server ──
        fetch('/api/selesai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sesi: sesi }),
        })
          .then(function (r) {
            return r.json();
          })
          .then(function (d) {
            if (!d || !d.ok) throw new Error((d && d.pesan) || 'Gagal menyelesaikan pencatatan.');
            resolve(d);
          })
          .catch(function (err) {
            reject(err);
          });
      };

      xhr.onerror = function () {
        reject(new Error('Koneksi terputus saat mengunggah. Coba lagi ya.'));
      };
      xhr.ontimeout = function () {
        reject(new Error('Unggahan memakan waktu terlalu lama. Coba lagi ya.'));
      };

      xhr.send(berkas);
    });
  }

  // ── Tampilkan hasil ───────────────────────────────────────────────────────
  function tampilkanHasil(kode) {
    kodeTerakhir = kode || '';
    elKodeNilai.textContent = kode || '—';
    elBagianForm.classList.add('tersembunyi');
    elBagianHasil.classList.remove('tersembunyi');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  elTombolSalin.addEventListener('click', function () {
    var teks = kodeTerakhir;
    function berhasil() {
      elTombolSalin.textContent = 'Tersalin ✓';
      setTimeout(function () {
        elTombolSalin.textContent = 'Salin kode';
      }, 2000);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(teks).then(berhasil).catch(cadangan);
    } else {
      cadangan();
    }
    function cadangan() {
      // Peramban lama / bukan HTTPS: pilih teksnya supaya bisa disalin manual.
      var jangkauan = document.createRange();
      jangkauan.selectNodeContents(elKodeNilai);
      var pilihan = window.getSelection();
      pilihan.removeAllRanges();
      pilihan.addRange(jangkauan);
      try {
        document.execCommand('copy');
        berhasil();
      } catch (e) {
        elTombolSalin.textContent = 'Pilih & salin manual';
      }
    }
  });

  elTombolLagi.addEventListener('click', function () {
    elForm.reset();
    elBerkasTerpilih.classList.remove('tampil');
    elKemajuan.classList.remove('tampil');
    elTombolKirim.disabled = false;
    sembunyikanGagal();
    elBagianHasil.classList.add('tersembunyi');
    elBagianForm.classList.remove('tersembunyi');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();
