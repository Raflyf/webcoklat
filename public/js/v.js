/**
 * HALAMAN PENERIMA — logika sisi browser
 *
 * Halaman ini yang dibuka saat QR di kemasan dipindai.
 *
 * ALUR:
 *   1. Penerima memasukkan kode dari kartu
 *   2. Server memeriksa kode -> bila cocok, mengeluarkan TOKEN sementara
 *   3. Video ditayangkan lewat /api/video?t=<token>
 *
 * KENAPA KODE TIDAK DITARUH DI ALAMAT VIDEO:
 *   Alamat halaman tersimpan di riwayat peramban dan log server. Kalau kode ada
 *   di situ, kode itu ikut tersebar. Token sementara menggantikannya, dan token
 *   itu kedaluwarsa serta hanya berlaku untuk satu video.
 */
(function () {
  'use strict';

  var elForm = document.getElementById('form');
  var elKode = document.getElementById('kode');
  var elPesanGagal = document.getElementById('pesan-gagal');
  var elTombolBuka = document.getElementById('tombol-buka');
  var elBagianKode = document.getElementById('bagian-kode');
  var elBagianVideo = document.getElementById('bagian-video');
  var elPemutar = document.getElementById('pemutar');
  var elJudulVideo = document.getElementById('judul-video');
  var elPengirim = document.getElementById('pengirim');
  var elKeteranganPenerima = document.getElementById('keterangan-penerima');
  var elKotakPesan = document.getElementById('kotak-pesan');
  var elPesanVideo = document.getElementById('pesan-video');
  var elTombolKodeLain = document.getElementById('tombol-kode-lain');

  var tokenSekarang = '';

  fetch('/api/info')
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      if (!d || !d.ok || !d.namaPerusahaan) return;
      document.getElementById('nama-perusahaan').textContent = d.namaPerusahaan;
      document.title = 'Buka Video — ' + d.namaPerusahaan;
    })
    .catch(function () {
      /* biarkan nama bawaan */
    });

  /**
   * Rapikan ketikan sambil mengetik: huruf kapital, tanpa spasi, dan sisipkan
   * tanda hubung supaya bentuknya selalu menyerupai contoh di kartu.
   */
  elKode.addEventListener('input', function () {
    var mentah = elKode.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    // Buang awalan "CH" bila ikut diketik, karena kita tambahkan sendiri.
    if (mentah.indexOf('CH') === 0) mentah = mentah.slice(2);
    mentah = mentah.slice(0, 8);
    var rapi = 'CH-' + mentah.slice(0, 4);
    if (mentah.length > 4) rapi += '-' + mentah.slice(4);
    elKode.value = mentah.length ? rapi : '';
    sembunyikanGagal();
  });

  function tampilkanGagal(pesan) {
    elPesanGagal.textContent = pesan;
    elPesanGagal.classList.add('tampil');
  }
  function sembunyikanGagal() {
    elPesanGagal.classList.remove('tampil');
  }

  elForm.addEventListener('submit', function (e) {
    e.preventDefault();
    sembunyikanGagal();

    var kode = elKode.value.trim();
    if (kode.replace(/[^A-Za-z0-9]/g, '').length < 5) {
      tampilkanGagal('Kodenya belum lengkap. Periksa lagi kartu di dalam kemasan ya.');
      return;
    }

    elTombolBuka.disabled = true;
    elTombolBuka.textContent = 'Mencari videonya…';

    fetch('/api/cek', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kode: kode }),
    })
      .then(function (r) {
        return r.json().then(function (d) {
          return { status: r.status, data: d };
        });
      })
      .then(function (hasil) {
        var d = hasil.data;
        if (!d || !d.ok) {
          throw new Error((d && d.pesan) || 'Kode tidak bisa dibuka.');
        }
        tampilkanVideo(d);
      })
      .catch(function (err) {
        tampilkanGagal(err && err.message ? err.message : 'Terjadi gangguan. Coba lagi ya.');
      })
      .then(function () {
        elTombolBuka.disabled = false;
        elTombolBuka.textContent = 'Buka video';
      });
  });

  function tampilkanVideo(d) {
    tokenSekarang = d.token || '';

    elJudulVideo.textContent = d.judul ? d.judul : 'Untukmu';
    elPengirim.textContent = d.pengirim ? 'Dari ' + d.pengirim : 'Seseorang';
    document.title = (d.judul ? d.judul + ' — ' : '') + 'Video untukmu';

    if (d.penerima) {
      elKeteranganPenerima.textContent = 'Untuk ' + d.penerima;
    } else {
      elKeteranganPenerima.textContent = '';
    }

    if (d.pesan) {
      elKotakPesan.textContent = d.pesan;
      elKotakPesan.classList.remove('tersembunyi');
    } else {
      elKotakPesan.classList.add('tersembunyi');
    }

    elPemutar.src = '/api/video?t=' + encodeURIComponent(tokenSekarang);

    // Kalau tokennya sudah kedaluwarsa di tengah pemutaran, beri tahu dengan
    // jelas dan arahkan memasukkan kode lagi — jangan biarkan pemutar diam saja.
    elPemutar.addEventListener('error', function () {
      elPesanVideo.textContent =
        'Videonya gagal dimuat. Kemungkinan sesinya sudah kedaluwarsa — masukkan kodenya sekali lagi ya.';
      elPesanVideo.classList.add('tampil');
    });

    elBagianKode.classList.add('tersembunyi');
    elBagianVideo.classList.remove('tersembunyi');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Coba langsung putar. Sebagian peramban menolak putar-otomatis bersuara,
    // jadi kegagalan di sini wajar dan tidak perlu ditampilkan sebagai error.
    var coba = elPemutar.play();
    if (coba && typeof coba.catch === 'function') coba.catch(function () {});
  }

  elTombolKodeLain.addEventListener('click', function () {
    elPemutar.pause();
    elPemutar.removeAttribute('src');
    elPemutar.load();
    tokenSekarang = '';
    elKode.value = '';
    elPesanVideo.classList.remove('tampil');
    sembunyikanGagal();
    elBagianVideo.classList.add('tersembunyi');
    elBagianKode.classList.remove('tersembunyi');
    elKode.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();
