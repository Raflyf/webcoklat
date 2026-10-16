/**
 * SCRIPT UNGGAH KONFIGURASI KE VERCEL (satu kali pakai)
 *
 * Mengirim setiap variabel dari `.env` ke Vercel (environment: production).
 *
 * KEAMANAN:
 *   - Nilai TIDAK PERNAH dicetak ke layar, hanya nama variabel dan statusnya.
 *   - Nilai dikirim lewat stdin proses, bukan lewat argumen perintah, supaya
 *     tidak muncul di daftar proses sistem.
 *   - Variabel yang nilainya kosong DILEWATI, bukan dikirim sebagai string kosong.
 *     Mengirim string kosong bisa membuat kode menganggapnya "sudah diisi".
 */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const ENV_FILE = '.env';

/** Baca `.env` menjadi pasangan kunci-nilai. */
function bacaEnv(berkas: string): Array<[string, string]> {
  const hasil: Array<[string, string]> = [];
  for (const baris of fs.readFileSync(berkas, 'utf8').split('\n')) {
    const bersih = baris.trim();
    if (!bersih || bersih.startsWith('#')) continue;
    const idx = bersih.indexOf('=');
    if (idx < 0) continue;
    const kunci = bersih.slice(0, idx).trim();
    let nilai = bersih.slice(idx + 1);

    // Buang tanda kutip pembungkus bila ada (dipakai untuk private key).
    if ((nilai.startsWith('"') && nilai.endsWith('"')) || (nilai.startsWith("'") && nilai.endsWith("'"))) {
      nilai = nilai.slice(1, -1);
    }
    hasil.push([kunci, nilai]);
  }
  return hasil;
}

function vercel(args: string[], masukan?: string): { ok: boolean; pesan: string } {
  // CATATAN WINDOWS: `npx` di Windows adalah berkas `npx.cmd`. Memanggilnya
  // tanpa `shell: true` akan gagal dengan pesan kosong — jadi shell wajib.
  const hasil = spawnSync('npx', ['vercel', ...args], {
    input: masukan,
    encoding: 'utf8',
    shell: true,
    timeout: 60_000,
  });
  const keluaran = `${hasil.stdout ?? ''}${hasil.stderr ?? ''}`;
  return { ok: hasil.status === 0, pesan: keluaran };
}

async function main(): Promise<void> {
  if (!fs.existsSync(ENV_FILE)) {
    console.error('❌ Berkas .env tidak ditemukan.');
    process.exit(1);
  }

  const daftar = bacaEnv(ENV_FILE).filter(([, v]) => v.length > 0);
  console.log(`Mengirim ${daftar.length} variabel ke Vercel (production)...\n`);

  let berhasil = 0;
  let gagal = 0;

  for (const [kunci, nilai] of daftar) {
    // Hapus dulu bila sudah ada, supaya nilainya benar-benar tergantikan.
    // Kegagalan di sini wajar (berarti belum ada) — diabaikan.
    vercel(['env', 'rm', kunci, 'production', '--yes']);

    const hasil = vercel(['env', 'add', kunci, 'production'], nilai);
    if (hasil.ok) {
      console.log(`  ✅ ${kunci.padEnd(24)} (${nilai.length} karakter)`);
      berhasil++;
    } else {
      // Tampilkan hanya baris yang memuat kata kunci error — JANGAN seluruh
      // keluaran, karena bisa memuat nilai yang sedang dikirim.
      const barisError = hasil.pesan
        .split('\n')
        .filter((b) => /error|invalid|failed|not found|missing/i.test(b))
        .slice(0, 2)
        .join(' ')
        .slice(0, 180);
      console.log(`  ❌ ${kunci.padEnd(24)} GAGAL ${barisError}`);
      gagal++;
    }
  }

  console.log(`\nSelesai: ${berhasil} berhasil, ${gagal} gagal.`);
  if (gagal > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error('Gagal:', e);
  process.exit(1);
});
