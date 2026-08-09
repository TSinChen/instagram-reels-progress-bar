import { ProgressBar } from '../../lib/progress-bar.js';
import { SeekController } from '../../lib/seek-controller.js';
import { buildRenderState } from '../../lib/main.js';
import { createSettingsStore, DEFAULTS, COLOR_PRESETS } from '../../lib/settings.js';

// ── i18n ──────────────────────────────────────────────
for (const el of document.querySelectorAll('[data-i18n]')) {
  const text = chrome.i18n.getMessage(el.dataset.i18n);
  if (text) el.textContent = text;
}

// ── 預覽：掛真正的元件，配一支假影片 ────────────────────
//
// 用真元件而不是靜態示意圖，好處是預覽的手感與實際完全一致，
// 而且順便驗證了元件本身。假影片只要有這幾個屬性就夠了。
const PREVIEW_DURATION = 32;

const fakeVideo = {
  duration: PREVIEW_DURATION,
  currentTime: 12,
  paused: false,
  readyState: 4,
  buffered: { length: 1, start: () => 0, end: () => PREVIEW_DURATION * 0.72 },
};

const stage = document.getElementById('stage');
const bar = new ProgressBar(document);
bar.mount(document.body);

const seek = new SeekController({ win: window });
seek.attach(fakeVideo, { hit: bar.hitElement, track: bar.trackElement });

function frame() {
  requestAnimationFrame(frame);
  bar.syncTo(stage.getBoundingClientRect());
  const state = buildRenderState(fakeVideo, seek, Date.now());
  // 預覽固定顯示 hover 狀態：使用者在這裡調的就是那個樣子，
  // 給他看閒置的 3px 細線沒有意義。
  state.active = true;
  bar.render(state);
}
requestAnimationFrame(frame);

// 讓假影片自己走，預覽才像在播放
setInterval(() => {
  if (seek.dragging) return;
  fakeVideo.currentTime += 0.1;
  if (fakeVideo.currentTime >= PREVIEW_DURATION) fakeVideo.currentTime = 0;
}, 100);

// ── 設定 ──────────────────────────────────────────────
const store = createSettingsStore(chrome.storage.sync);

const colorsEl = document.getElementById('colors');
const hitzoneEl = document.getElementById('hitzone');
const hitzoneValueEl = document.getElementById('hitzone-value');
const showLabelEl = document.getElementById('showlabel');
const resetEl = document.getElementById('reset');
const savedEl = document.getElementById('saved');

let current = { ...DEFAULTS };

/** 把設定畫到控制項與預覽上。不寫 storage。 */
function paint(settings) {
  current = settings;

  for (const btn of colorsEl.querySelectorAll('.swatch')) {
    btn.setAttribute('aria-checked', String(btn.dataset.color === settings.color));
  }
  // UI 的強調色跟著使用者選的進度條顏色，選了就立刻有回饋
  document.documentElement.style.setProperty('--accent', COLOR_PRESETS[settings.color].played);

  hitzoneEl.value = String(settings.hitZoneHeight);
  hitzoneValueEl.textContent = `${settings.hitZoneHeight}px`;
  showLabelEl.checked = settings.showLabel;

  bar.applySettings(settings);
}

let savedTimer = 0;
function flashSaved() {
  savedEl.classList.add('is-shown');
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => savedEl.classList.remove('is-shown'), 1100);
}

/** 立刻反映在畫面上，再寫入 storage；內容腳本會透過 watch 收到。 */
async function update(patch) {
  paint({ ...current, ...patch });
  await store.save(current);
  flashSaved();
}

colorsEl.addEventListener('click', (event) => {
  const btn = event.target.closest('.swatch');
  if (btn) update({ color: btn.dataset.color });
});

// 拖曳滑桿時只更新畫面，放開才寫 storage，避免每個像素都打一次 storage
hitzoneEl.addEventListener('input', () => {
  paint({ ...current, hitZoneHeight: Number(hitzoneEl.value) });
});
hitzoneEl.addEventListener('change', () => {
  update({ hitZoneHeight: Number(hitzoneEl.value) });
});

showLabelEl.addEventListener('change', () => {
  update({ showLabel: showLabelEl.checked });
});

resetEl.addEventListener('click', () => update({ ...DEFAULTS }));

store.load().then(paint);
