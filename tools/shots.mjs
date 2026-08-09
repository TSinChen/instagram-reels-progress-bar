// 產生 Chrome 線上應用程式商店的 1280x800 截圖。
//
// 為什麼要腳本化：手動截圖在這個專案已經出錯三次——改了名字忘記重拍、
// iframe 高度不夠跑出捲軸、按鈕被切掉。這些都是「看了才會發現」的錯誤，
// 而且每次改 UI 都可能再犯一次。腳本可以在截圖前先斷言，錯了直接失敗，
// 不會安靜地產出一張壞掉的圖。
//
// 零依賴：起一台自己的靜態伺服器，用 CDP 驅動系統上的 Chrome，
// Node 22 內建 WebSocket 與 fetch，不需要 puppeteer。
//
// 執行：node tools/shots.mjs
// 指定 Chrome：CHROME_PATH="C:\\path\\to\\chrome.exe" node tools/shots.mjs
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createStaticServer } from './serve.mjs';

const PORT = 8231;
const WIDTH = 1280;
const HEIGHT = 800;
const OUT_DIR = 'docs/store';
const DEBUG_PORT = 9422;

// ── 要產生哪些圖 ──────────────────────────────────────────

/**
 * 讓進度條停在 hover 狀態，否則截到的是閒置的細線，看不到圓點與時間。
 *
 * 要先等追蹤器真的選到影片才能送指標事件：頁面 readyState 變成 complete 時，
 * SeekController 還沒綁上影片，這時候 pointerenter 會落空。
 */
const HOVER_BAR = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const wait = async (fn, tries = 60) => {
    for (let i = 0; i < tries; i++) { if (fn()) return true; await sleep(100); }
    return false;
  };

  if (!await wait(() => window.__shotReady)) return { ok: false, why: '頁面腳本沒有啟動' };

  const video = document.querySelector('video');
  const host = document.querySelector('[data-igrc="host"]');
  if (!host) return { ok: false, why: '浮層沒有注入' };

  // 等浮層真的貼上影片為止（display 變 block 且寬度對齊）
  const attached = await wait(() =>
    host.style.display === 'block' &&
    host.style.width === video.getBoundingClientRect().width + 'px');
  if (!attached) return { ok: false, why: '浮層沒有貼上影片，追蹤器可能還沒選到它' };

  const hit = host.shadowRoot.querySelector('.hit');
  const root = host.shadowRoot.querySelector('.root');
  const x = hit.getBoundingClientRect().left + hit.getBoundingClientRect().width * 0.62;
  hit.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true, clientX: x }));
  hit.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x }));

  if (!await wait(() => root.classList.contains('is-active'), 20)) {
    return { ok: false, why: '進度條沒有進入 hover 狀態' };
  }
  // 等 120ms 的高度與圓點轉場跑完，不然會截到動畫中間
  await sleep(250);

  const label = host.shadowRoot.querySelector('.label');
  if (getComputedStyle(label).opacity !== '1') return { ok: false, why: '時間標籤沒有顯示' };
  if (getComputedStyle(host.shadowRoot.querySelector('.handle')).transform === 'matrix(0, 0, 0, 0, 0, 0)') {
    return { ok: false, why: '拖曳圓點還沒放大' };
  }
  return { ok: true, note: label.textContent };
})()`;

/** 設定頁那張是用 iframe 嵌 popup，最容易踩到高度不夠而出現捲軸。 */
const CHECK_POPUP = `(async () => {
  const iframe = document.getElementById('popup');
  for (let i = 0; i < 40 && !iframe.contentDocument?.getElementById('reset'); i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
  const doc = iframe.contentDocument;
  const reset = doc.getElementById('reset');
  if (!reset) return { ok: false, why: 'popup 沒有載入完成' };

  const frameH = iframe.getBoundingClientRect().height;
  const contentH = doc.body.scrollHeight;
  if (contentH > frameH + 1) {
    return { ok: false, why: 'popup 內容 ' + contentH + 'px 超出 iframe ' + frameH + 'px，會出現捲軸並切掉底部。改 store-shot-settings.html 的 iframe height。' };
  }
  const resetBottom = reset.getBoundingClientRect().bottom;
  if (resetBottom > frameH + 1) return { ok: false, why: '「恢復預設」被切掉' };

  const host = doc.querySelector('[data-igrc="host"]');
  if (!host) return { ok: false, why: 'popup 的預覽元件沒有掛上' };
  return { ok: true, note: 'iframe ' + frameH + 'px / 內容 ' + contentH + 'px' };
})()`;

const SHOTS = [
  { file: 'screenshot-1-en.png', path: '/test/fixtures/store-shot.html?copy=en', prepare: HOVER_BAR },
  { file: 'screenshot-1-zh.png', path: '/test/fixtures/store-shot.html?copy=zh_TW', prepare: HOVER_BAR },
  { file: 'screenshot-2-en.png', path: '/test/fixtures/store-shot-settings.html?copy=en', prepare: CHECK_POPUP },
  { file: 'screenshot-2-zh.png', path: '/test/fixtures/store-shot-settings.html?copy=zh_TW', prepare: CHECK_POPUP },
];

// ── 找 Chrome ────────────────────────────────────────────

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ];
  const found = candidates.find((p) => p && existsSync(p));
  if (!found) {
    throw new Error('找不到 Chrome。用 CHROME_PATH 環境變數指定執行檔路徑。');
  }
  return found;
}

// ── 極簡 CDP 客戶端 ───────────────────────────────────────

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', () => reject(new Error('CDP 連線失敗')), { once: true });
    });
    return new Cdp(ws);
  }

  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  /** 在頁面裡執行一段會回傳 Promise 的運算式，把結果拿回來。 */
  async run(expression) {
    const { result, exceptionDetails } = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.text || '頁面拋出例外');
    return result.value;
  }

  close() {
    this.ws.close();
  }
}

async function waitFor(fn, { tries = 60, gap = 250, what = '條件' } = {}) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const value = await fn();
      if (value) return value;
    } catch {
      // 還沒好，繼續等
    }
    await new Promise((r) => setTimeout(r, gap));
  }
  throw new Error(`等不到${what}`);
}

/** 從 PNG 標頭讀尺寸，確認輸出真的是 1280x800。 */
function pngSize(buffer) {
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

// ── 主流程 ───────────────────────────────────────────────

const profileDir = join(tmpdir(), `igpb-shots-${process.pid}`);
let server;
let chrome;
let failures = 0;

try {
  server = await createStaticServer(PORT);
  console.log(`靜態伺服器 http://localhost:${PORT}`);

  chrome = spawn(findChrome(), [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profileDir}`,
    '--headless=new',
    `--window-size=${WIDTH},${HEIGHT}`,
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    'about:blank',
  ], { stdio: 'ignore' });

  const version = await waitFor(
    async () => (await fetch(`http://localhost:${DEBUG_PORT}/json/version`)).json(),
    { what: 'Chrome 啟動' },
  );
  console.log(`${version.Browser}\n`);

  const cdp = await Cdp.connect(version.webSocketDebuggerUrl);
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const pageWs = `ws://localhost:${DEBUG_PORT}/devtools/page/${targetId}`;
  const page = await Cdp.connect(pageWs);

  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 1,
    mobile: false,
  });

  mkdirSync(OUT_DIR, { recursive: true });

  for (const shot of SHOTS) {
    process.stdout.write(`${shot.file.padEnd(22)}`);

    await page.send('Page.navigate', { url: `http://localhost:${PORT}${shot.path}` });
    await waitFor(() => page.run('document.readyState === "complete"'), { what: `${shot.file} 載入` });

    const check = await page.run(shot.prepare);
    if (!check.ok) {
      console.log(`✗ ${check.why}`);
      failures += 1;
      continue;
    }

    const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(data, 'base64');
    const size = pngSize(buffer);
    if (!size || size.width !== WIDTH || size.height !== HEIGHT) {
      console.log(`✗ 尺寸不是 ${WIDTH}x${HEIGHT}（實際 ${size ? `${size.width}x${size.height}` : '非 PNG'}）`);
      failures += 1;
      continue;
    }

    writeFileSync(join(OUT_DIR, shot.file), buffer);
    console.log(`✓ ${size.width}x${size.height}  ${(buffer.length / 1024).toFixed(0)} KB  ${check.note}`);
  }

  page.close();
  cdp.close();
} finally {
  if (chrome) chrome.kill();
  if (server) server.close();
  try {
    rmSync(profileDir, { recursive: true, force: true });
  } catch {
    // Chrome 有時還握著檔案，留著不影響下次執行
  }
}

if (failures) {
  console.error(`\n${failures} 張失敗，沒有覆蓋既有檔案。`);
  process.exit(1);
}
console.log(`\n${SHOTS.length} 張都已更新到 ${OUT_DIR}/`);
