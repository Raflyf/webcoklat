/**
 * MENGUJI HALAMAN ADMIN DI SITUS PRODUKSI
 *
 * Memastikan: PIN salah ditolak, PIN benar diterima, dan data QR bisa diambil.
 * PIN dibaca dari `.env`, jadi TIDAK perlu diketik di sini.
 *
 * CARA PAKAI:
 *   npx tsx --env-file=.env scripts/uji_admin.ts
 */
import { config } from '../src/env.js';

const SITUS = (process.argv[2] ?? config.situsUrl).replace(/\/+$/, '');

async function main(): Promise<void> {
  if (!config.adminPin) {
    console.error('ADMIN_PIN belum diisi di .env');
    process.exit(1);
  }

  console.log(`Menguji halaman admin di ${SITUS}\n`);

  // ── 1. PIN salah harus ditolak ──
  const salah = await fetch(`${SITUS}/api/admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '000000' }),
  });
  if (salah.status === 401) {
    console.log('✅ PIN salah ditolak (HTTP 401)');
  } else {
    console.log(`❌ PIN salah menghasilkan HTTP ${salah.status} — seharusnya 401`);
  }

  // ── 2. PIN benar harus diterima ──
  const benar = await fetch(`${SITUS}/api/admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: config.adminPin }),
  });
  const data = (await benar.json()) as Record<string, unknown>;
  if (!data.ok || !data.token) {
    console.log(`❌ PIN benar DITOLAK: ${String(data.pesan ?? '')}`);
    process.exit(1);
  }
  console.log(`✅ PIN benar diterima (sesi ${data.sesiJam} jam)`);

  // ── 3. Ambil data QR ──
  const qr = await fetch(`${SITUS}/api/admin?t=${encodeURIComponent(String(data.token))}`);
  const d = (await qr.json()) as Record<string, unknown>;
  if (!d.ok) {
    console.log(`❌ Gagal mengambil data QR: ${String(d.pesan ?? '')}`);
    process.exit(1);
  }

  const png = String(d.qrPng ?? '');
  const svg = String(d.qrSvg ?? '');
  console.log(`✅ Data QR terambil`);
  console.log(`   alamat QR  : ${d.alamat}`);
  console.log(`   PNG        : ${png.startsWith('data:image/png') ? `ya (${(png.length / 1024).toFixed(0)} KB)` : 'TIDAK ADA'}`);
  console.log(`   SVG        : ${svg.includes('<svg') ? `ya (${(svg.length / 1024).toFixed(1)} KB)` : 'TIDAK ADA'}`);

  const pesanan = (d.pesanan ?? []) as Array<Record<string, string>>;
  console.log(`   pesanan    : ${pesanan.length} terbaru`);
  for (const p of pesanan.slice(0, 5)) {
    console.log(`     ${p.kode} — ${p.penerima} (${p.status})`);
  }
  if (d.catatanPesanan) console.log(`   catatan    : ${String(d.catatanPesanan)}`);

  // ── 4. Token palsu harus ditolak ──
  const palsu = await fetch(`${SITUS}/api/admin?t=palsu.palsu`);
  if (palsu.status === 401) {
    console.log('\n✅ Token palsu ditolak (HTTP 401)');
  } else {
    console.log(`\n❌ Token palsu menghasilkan HTTP ${palsu.status} — seharusnya 401`);
  }

  console.log('\n🎉 Halaman admin berfungsi. Buka ' + SITUS + '/admin.html');
}

main().catch((e) => {
  console.error('Gagal:', e instanceof Error ? e.message : e);
  process.exit(1);
});
