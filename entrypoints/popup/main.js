import { ProgressBar } from '../../lib/progress-bar.js';
import { SeekController } from '../../lib/seek-controller.js';
import { buildRenderState } from '../../lib/main.js';
import { createSettingsStore, DEFAULTS } from '../../lib/settings.js';

// ── i18n ──────────────────────────────────────────────
for (const el of document.querySelectorAll('[data-i18n]')) {
  const text = chrome.i18n.getMessage(el.dataset.i18n);
  if (text) el.textContent = text;
}

// ── 預覽 ──────────────────────────────────────────────
// 掛真元件配假影片，手感與線上一致，也順便驗證元件本身。
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
  // 固定顯示 hover 狀態：使用者在這裡調的就是那個樣子
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

const savedEl = document.getElementById('saved');
const showLabelEl = document.getElementById('showlabel');

/** 拖曳時只更新畫面，放開才寫 storage——每個像素都寫會撞到頻率上限。 */
const SLIDERS = [
  { key: 'barThickness', input: 'thickness', readout: 'thickness-value' },
  { key: 'handleSize', input: 'handle', readout: 'handle-value' },
  { key: 'hitZoneHeight', input: 'hitzone', readout: 'hitzone-value' },
].map((slider) => ({
  ...slider,
  inputEl: document.getElementById(slider.input),
  readoutEl: document.getElementById(slider.readout),
}));

let current = { ...DEFAULTS };

/** 只畫，不寫 storage。 */
function paint(settings) {
  current = settings;
  for (const { key, inputEl, readoutEl } of SLIDERS) {
    inputEl.value = String(settings[key]);
    readoutEl.textContent = `${settings[key]}px`;
  }
  showLabelEl.checked = settings.showLabel;
  bar.applySettings(settings);
}

let savedTimer = 0;
function flashSaved() {
  savedEl.classList.add('is-shown');
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => savedEl.classList.remove('is-shown'), 1100);
}

/** 先畫再寫入；內容腳本透過 watch 收到。 */
async function update(patch) {
  paint({ ...current, ...patch });
  await store.save(current);
  flashSaved();
}

for (const { key, inputEl } of SLIDERS) {
  inputEl.addEventListener('input', () => {
    paint({ ...current, [key]: Number(inputEl.value) });
  });
  inputEl.addEventListener('change', () => {
    update({ [key]: Number(inputEl.value) });
  });
}

showLabelEl.addEventListener('change', () => {
  update({ showLabel: showLabelEl.checked });
});

document.getElementById('reset').addEventListener('click', () => update({ ...DEFAULTS }));

store.load().then(paint);
