/**
 * MENCARI ELEMEN YANG MEMBUAT HALAMAN MELUBER (lebih lebar dari layar)
 *
 * KENAPA: di layar HP, kartu-kartu terpotong di sisi kanan. Itu terjadi kalau
 * ada satu elemen yang lebih lebar dari layar — elemen itu "menarik" seluruh
 * halaman sehingga sisanya ikut bergeser dan terpotong.
 *
 * Cara menemukannya: buka halaman di Chrome tanpa tampilan (headless), lalu
 * tanyakan langsung ke peramban elemen mana yang melewati batas layar.
 *
 * CARA PAKAI:
 *   node scripts/cari_luber.mjs <url> <lebar-layar>
 */
import { spawn } from 'node:child_process';

const URL_HALAMAN = process.argv[2] ?? 'https://webcoklat.vercel.app/';
const LEBAR = Number(process.argv[3] ?? 390);
const PORT = 9333;

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const chrome = spawn(
  CHROME,
  [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    `--remote-debugging-port=${PORT}`,
    `--window-size=${LEBAR},900`,
    '--user-data-dir=' + process.cwd() + '/scratch/chrome-profil',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));

async function target() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const daftar = await res.json();
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
  const wsUrl = await target();
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => (ws.onopen = r));

  let id = 0;
  const tertunda = new Map();
  ws.onmessage = (ev) => {
    const pesan = JSON.parse(ev.data);
    if (pesan.id && tertunda.has(pesan.id)) {
      tertunda.get(pesan.id)(pesan);
      tertunda.delete(pesan.id);
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
  await kirim('Emulation.setDeviceMetricsOverride', {
    width: LEBAR,
    height: 900,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await kirim('Page.navigate', { url: URL_HALAMAN });
  await tunggu(3500);

  const ekspresi = `(() => {
    const lebarLayar = document.documentElement.clientWidth;
    const hasil = [];
    for (const el of document.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      // Elemen yang tepi kanannya melewati layar (toleransi 1px)
      if (r.right > lebarLayar + 1 || r.width > lebarLayar + 1) {
        hasil.push({
          tag: el.tagName.toLowerCase(),
          kelas: (el.className && typeof el.className === 'string') ? el.className : '',
          kiri: Math.round(r.left),
          kanan: Math.round(r.right),
          lebar: Math.round(r.width),
          teks: (el.textContent || '').trim().slice(0, 40),
        });
      }
    }
    return {
      lebarLayar,
      lebarDokumen: document.documentElement.scrollWidth,
      lebarBadan: document.body.scrollWidth,
      meluber: document.documentElement.scrollWidth > lebarLayar,
      elemen: hasil.slice(0, 12),
    };
  })()`;

  const balasan = await kirim('Runtime.evaluate', {
    expression: ekspresi,
    returnByValue: true,
    awaitPromise: true,
  });

  const d = balasan.result?.result?.value ?? balasan.result?.value;
  console.log(JSON.stringify(d, null, 1));

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
