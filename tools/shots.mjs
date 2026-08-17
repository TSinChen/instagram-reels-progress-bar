// Generates the 1280x800 Chrome Web Store screenshots.
//
// Every shot is asserted before it is written. A failure exits non-zero and leaves the
// existing files untouched. Serves the fixtures itself and drives Chrome over CDP.
//
//   node tools/shots.mjs
//   CHROME_PATH="...\chrome.exe" node tools/shots.mjs
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createStaticServer } from './serve.mjs';

const PORT = 8231;
const WIDTH = 1280;
const HEIGHT = 800;
const OUT_DIR = 'docs/store';
const DEBUG_PORT = 9422;

// ── Shots ────────────────────────────────────────────────

/**
 * Holds the bar in its hover state; otherwise the shot captures the idle hairline.
 * Pointer events only land once the tracker has picked the video, which happens after
 * readyState reaches complete.
 */
const HOVER_BAR = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const wait = async (fn, tries = 60) => {
    for (let i = 0; i < tries; i++) { if (fn()) return true; await sleep(100); }
    return false;
  };

  if (!await wait(() => window.__shotReady)) return { ok: false, why: 'page script never started' };

  const video = document.querySelector('video');
  const host = document.querySelector('[data-igrc="host"]');
  if (!host) return { ok: false, why: 'overlay was not injected' };

  const attached = await wait(() =>
    host.style.display === 'block' &&
    host.style.width === video.getBoundingClientRect().width + 'px');
  if (!attached) return { ok: false, why: 'overlay never aligned to the video' };

  const hit = host.shadowRoot.querySelector('.hit');
  const root = host.shadowRoot.querySelector('.root');
  const x = hit.getBoundingClientRect().left + hit.getBoundingClientRect().width * 0.62;
  hit.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true, clientX: x }));
  hit.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x }));

  if (!await wait(() => root.classList.contains('is-active'), 20)) {
    return { ok: false, why: 'bar never entered its hover state' };
  }
  // Let the transitions settle, or the shot catches them mid-flight
  await sleep(250);

  const label = host.shadowRoot.querySelector('.label');
  if (getComputedStyle(label).opacity !== '1') return { ok: false, why: 'time label is not visible' };
  if (getComputedStyle(host.shadowRoot.querySelector('.handle')).transform === 'matrix(0, 0, 0, 0, 0, 0)') {
    return { ok: false, why: 'handle has not scaled up' };
  }

  // The overlay is not clipped by the container, so it must apply the radii itself
  const frame = video.closest('.phone');
  const want = frame ? parseFloat(getComputedStyle(frame).borderBottomLeftRadius) || 0 : 0;
  const got = parseFloat(getComputedStyle(host).borderBottomLeftRadius) || 0;
  if (Math.abs(want - got) > 0.5) {
    return { ok: false, why: 'bar is not clipped to the video corners (container ' + want + 'px, overlay ' + got + 'px)' };
  }

  return { ok: true, note: label.textContent + '  radius ' + got + 'px' };
})()`;

/** The popup is embedded in an iframe, where a height mismatch shows up as a scrollbar. */
const CHECK_POPUP = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const iframe = document.getElementById('popup');
  // #reset exists as soon as the markup is injected, which is before the popup's module
  // has imported and mounted the preview. __popupReady is set after that import resolves.
  for (let i = 0; i < 60 && !iframe.contentWindow?.__popupReady; i++) await sleep(100);
  const doc = iframe.contentDocument;
  const reset = doc.getElementById('reset');
  if (!reset) return { ok: false, why: 'popup did not finish loading' };

  // A fixed height cannot fit every locale: translated labels wrap at different points.
  // Too short adds a scrollbar and clips the footer, too tall leaves dead space below it.
  iframe.style.height = doc.body.scrollHeight + 'px';
  await sleep(100);

  const frameH = iframe.getBoundingClientRect().height;
  const contentH = doc.body.scrollHeight;
  if (Math.abs(contentH - frameH) > 1) {
    return { ok: false, why: 'popup content is ' + contentH + 'px but the iframe settled at ' + frameH + 'px' };
  }
  const resetBottom = reset.getBoundingClientRect().bottom;
  if (resetBottom > frameH + 1) return { ok: false, why: 'the reset link is clipped' };

  const host = doc.querySelector('[data-igrc="host"]');
  if (!host) return { ok: false, why: 'popup preview did not mount' };

  // The preview behaves as it does on Instagram, so the label and handle only appear
  // under the pointer. A shot of the idle hairline would show none of what is adjustable.
  const hit = host.shadowRoot.querySelector('.hit');
  const rect = hit.getBoundingClientRect();
  const x = rect.left + rect.width * 0.55;
  hit.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true, clientX: x }));
  hit.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x }));

  const root = host.shadowRoot.querySelector('.root');
  for (let i = 0; i < 20 && !root.classList.contains('is-active'); i++) await sleep(50);
  if (!root.classList.contains('is-active')) return { ok: false, why: 'preview never entered its hover state' };
  // Let the transitions settle, or the shot catches them mid-flight
  await sleep(250);

  const label = host.shadowRoot.querySelector('.label');
  if (doc.defaultView.getComputedStyle(label).opacity !== '1') {
    return { ok: false, why: 'preview time label is not visible' };
  }
  return { ok: true, note: 'iframe ' + frameH + 'px / content ' + contentH + 'px  ' + label.textContent };
})()`;

// Every locale under public/_locales gets both shots, so a locale added there is never
// left without store images. still=1 stops the fixtures advancing their playback clocks,
// so a rerun that changed nothing rewrites the same bytes instead of leaving a diff
// nobody can explain.
const LOCALES = readdirSync('public/_locales').sort();

const SHOTS = LOCALES.flatMap((locale) => [
  {
    file: `screenshot-1-${locale}.png`,
    path: `/test/fixtures/store-shot.html?copy=${locale}&still=1`,
    prepare: HOVER_BAR,
    // The English hero is also the site's. Produced here rather than copied, so it cannot drift.
    alsoWrite: locale === 'en' ? ['docs/assets/hero.png'] : [],
  },
  {
    file: `screenshot-2-${locale}.png`,
    path: `/test/fixtures/store-shot-settings.html?copy=${locale}&still=1`,
    prepare: CHECK_POPUP,
  },
]);

// ── Locating Chrome ──────────────────────────────────────

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
    throw new Error('Chrome not found. Set CHROME_PATH to the executable.');
  }
  return found;
}

// ── Minimal CDP client ───────────────────────────────────

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
    // A Chrome that dies mid-command would otherwise leave every caller awaiting a
    // promise that can never settle, and waitFor cannot time that out because it only
    // sleeps between attempts
    const abandon = (why) => {
      const waiting = [...this.pending.values()];
      this.pending.clear();
      waiting.forEach(({ reject }) => reject(new Error(why)));
    };
    ws.addEventListener('close', () => abandon('CDP connection closed'));
    ws.addEventListener('error', () => abandon('CDP connection failed'));
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', () => reject(new Error('CDP connection failed')), { once: true });
    });
    return new Cdp(ws);
  }

  send(method, params = {}) {
    if (this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('CDP connection is not open'));
    }
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  /** Evaluates an expression that resolves to a value. */
  async run(expression) {
    const { result, exceptionDetails } = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.text || 'page threw');
    return result.value;
  }

  close() {
    this.ws.close();
  }
}

async function waitFor(fn, { tries = 60, gap = 250, what = 'condition' } = {}) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const value = await fn();
      if (value) return value;
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, gap));
  }
  throw new Error(`timed out waiting for ${what}`);
}

/** Reads the dimensions from the PNG header. */
function pngSize(buffer) {
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

// ── Main ─────────────────────────────────────────────────

const profileDir = join(tmpdir(), `igpb-shots-${process.pid}`);
let server;
let chrome;
let failures = 0;

try {
  server = await createStaticServer(PORT);
  console.log(`serving http://localhost:${PORT}`);

  // A Chrome left over from an interrupted run would answer on this port, and the
  // script would silently drive that browser instead of the one it spawns
  const inUse = await fetch(`http://localhost:${DEBUG_PORT}/json/version`)
    .then(() => true)
    .catch(() => false);
  if (inUse) {
    throw new Error(`Something is already listening on ${DEBUG_PORT}. Close the leftover Chrome and retry.`);
  }

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
    { what: 'Chrome to start' },
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
    await waitFor(() => page.run('document.readyState === "complete"'), { what: `${shot.file} to load` });

    const check = await page.run(shot.prepare);
    if (!check.ok) {
      console.log(`x ${check.why}`);
      failures += 1;
      continue;
    }

    const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(data, 'base64');
    const size = pngSize(buffer);
    if (!size || size.width !== WIDTH || size.height !== HEIGHT) {
      console.log(`x expected ${WIDTH}x${HEIGHT}, got ${size ? `${size.width}x${size.height}` : 'a non-PNG'}`);
      failures += 1;
      continue;
    }

    const written = [join(OUT_DIR, shot.file), ...(shot.alsoWrite || [])];
    for (const target of written) {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, buffer);
    }
    const extra = written.length > 1 ? `  → ${written.slice(1).join(', ')}` : '';
    console.log(`ok ${size.width}x${size.height}  ${(buffer.length / 1024).toFixed(0)} KB  ${check.note}${extra}`);
  }

  page.close();
  cdp.close();
} finally {
  if (chrome) chrome.kill();
  if (server) server.close();
  try {
    rmSync(profileDir, { recursive: true, force: true });
  } catch {
    // Chrome may still hold a handle
  }
}

if (failures) {
  console.error(`\n${failures} shot(s) failed. Existing files were left untouched.`);
  process.exit(1);
}
console.log(`\nwrote ${SHOTS.length} shots to ${OUT_DIR}/`);
