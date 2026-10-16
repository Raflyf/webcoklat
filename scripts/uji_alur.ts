/**
 * UJI ALUR LENGKAP (end-to-end) TERHADAP PRODUKSI
 *
 * Menjalankan persis apa yang dilakukan pengguna sungguhan:
 *   1. Pembeli mengirim data formulir  -> /api/mulai
 *   2. Browser mengunggah video langsung ke Google
 *   3. Pembeli mengabari selesai       -> /api/selesai  (dapat kode)
 *   4. Penerima memasukkan kode        -> /api/cek      (dapat token)
 *   5. Video ditayangkan               -> /api/video    (harus bisa digeser/seek)
 *
 * Ditambah pemeriksaan keamanan: kode salah harus ditolak, dan video TIDAK boleh
 * bisa diakses tanpa token.
 *
 * CARA PAKAI:
 *   npx tsx scripts/uji_alur.ts [berkas-video] [alamat-situs]
 */
import fs from 'node:fs';

const BERKAS = process.argv[2] ?? 'scratch/uji.mp4';
const SITUS = (process.argv[3] ?? 'https://webcoklat.vercel.app').replace(/\/+$/, '');

let lulus = 0;
let gagal = 0;

function ok(pesan: string): void {
  console.log(`  ✅ ${pesan}`);
  lulus++;
}
function tidak(pesan: string): void {
  console.log(`  ❌ ${pesan}`);
  gagal++;
}

async function ambilJson(res: Response): Promise<Record<string, unknown>> {
  const teks = await res.text();
  try {
    return JSON.parse(teks) as Record<string, unknown>;
  } catch {
    return { _mentah: teks.slice(0, 200) };
  }
}

async function main(): Promise<void> {
  if (!fs.existsSync(BERKAS)) {
    console.error(`Berkas video uji tidak ditemukan: ${BERKAS}`);
    process.exit(1);
  }
  const video = fs.readFileSync(BERKAS);
  const ukuranMb = (video.length / 1024 / 1024).toFixed(2);

  console.log(`Menguji alur lengkap ke ${SITUS}`);
  console.log(`Video uji: ${BERKAS} (${ukuranMb} MB)\n`);

  // ── 1. Mulai pesanan ──
  console.log('1. Pembeli mengirim data formulir');
  const namaPenerima = `Uji ${Date.now().toString().slice(-5)}`;
  const mulai = await fetch(`${SITUS}/api/mulai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      namaPembeli: 'Penguji Otomatis',
      namaPenerima,
      judul: 'Video uji alur lengkap',
      pesan: 'Ini pesan uji. Bila kamu melihat ini, alurnya bekerja.',
      namaFile: 'uji.mp4',
      mime: 'video/mp4',
      ukuranByte: video.length,
    }),
  });
  const dataMulai = await ambilJson(mulai);
  if (!dataMulai.ok) {
    tidak(`/api/mulai gagal: ${String(dataMulai.pesan ?? JSON.stringify(dataMulai).slice(0, 200))}`);
    process.exit(1);
  }
  const kode = String(dataMulai.kode);
  const uploadUri = String(dataMulai.uploadUri);
  const sesi = String(dataMulai.sesi);
  ok(`folder dibuat, kode pesanan: ${dataMulai.tampilKode}`);

  // ── 2. Unggah langsung ke Google ──
  console.log('\n2. Mengunggah video langsung ke Google Drive');
  const unggah = await fetch(uploadUri, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4' },
    body: video,
  });
  if (!unggah.ok) {
    tidak(`unggahan gagal: HTTP ${unggah.status} ${(await unggah.text()).slice(0, 200)}`);
    process.exit(1);
  }
  ok(`terunggah (HTTP ${unggah.status})`);

  // ── 3. Selesaikan pesanan ──
  console.log('\n3. Mengabari server bahwa unggahan selesai');
  const selesai = await fetch(`${SITUS}/api/selesai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sesi }),
  });
  const dataSelesai = await ambilJson(selesai);
  if (!dataSelesai.ok) {
    tidak(`/api/selesai gagal: ${String(dataSelesai.pesan ?? JSON.stringify(dataSelesai).slice(0, 200))}`);
    process.exit(1);
  }
  ok(`tercatat di spreadsheet (${dataSelesai.ukuranMb} MB)`);

  // ── 4. Kode SALAH harus ditolak ──
  console.log('\n4. Memastikan kode salah DITOLAK');
  const salah = await fetch(`${SITUS}/api/cek`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kode: 'CH-ZZZZZZZZ' }),
  });
  const dataSalah = await ambilJson(salah);
  if (dataSalah.ok) {
    tidak('kode palsu DITERIMA — ini celah keamanan!');
  } else {
    ok(`ditolak dengan benar (HTTP ${salah.status})`);
  }

  // ── 5. Kode BENAR -> dapat token ──
  console.log('\n5. Penerima memasukkan kode yang benar');
  const cek = await fetch(`${SITUS}/api/cek`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kode }),
  });
  const dataCek = await ambilJson(cek);
  if (!dataCek.ok) {
    tidak(`/api/cek gagal: ${String(dataCek.pesan ?? '')}`);
    process.exit(1);
  }
  const token = String(dataCek.token);
  ok(`kode diterima, token keluar (berlaku ${dataCek.masaBerlakuJam} jam)`);
  ok(`judul: "${dataCek.judul}", pengirim: ${dataCek.pengirim}, penerima: ${dataCek.penerima}`);

  // ── 6. Kode ditulis dengan huruf kecil & tanpa tanda hubung ──
  console.log('\n6. Memastikan ketikan penerima dimaafkan');
  const kodeAcak = kode.toLowerCase().replace(/-/g, '');
  const cekLonggar = await fetch(`${SITUS}/api/cek`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kode: kodeAcak }),
  });
  const dataLonggar = await ambilJson(cekLonggar);
  if (dataLonggar.ok) {
    ok(`kode "${kodeAcak}" tetap diterima`);
  } else {
    tidak(`kode tanpa tanda hubung & huruf kecil DITOLAK: ${String(dataLonggar.pesan ?? '')}`);
  }

  // ── 7. Video tanpa token harus ditolak ──
  console.log('\n7. Memastikan video tidak bisa diakses tanpa token');
  const tanpaToken = await fetch(`${SITUS}/api/video`);
  if (tanpaToken.status === 403) {
    ok('ditolak tanpa token (HTTP 403)');
  } else {
    tidak(`tanpa token menghasilkan HTTP ${tanpaToken.status} — seharusnya 403`);
  }

  const tokenPalsu = await fetch(`${SITUS}/api/video?t=palsu.palsu`);
  if (tokenPalsu.status === 403) {
    ok('token palsu ditolak (HTTP 403)');
  } else {
    tidak(`token palsu menghasilkan HTTP ${tokenPalsu.status} — seharusnya 403`);
  }

  // ── 8. Video ditayangkan ──
  console.log('\n8. Menayangkan video');
  const tayang = await fetch(`${SITUS}/api/video?t=${encodeURIComponent(token)}`);
  if (!tayang.ok) {
    tidak(`gagal menayangkan: HTTP ${tayang.status}`);
  } else {
    const isi = Buffer.from(await tayang.arrayBuffer());
    const jenis = tayang.headers.get('content-type') ?? '';
    ok(`terkirim ${(isi.length / 1024).toFixed(1)} KB, jenis "${jenis}"`);
    if (isi.length === video.length) {
      ok('ukuran sama persis dengan yang diunggah');
    } else {
      tidak(`ukuran berbeda: diunggah ${video.length}, diterima ${isi.length}`);
    }
    if (jenis.startsWith('video/')) {
      ok('jenis isi benar-benar video');
    } else {
      tidak(`jenis isi "${jenis}" bukan video`);
    }
  }

  // ── 9. Geser video (seek) harus didukung ──
  console.log('\n9. Memastikan video bisa digeser (seek)');
  const geser = await fetch(`${SITUS}/api/video?t=${encodeURIComponent(token)}`, {
    headers: { Range: 'bytes=1000-1999' },
  });
  if (geser.status === 206) {
    const potongan = Buffer.from(await geser.arrayBuffer());
    ok(`permintaan sebagian dijawab HTTP 206 (${potongan.length} byte)`);
    const rentang = geser.headers.get('content-range') ?? '';
    if (rentang) ok(`content-range: ${rentang}`);
    else tidak('header content-range tidak ada — pemutar mungkin tidak bisa menggeser');
  } else {
    tidak(`permintaan Range dijawab HTTP ${geser.status}, seharusnya 206`);
  }

  // ── 10. Kode tampil di spreadsheet ──
  console.log('\n10. Memastikan kode tercatat di spreadsheet');
  console.log(`   Kode pesanan uji: ${kode}`);
  console.log('   (buka spreadsheet dan pastikan barisnya ada)');

  console.log('');
  if (gagal === 0) {
    console.log(`🎉 ALUR LENGKAP BEKERJA (${lulus} pemeriksaan lulus).`);
  } else {
    console.log(`⚠️  ${lulus} lulus, ${gagal} GAGAL — lihat ❌ di atas.`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('Gagal menguji:', e);
  process.exit(1);
});
