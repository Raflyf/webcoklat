/**
 * HALAMAN ADMIN — logika sisi browser
 *
 * ALUR:
 *   1. Admin memasukkan PIN -> dikirim ke server untuk diperiksa
 *   2. Bila benar, server mengeluarkan token sesi
 *   3. Token disimpan di sessionStorage (hilang saat tab ditutup)
 *   4. Halaman memuat data QR + daftar pesanan memakai token itu
 *
 * CATATAN KEAMANAN:
 *   PIN TIDAK PERNAH disimpan di browser. Yang disimpan hanya token sesi yang
 *   bisa kedaluwarsa dan otomatis batal bila PIN di server diganti.
 */
(function () {
  'use strict';

  var KUNCI_SESI = 'cokelat_admin_sesi';

  var elLayarPin = document.getElementById('layar-pin');
  var elPanel = document.getElementById('panel');
  var elFormPin = document.getElementById('form-pin');
  var elPin = document.getElementById('pin');
  var elPesanPin = document.getElementById('pesan-pin');
  var elTombolMasuk = document.getElementById('tombol-masuk');
  var elTombolKeluar = document.getElementById('tombol-keluar');
  var elTombolCetak = document.getElementById('tombol-cetak');
  var elTombolUnduh = document.getElementById('tombol-unduh');
  var elQrGambar = document.getElementById('qr-gambar');
  var elAlamat = document.getElementById('alamat');
  var elTabelPesanan = document.getElementById('tabel-pesanan');
  var elIsiPesanan = document.getElementById('isi-pesanan');
  var elKeteranganPesanan = document.getElementById('keterangan-pesanan');

  var svgTerakhir = '';

  // ── Utilitas pesan ────────────────────────────────────────────────────────
  function tampilkanPesanPin(pesan) {
    elPesanPin.textContent = pesan;
    elPesanPin.classList.add('tampil');
  }
  function sembunyikanPesanPin() {
    elPesanPin.classList.remove('tampil');
  }

  // ── Alur masuk ────────────────────────────────────────────────────────────
  elFormPin.addEventListener('submit', function (e) {
    e.preventDefault();
    sembunyikanPesanPin();

    var pin = elPin.value.trim();
    if (!pin) {
      tampilkanPesanPin('PIN belum diisi.');
      return;
    }

    elTombolMasuk.disabled = true;
    elTombolMasuk.textContent = 'Memeriksa…';

    fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pin }),
    })
      .then(function (r) {
        return r.json().then(function (d) {
          return { status: r.status, data: d };
        });
      })
      .then(function (hasil) {
        var d = hasil.data;
        if (!d || !d.ok || !d.token) {
          throw new Error((d && d.pesan) || 'Tidak bisa masuk.');
        }
        try {
          sessionStorage.setItem(KUNCI_SESI, d.token);
        } catch (err) {
          // Mode privat ketat bisa menolak sessionStorage — lanjutkan tanpa simpan.
        }
        elPin.value = '';
        muatData(d.token);
      })
      .catch(function (err) {
        tampilkanPesanPin(err && err.message ? err.message : 'Terjadi gangguan. Coba lagi.');
      })
      .then(function () {
        elTombolMasuk.disabled = false;
        elTombolMasuk.textContent = 'Masuk';
      });
  });

  // ── Muat data panel ───────────────────────────────────────────────────────
  function muatData(token) {
    fetch('/api/admin?t=' + encodeURIComponent(token))
      .then(function (r) {
        return r.json().then(function (d) {
          return { status: r.status, data: d };
        });
      })
      .then(function (hasil) {
        var d = hasil.data;
        if (!d || !d.ok) {
          // Sesi tidak berlaku lagi -> kembali ke layar PIN.
          try {
            sessionStorage.removeItem(KUNCI_SESI);
          } catch (err) {
            /* abaikan */
          }
          elPanel.classList.add('tersembunyi');
          elLayarPin.classList.remove('tersembunyi');
          tampilkanPesanPin((d && d.pesan) || 'Sesi berakhir. Masukkan PIN lagi.');
          return;
        }
        tampilkanPanel(d);
      })
      .catch(function () {
        elKeteranganPesanan.textContent = 'Gagal memuat data. Muat ulang halaman ini.';
      });
  }

  function tampilkanPanel(d) {
    elLayarPin.classList.add('tersembunyi');
    elPanel.classList.remove('tersembunyi');

    elQrGambar.src = d.qrPng || '';
    elAlamat.textContent = d.alamat || '';
    svgTerakhir = d.qrSvg || '';

    document.title = 'Admin — ' + (d.namaPerusahaan || 'Cetak QR');

    // Peringatkan bila alamatnya masih lokal — QR-nya tidak akan bisa dibuka orang lain.
    if (d.alamat && /localhost|127\.0\.0\.1/i.test(d.alamat)) {
      var peringatan = document.createElement('div');
      peringatan.className = 'pesan pesan--gagal tampil';
      peringatan.style.marginTop = '16px';
      // Dibangun lewat DOM (bukan innerHTML) agar tidak ada celah XSS, dan
      // supaya kebiasaan ini konsisten dengan seluruh berkas.
      var kuat = document.createElement('strong');
      kuat.textContent = 'localhost';
      var kode = document.createElement('code');
      kode.textContent = 'SITUS_URL';
      peringatan.appendChild(document.createTextNode('⚠️ Alamat di QR masih '));
      peringatan.appendChild(kuat);
      peringatan.appendChild(
        document.createTextNode('. QR ini belum bisa dipakai di kemasan. Ubah '),
      );
      peringatan.appendChild(kode);
      peringatan.appendChild(document.createTextNode(' ke domain asli, lalu buka ulang halaman ini.'));

      var areaQr = document.querySelector('.qr-area');
      if (areaQr && areaQr.parentNode) areaQr.parentNode.insertBefore(peringatan, areaQr.nextSibling);
    }

    tampilkanPesanan(d.pesanan || [], d.catatanPesanan || '');
  }

  function tampilkanPesanan(daftar, catatan) {
    if (catatan) {
      elKeteranganPesanan.textContent = 'Daftar pesanan tidak bisa dibaca: ' + catatan;
      return;
    }
    if (!daftar.length) {
      elKeteranganPesanan.textContent = 'Belum ada pesanan yang masuk.';
      return;
    }

    elKeteranganPesanan.textContent = daftar.length + ' pesanan terbaru:';
    elIsiPesanan.innerHTML = '';

    daftar.forEach(function (p) {
      var tr = document.createElement('tr');

      var tdKode = document.createElement('td');
      tdKode.className = 'kode';
      tdKode.textContent = p.kode || '—';

      var tdPenerima = document.createElement('td');
      tdPenerima.textContent = p.penerima || '—';

      var tdPembeli = document.createElement('td');
      tdPembeli.textContent = p.pembeli || '—';

      var tdWaktu = document.createElement('td');
      tdWaktu.className = 'waktu';
      tdWaktu.textContent = formatWaktu(p.dibuat);

      tr.appendChild(tdKode);
      tr.appendChild(tdPenerima);
      tr.appendChild(tdPembeli);
      tr.appendChild(tdWaktu);
      elIsiPesanan.appendChild(tr);
    });

    elTabelPesanan.classList.remove('tersembunyi');
  }

  /** Tampilkan waktu dalam zona Indonesia, dengan bentuk yang ringkas. */
  function formatWaktu(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    try {
      return d.toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return d.toLocaleString('id-ID');
    }
  }

  // ── Tombol ────────────────────────────────────────────────────────────────
  elTombolCetak.addEventListener('click', function () {
    window.print();
  });

  elTombolUnduh.addEventListener('click', function () {
    // Utamakan SVG: vektor, jadi tetap tajam di ukuran cetak berapa pun.
    if (svgTerakhir) {
      var blob = new Blob([svgTerakhir], { type: 'image/svg+xml' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'qr-kemasan.svg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1000);
      return;
    }
    // Cadangan: PNG dari server.
    var sumber = elQrGambar.src;
    if (!sumber) return;
    var tautan = document.createElement('a');
    tautan.href = sumber;
    tautan.download = 'qr-kemasan.png';
    document.body.appendChild(tautan);
    tautan.click();
    document.body.removeChild(tautan);
  });

  elTombolKeluar.addEventListener('click', function () {
    try {
      sessionStorage.removeItem(KUNCI_SESI);
    } catch (err) {
      /* abaikan */
    }
    elPanel.classList.add('tersembunyi');
    elLayarPin.classList.remove('tersembunyi');
    elPin.value = '';
    sembunyikanPesanPin();
    elPin.focus();
    window.scrollTo({ top: 0 });
  });

  // ── Coba lanjutkan sesi yang masih ada ────────────────────────────────────
  try {
    var tersimpan = sessionStorage.getItem(KUNCI_SESI);
    if (tersimpan) muatData(tersimpan);
  } catch (err) {
    /* mode privat ketat — mulai dari layar PIN */
  }
})();
