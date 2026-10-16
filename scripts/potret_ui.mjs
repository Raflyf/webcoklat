/**
 * MEMOTRET HALAMAN PADA UKURAN LAYAR YANG TEPAT
 *
 * KENAPA TIDAK PAKAI `chrome --screenshot`:
 *   Cara itu memakai lebar jendela sistem, dan Chrome di Windows punya lebar
 *   jendela minimum. Akibatnya permintaan 390px menghasilkan tangkapan yang
 *   sebenarnya dirender lebih lebar lalu dipotong — kartu tampak "terpotong di
 *   kanan" padahal halamannya sendiri baik-baik saja. Ini sempat membuat saya
 *   mengejar masalah yang tidak ada.
 *
 *   Cara ini memakai DevTools Protocol: ukuran tampilan diatur eksplisit lewat
 *   Emulation.setDeviceMetricsOverride, jadi hasilnya pasti sesuai permintaan.
 *
 * CARA PAKAI:
 *   node scripts/potret_ui.mjs
 */
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9334;
const KELUAR = 'scratch/ui';

/** Halaman & ukuran yang ingin diperiksa. */
const TANGKAPAN = [
  { nama: 'pc-index', lebar: 1440, tinggi: 950, url: 'https://webcoklat.vercel.app/' },
  { nama: 'hp-index', lebar: 390, tinggi: 900, url: 'https://webcoklat.vercel.app/' },
  { nama: 'pc-kirim', lebar: 1440, tinggi: 1000, url: 'https://webcoklat.vercel.app/kirim.html' },
  { nama: 'hp-kirim', lebar: 390, tinggi: 900, url: 'https://webcoklat.vercel.app/kirim.html' },
  { nama: 'pc-v', lebar: 1440, tinggi: 900, url: 'https://webcoklat.vercel.app/v.html' },
  { nama: 'hp-v', lebar: 390, tinggi: 900, url: 'https://webcoklat.vercel.app/v.html' },
  { nama: 'pc-admin', lebar: 1440, tinggi: 950, url: 'https://webcoklat.vercel.app/admin.html' },
  { nama: 'hp-admin', lebar: 390, tinggi: 900, url: 'https://webcoklat.vercel.app/admin.html' },
  { nama: 'pc-privasi', lebar: 1440, tinggi: 950, url: 'https://webcoklat.vercel.app/privasi.html' },
];

const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${process.cwd()}/scratch/chrome-potret`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

async function wsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const daftar = await r.json();
      const page = daftar.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* belum siap */
    }
    await tunggu(250);
  }
  throw new Error('Chrome tidak siap.');
}

async function main() {
  fs.mkdirSync(KELUAR, { recursive: true });
  const ws = new WebSocket(await wsUrl());
  await new Promise((r) => (ws.onopen = r));

  let id = 0;
  const tertunda = new Map();
  ws.onmessage = (ev) => {
    const p = JSON.parse(ev.data);
    if (p.id && tertunda.has(p.id)) {
      tertunda.get(p.id)(p);
      tertunda.delete(p.id);
    }
  };
  const kirim = (method, params = {}) =>
    new Promise((r) => {
      const n = ++id;
      tertunda.set(n, r);
      ws.send(JSON.stringify({ id: n, method, params }));
    });

  await kirim('Page.enable');
  await kirim('Runtime.enable');

  for (const t of TANGKAPAN) {
    await kirim('Emulation.setDeviceMetricsOverride', {
      width: t.lebar,
      height: t.tinggi,
      deviceScaleFactor: 1,
      mobile: t.lebar < 700,
    });
    await kirim('Page.navigate', { url: t.url });
    await tunggu(2500);

    // Ukur dulu: pastikan tidak ada luber, dan catat lebar isi
    const ukur = await kirim('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const layar = document.documentElement.clientWidth;
        let terlebar = 0, pelakunya = '';
        for (const el of document.querySelectorAll('*')) {
          const r = el.getBoundingClientRect();
          if (r.right > layar + 1 && r.width > terlebar) {
            terlebar = r.width;
            pelakunya = el.tagName.toLowerCase() + '.' + String(el.className || '').split(' ')[0];
          }
        }
        const w = document.querySelector('.wadah');
        return {
          layar,
          dokumen: document.documentElement.scrollWidth,
          wadah: w ? Math.round(w.getBoundingClientRect().width) : null,
          luber: document.documentElement.scrollWidth > layar,
          pelakunya,
        };
      })()`,
    });
    const u = ukur.result?.result?.value ?? {};

    const gambar = await kirim('Page.captureScreenshot', { format: 'png' });
    const data = gambar.result?.data;
    if (data) fs.writeFileSync(`${KELUAR}/${t.nama}.png`, Buffer.from(data, 'base64'));

    const status = u.luber ? `LUBER (${u.pelakunya})` : 'aman';
    console.log(
      `${t.nama.padEnd(12)} layar ${String(u.layar).padStart(4)} | isi ${String(u.wadah).padStart(4)} | dokumen ${String(u.dokumen).padStart(4)} | ${status}`,
    );
  }

  ws.close();
  chrome.kill();
}

main()
  .catch((e) => {
    console.error('Gagal:', e.message);
    chrome.kill();
    process.exit(1);
  })
  .finally(() => setTimeout(() => process.exit(0), 500));
