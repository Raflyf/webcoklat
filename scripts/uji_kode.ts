/**
 * MENGUJI SATU KODE PESANAN DI SITUS PRODUKSI
 *
 * Meniru persis yang dilakukan penerima: masukkan kode, lalu pastikan videonya
 * benar-benar bisa dibuka.
 *
 * CARA PAKAI:
 *   npx tsx scripts/uji_kode.ts CH-2ESA7VPV
 */
const KODE = process.argv[2] ?? '';
const SITUS = (process.argv[3] ?? 'https://webcoklat.vercel.app').replace(/\/+$/, '');

async function main(): Promise<void> {
  if (!KODE) {
    console.error('Sertakan kode pesanan. Contoh: npx tsx scripts/uji_kode.ts CH-2ESA7VPV');
    process.exit(1);
  }

  console.log(`Menguji kode ${KODE} di ${SITUS}\n`);

  const cek = await fetch(`${SITUS}/api/cek`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kode: KODE }),
  });
  const data = (await cek.json()) as Record<string, unknown>;

  if (!data.ok) {
    console.log(`❌ Kode DITOLAK: ${String(data.pesan ?? '')}`);
    process.exit(1);
  }

  console.log('✅ Kode diterima');
  console.log(`   judul    : ${data.judul || '(kosong)'}`);
  console.log(`   pengirim : ${data.pengirim || '(kosong)'}`);
  console.log(`   penerima : ${data.penerima || '(kosong)'}`);
  console.log(`   berlaku  : ${data.masaBerlakuJam} jam`);

  const tayang = await fetch(`${SITUS}/api/video?t=${encodeURIComponent(String(data.token))}`);
  if (!tayang.ok) {
    console.log(`\n❌ Video GAGAL dimuat: HTTP ${tayang.status}`);
    process.exit(1);
  }

  const isi = Buffer.from(await tayang.arrayBuffer());
  console.log(`\n✅ Video bisa dibuka`);
  console.log(`   ukuran : ${(isi.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   jenis  : ${tayang.headers.get('content-type')}`);
  console.log(`   geser  : ${tayang.headers.get('accept-ranges') === 'bytes' ? 'didukung' : 'tidak didukung'}`);
  console.log('\n🎉 Kode ini berfungsi penuh. Penerima bisa menonton videonya.');
}

main().catch((e) => {
  console.error('Gagal:', e instanceof Error ? e.message : e);
  process.exit(1);
});
