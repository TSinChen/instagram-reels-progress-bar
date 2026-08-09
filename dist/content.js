// 由 tools/build.mjs 自動產生，請勿直接編輯。
// 原始碼在 src/content/，改完請重新執行：node tools/build.mjs

(() => {
'use strict';

// ── src/content/geometry.js 
// 純幾何計算。這個模組不碰 DOM，只吃普通物件，方便測試。

/**
 * 矩形與視窗的交集面積。完全不相交時回傳 0。
 */
function visibleArea(rect, viewport) {
  const left = Math.max(rect.left, 0);
  const top = Math.max(rect.top, 0);
  const right = Math.min(rect.right, viewport.width);
  const bottom = Math.min(rect.bottom, viewport.height);
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return 0;
  return width * height;
}

/**
 * 指標 x 座標在進度條上的比例，夾在 0..1。
 * 寬度為 0 或 barRect 不存在時回傳 0，避免除以零產生 NaN。
 */
function ratioFromPointerX(pointerX, barRect) {
  if (!barRect || !(barRect.width > 0)) return 0;
  const raw = (pointerX - barRect.left) / barRect.width;
  if (raw < 0) return 0;
  if (raw > 1) return 1;
  return raw;
}

/**
 * 比例換算成秒數。
 * duration 無效（未載入中繼資料、直播的 Infinity）時回傳 0。
 */
function timeFromRatio(ratio, duration) {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return ratio * duration;
}

// ── src/content/config.js 
// 所有可調數值集中在這裡。其他模組不得寫死尺寸、顏色或時間常數。

// ── 版面尺寸 ──────────────────────────────────────────────
/** Shadow host 的高度。下緣對齊影片下緣，上半部用來放時間標籤。 */
const HOST_HEIGHT = 48;
/** host 內部真正接收指標事件的底部條帶高度。這是唯一會攔截 Instagram 原生點擊的區域。 */
const HIT_ZONE_HEIGHT = 16;
/** 閒置時的進度條高度。 */
const BAR_HEIGHT_IDLE = 3;
/** hover 或拖曳時的進度條高度。 */
const BAR_HEIGHT_HOVER = 6;
/** 拖曳圓點直徑。 */
const HANDLE_SIZE = 12;

// ── 顏色 ─────────────────────────────────────────────────
// 已播放用白色而非 YouTube 的紅色，比較貼合 Instagram 的視覺調性。
// 想換成紅色改成 '#ff0033'，想換成 Instagram 藍改成 '#0095F6'。
const COLOR_PLAYED = '#ffffff';
const COLOR_BUFFERED = 'rgba(255, 255, 255, 0.45)';
const COLOR_TRACK = 'rgba(255, 255, 255, 0.25)';
const COLOR_HANDLE = '#ffffff';

// ── 作用中影片的選取規則 ───────────────────────────────────
/** 小於這個寬或高的 video 元素視為縮圖或隱藏的預載元素，直接略過。 */
const MIN_VIDEO_SIZE = 80;
/** 影片露出比例低於這個值就不列入候選。 */
const MIN_VISIBLE_RATIO = 0.5;
/** 兩支影片的可視面積差距在這個比例內視為平手，此時優先選播放中的那支。 */
const AREA_TIE_TOLERANCE = 0.05;

// ── 時間常數 ─────────────────────────────────────────────
/** 重新評估作用中影片的間隔。 */
const SELECT_INTERVAL_MS = 200;
/** DOM 變動後延遲多久才重新評估，避免 React 連續重繪時空轉。 */
const MUTATION_DEBOUNCE_MS = 150;
/** seek 後超過這個時間仍未取得足夠資料就顯示卡頓指示。 */
const STALL_THRESHOLD_MS = 1500;

// ── 其他 ─────────────────────────────────────────────────
/** 浮層的 z-index。刻意略低於 int32 上限，留空間給真正需要蓋在最上層的東西。 */
const Z_INDEX = 2147483000;

// ── src/content/video-tracker.js 
/**
 * 從一堆 video 元素裡選出「使用者現在正在看的那支」。
 *
 * 這一條規則同時涵蓋 Reels 專頁的上下滑、首頁 feed 的捲動、
 * 以及貼文燈箱，不需要為個別頁面寫特例。
 */
function pickActiveVideo(videos, viewport) {
  let best = null;

  for (const video of videos) {
    const rect = video.getBoundingClientRect();
    if (rect.width < MIN_VIDEO_SIZE || rect.height < MIN_VIDEO_SIZE) continue;

    const area = visibleArea(rect, viewport);
    const ratio = area / (rect.width * rect.height);
    if (ratio < MIN_VISIBLE_RATIO) continue;

    const candidate = { video, area };
    if (best === null || beats(candidate, best)) {
      best = candidate;
    }
  }

  return best ? best.video : null;
}

/** 候選是否勝過目前最佳。面積接近時由播放狀態決勝。 */
function beats(candidate, current) {
  const tie = Math.abs(candidate.area - current.area) <= current.area * AREA_TIE_TOLERANCE;
  if (tie) {
    return !candidate.video.paused && current.video.paused;
  }
  return candidate.area > current.area;
}

/**
 * 持續追蹤當前作用中的影片，變更時呼叫 onChange。
 *
 * 三個觸發來源：固定間隔的定時器、捲動事件、DOM 變動。
 * 三者都只是「該重新評估了」的訊號，實際判斷一律走 pickActiveVideo。
 */
class VideoTracker {
  constructor(onChange, { doc = document, win = window } = {}) {
    this.onChange = onChange;
    this.doc = doc;
    this.win = win;
    this.current = null;
    this._intervalId = null;
    this._mutationTimerId = null;
    this._observer = null;
    this._onScroll = () => this.evaluate();
  }

  start() {
    this.evaluate();

    this._intervalId = this.win.setInterval(() => this.evaluate(), SELECT_INTERVAL_MS);

    // capture 為 true 才收得到 Instagram 內層可捲動容器的捲動事件
    this.win.addEventListener('scroll', this._onScroll, { passive: true, capture: true });

    if (typeof MutationObserver === 'function' && this.doc.body) {
      this._observer = new MutationObserver(() => {
        this.win.clearTimeout(this._mutationTimerId);
        this._mutationTimerId = this.win.setTimeout(
          () => this.evaluate(),
          MUTATION_DEBOUNCE_MS,
        );
      });
      this._observer.observe(this.doc.body, { childList: true, subtree: true });
    }
  }

  stop() {
    if (this._intervalId !== null) {
      this.win.clearInterval(this._intervalId);
      this._intervalId = null;
    }
    this.win.clearTimeout(this._mutationTimerId);
    this._mutationTimerId = null;
    this.win.removeEventListener('scroll', this._onScroll, { capture: true });
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    this.current = null;
  }

  evaluate() {
    const videos = this.doc.querySelectorAll('video');
    const viewport = { width: this.win.innerWidth, height: this.win.innerHeight };
    const next = pickActiveVideo(videos, viewport);
    if (next !== this.current) {
      this.current = next;
      this.onChange(next);
    }
  }
}

// ── src/content/styles.js 
/**
 * Shadow root 的樣式。
 * `:host { all: initial }` 連繼承屬性都擋掉，避免 Instagram 的全域字型或
 * 行高設定影響到我們；host 本身的定位是用 inline style 設的，優先權更高不受影響。
 */
const CSS = `
:host {
  all: initial;
}

.root {
  position: absolute;
  inset: 0;
  pointer-events: none;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans TC", sans-serif;
}

/* 唯一會攔截 Instagram 原生點擊的區域，只有影片底部這條 */
.hit {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: ${HIT_ZONE_HEIGHT}px;
  pointer-events: auto;
  cursor: pointer;
  touch-action: none;
}

.track {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: ${BAR_HEIGHT_IDLE}px;
  background: ${COLOR_TRACK};
  transition: height 120ms ease-out;
  overflow: hidden;
}

.root.is-active .track {
  height: ${BAR_HEIGHT_HOVER}px;
}

.buffered,
.played {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 0;
}

.buffered {
  background: ${COLOR_BUFFERED};
}

.played {
  background: ${COLOR_PLAYED};
}

.handle {
  position: absolute;
  left: 0;
  bottom: ${BAR_HEIGHT_HOVER / 2}px;
  width: ${HANDLE_SIZE}px;
  height: ${HANDLE_SIZE}px;
  margin-left: ${-HANDLE_SIZE / 2}px;
  margin-bottom: ${-HANDLE_SIZE / 2}px;
  border-radius: 50%;
  background: ${COLOR_HANDLE};
  transform: scale(0);
  transition: transform 120ms ease-out;
}

.root.is-active .handle {
  transform: scale(1);
}

.root.is-dragging .handle {
  transform: scale(1.15);
}

.handle.is-stalled::after {
  content: '';
  position: absolute;
  inset: -5px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #ffffff;
  animation: igrc-spin 700ms linear infinite;
}

@keyframes igrc-spin {
  to { transform: rotate(360deg); }
}

.label {
  position: absolute;
  left: 8px;
  bottom: 12px;
  font-size: 11px;
  line-height: 1;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  opacity: 0;
  transition: opacity 120ms ease-out;
  white-space: nowrap;
}

.root.is-active .label {
  opacity: 1;
}
`;

// ── src/content/time-format.js 
/**
 * 把秒數格式化成 M:SS。
 * 超過一小時不進位成 H:MM:SS，因為 Instagram 影片不會這麼長，
 * 統一格式讓標籤寬度可預測。
 */
function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

// ── src/content/progress-bar.js 
const HOST_MARKER = 'data-igrc';

/**
 * 進度條的 UI。只負責畫，不知道 video 的存在，也不處理任何互動邏輯。
 * 所有狀態都由 render 的參數傳進來。
 */
class ProgressBar {
  constructor(doc = document) {
    this.doc = doc;
    this.host = null;
    this.rootEl = null;
    this.parts = {};
    this._visible = false;
  }

  get hitElement() {
    return this.parts.hit || null;
  }

  get trackElement() {
    return this.parts.track || null;
  }

  /**
   * 建立 host 並掛到 parent。
   * 已經建立過就只做搬家，這樣進出全螢幕時不會重建整個 UI。
   */
  mount(parent = this.doc.body) {
    if (this.host) {
      if (this.host.parentNode !== parent) parent.appendChild(this.host);
      return;
    }

    const host = this.doc.createElement('div');
    host.setAttribute(HOST_MARKER, 'host');
    host.style.cssText = [
      'position: fixed',
      'left: 0',
      'top: 0',
      'width: 0',
      `height: ${HOST_HEIGHT}px`,
      `z-index: ${Z_INDEX}`,
      'pointer-events: none',
      'display: none',
      'margin: 0',
      'padding: 0',
    ].join('; ');

    const shadow = host.attachShadow({ mode: 'open' });

    const style = this.doc.createElement('style');
    style.textContent = CSS;

    const rootEl = this.doc.createElement('div');
    rootEl.className = 'root';
    rootEl.innerHTML = [
      '<div class="label"></div>',
      '<div class="track"><div class="buffered"></div><div class="played"></div></div>',
      '<div class="handle"></div>',
      '<div class="hit"></div>',
    ].join('');

    shadow.append(style, rootEl);
    parent.appendChild(host);

    this.host = host;
    this.rootEl = rootEl;
    this.parts = {
      label: rootEl.querySelector('.label'),
      track: rootEl.querySelector('.track'),
      buffered: rootEl.querySelector('.buffered'),
      played: rootEl.querySelector('.played'),
      handle: rootEl.querySelector('.handle'),
      hit: rootEl.querySelector('.hit'),
    };
  }

  /** 把 host 對齊到影片矩形，下緣貼齊影片下緣。 */
  syncTo(rect) {
    if (!this.host) return;
    this.host.style.left = `${rect.left}px`;
    this.host.style.top = `${rect.bottom - HOST_HEIGHT}px`;
    this.host.style.width = `${rect.width}px`;
  }

  render(state) {
    if (!this.host) return;

    const { duration } = state;
    if (!Number.isFinite(duration) || duration <= 0) {
      this.hide();
      return;
    }
    this.show();

    const playedRatio = clamp01(state.playedTime / duration);
    const bufferedRatio = clamp01(state.bufferedEnd / duration);

    this.parts.played.style.width = `${playedRatio * 100}%`;
    this.parts.buffered.style.width = `${bufferedRatio * 100}%`;
    this.parts.handle.style.left = `${playedRatio * 100}%`;

    this.rootEl.classList.toggle('is-active', Boolean(state.active));
    this.rootEl.classList.toggle('is-dragging', Boolean(state.dragging));
    this.parts.handle.classList.toggle('is-stalled', Boolean(state.stalled));

    this.parts.label.textContent = `${formatTime(state.labelTime)} / ${formatTime(duration)}`;
  }

  show() {
    if (!this.host || this._visible) return;
    this.host.style.display = 'block';
    this._visible = true;
  }

  hide() {
    if (!this.host || !this._visible) return;
    this.host.style.display = 'none';
    this._visible = false;
  }

  destroy() {
    if (this.host) this.host.remove();
    this.host = null;
    this.rootEl = null;
    this.parts = {};
    this._visible = false;
  }
}

function clamp01(value) {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value > 1 ? 1 : value;
}

// ── src/content/seek-controller.js 
/**
 * 把感應區上的指標事件翻譯成對 video.currentTime 的寫入。
 *
 * 這個模組不碰 UI，只維護互動狀態（hover / dragging / 目標時間），
 * 由 main.js 的渲染迴圈去讀這些狀態決定怎麼畫。
 */
class SeekController {
  constructor({ win = window, now = () => Date.now() } = {}) {
    this.win = win;
    this.now = now;

    this.video = null;
    this.hit = null;
    this.track = null;

    this.hovering = false;
    this.dragging = false;
    this.hoverTime = 0;
    this.dragTime = 0;
    this.lastSeekAt = 0;

    this._pendingSeek = null;
    this._rafId = 0;
    this._pointerId = null;

    this._onPointerEnter = () => { this.hovering = true; };
    this._onPointerLeave = () => { if (!this.dragging) this.hovering = false; };
    this._onPointerMove = (event) => this._handleMove(event);
    this._onPointerDown = (event) => this._handleDown(event);
    this._onPointerUp = (event) => this._handleUp(event);
    this._onPointerCancel = (event) => this._handleUp(event);
    this._onClick = (event) => {
      event.stopPropagation();
      event.preventDefault();
    };
  }

  attach(video, { hit, track }) {
    this.detach();
    this.video = video;
    this.hit = hit;
    this.track = track;

    hit.addEventListener('pointerenter', this._onPointerEnter);
    hit.addEventListener('pointerleave', this._onPointerLeave);
    hit.addEventListener('pointermove', this._onPointerMove);
    hit.addEventListener('pointerdown', this._onPointerDown);
    hit.addEventListener('pointerup', this._onPointerUp);
    hit.addEventListener('pointercancel', this._onPointerCancel);
    hit.addEventListener('click', this._onClick);
  }

  detach() {
    if (this.hit) {
      this.hit.removeEventListener('pointerenter', this._onPointerEnter);
      this.hit.removeEventListener('pointerleave', this._onPointerLeave);
      this.hit.removeEventListener('pointermove', this._onPointerMove);
      this.hit.removeEventListener('pointerdown', this._onPointerDown);
      this.hit.removeEventListener('pointerup', this._onPointerUp);
      this.hit.removeEventListener('pointercancel', this._onPointerCancel);
      this.hit.removeEventListener('click', this._onClick);
    }
    this.video = null;
    this.hit = null;
    this.track = null;
    this.hovering = false;
    this.dragging = false;
    this.hoverTime = 0;
    this.dragTime = 0;
    this.lastSeekAt = 0;
    this._pendingSeek = null;
    this._pointerId = null;
  }

  /** 資料補齊後由 main.js 呼叫，讓卡頓指示消失。 */
  clearSeekMark() {
    this.lastSeekAt = 0;
  }

  _timeAt(clientX) {
    if (!this.video || !this.track) return 0;
    const rect = this.track.getBoundingClientRect();
    const ratio = ratioFromPointerX(clientX, rect);
    return timeFromRatio(ratio, this.video.duration);
  }

  _handleMove(event) {
    const time = this._timeAt(event.clientX);
    if (this.dragging) {
      this.dragTime = time;
      this._scheduleSeek(time);
    } else {
      this.hoverTime = time;
    }
  }

  _handleDown(event) {
    if (!this.video) return;
    event.preventDefault();
    event.stopPropagation();

    this.dragging = true;
    this.hovering = true;
    this._pointerId = event.pointerId;

    // 擷取指標，這樣拖到影片外面甚至視窗外面都還收得到 pointermove
    if (typeof this.hit.setPointerCapture === 'function') {
      try {
        this.hit.setPointerCapture(event.pointerId);
      } catch {
        // 某些情況下指標已經失效，忽略即可
      }
    }

    const time = this._timeAt(event.clientX);
    this.dragTime = time;
    this._scheduleSeek(time);
  }

  _handleUp(event) {
    if (!this.dragging) return;
    event.stopPropagation();

    const time = this._timeAt(event.clientX);
    this.dragTime = time;

    // 放開的位置必須精確，不等下一個 frame，直接寫入
    this._pendingSeek = time;
    this._commitSeek();

    if (this._pointerId !== null && typeof this.hit.releasePointerCapture === 'function') {
      try {
        this.hit.releasePointerCapture(this._pointerId);
      } catch {
        // 指標已釋放，忽略
      }
    }
    this._pointerId = null;
    this.dragging = false;
  }

  /** 把寫入節流到每個 animation frame 最多一次。 */
  _scheduleSeek(time) {
    this._pendingSeek = time;
    if (this._rafId) return;
    this._rafId = this.win.requestAnimationFrame(() => {
      this._rafId = 0;
      this._commitSeek();
    });
  }

  _commitSeek() {
    if (this._pendingSeek === null || !this.video) return;
    const time = this._pendingSeek;
    this._pendingSeek = null;
    try {
      this.video.currentTime = time;
      this.lastSeekAt = this.now();
    } catch {
      // 播放器在某些狀態下會拒絕寫入，忽略這一次即可
    }
  }
}

// ── src/content/media-state.js 
// 從 video 元素讀出播放狀態的純邏輯。吃普通物件，不需要真的 video 元素。

/**
 * 目前播放位置所在的那段緩衝區的終點秒數。
 * Instagram 用 MSE 串流，buffered 可能有多段不連續的區間，
 * 我們要顯示的是「從現在往後能連續播到哪」。
 * 位置落在空隙時退而回傳最後一段的終點。
 */
function bufferedEndFor(video) {
  const buffered = video.buffered;
  if (!buffered || buffered.length === 0) return 0;
  const t = video.currentTime;
  for (let i = 0; i < buffered.length; i += 1) {
    if (t >= buffered.start(i) && t <= buffered.end(i)) {
      return buffered.end(i);
    }
  }
  return buffered.end(buffered.length - 1);
}

/**
 * seek 之後是否卡在等資料。
 * readyState >= 3（HAVE_FUTURE_DATA）代表能繼續播，不算卡頓。
 * 使用者自己按暫停也不算。
 */
function isStalled(video, lastSeekAt, now, thresholdMs) {
  if (!lastSeekAt) return false;
  if (video.readyState >= 3) return false;
  if (video.paused) return false;
  return now - lastSeekAt > thresholdMs;
}

// ── src/content/main.js ─────────────────────────────────────────
const HOST_SELECTOR = '[data-igrc="host"]';

/**
 * 組出 ProgressBar.render 需要的狀態。
 *
 * playedTime 與 labelTime 刻意分開：只是 hover 還沒按下去時，
 * 進度條要停在真實播放位置，只有標籤跟著指標走預告目的地。
 */
function buildRenderState(video, seek, now) {
  const playedTime = seek.dragging ? seek.dragTime : video.currentTime;

  let labelTime = video.currentTime;
  if (seek.dragging) labelTime = seek.dragTime;
  else if (seek.hovering) labelTime = seek.hoverTime;

  const stalled = isStalled(video, seek.lastSeekAt, now, STALL_THRESHOLD_MS);
  if (!stalled && seek.lastSeekAt && video.readyState >= 3) {
    seek.clearSeekMark();
  }

  return {
    duration: video.duration,
    playedTime,
    labelTime,
    bufferedEnd: bufferedEndFor(video),
    active: seek.hovering || seek.dragging,
    dragging: seek.dragging,
    stalled,
  };
}

/**
 * 啟動整個功能。回傳 teardown 供測試與熱重載使用。
 * 已經注入過就回傳 null，避免 Instagram 的 SPA 導航造成重複注入。
 */
function init({ doc = document, win = window } = {}) {
  if (doc.querySelector(HOST_SELECTOR)) return null;

  const bar = new ProgressBar(doc);
  bar.mount(doc.body);

  const seek = new SeekController({ win });

  const tracker = new VideoTracker((video) => {
    seek.detach();
    if (!video) {
      bar.hide();
      return;
    }
    seek.attach(video, { hit: bar.hitElement, track: bar.trackElement });
  }, { doc, win });

  let rafId = 0;
  let running = false;

  function frame() {
    if (!running) return;
    rafId = win.requestAnimationFrame(frame);

    const video = tracker.current;
    if (!video || video.isConnected === false) {
      bar.hide();
      return;
    }

    const rect = video.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      bar.hide();
      return;
    }

    bar.syncTo(rect);
    bar.render(buildRenderState(video, seek, Date.now()));
  }

  function startLoop() {
    if (running) return;
    running = true;
    rafId = win.requestAnimationFrame(frame);
  }

  function stopLoop() {
    running = false;
    if (rafId) win.cancelAnimationFrame(rafId);
    rafId = 0;
  }

  const onVisibilityChange = () => {
    if (doc.hidden) stopLoop();
    else startLoop();
  };

  // 進入全螢幕後，掛在 body 底下的元素會被蓋住，必須改掛到全螢幕元素裡
  const onFullscreenChange = () => {
    bar.mount(doc.fullscreenElement || doc.body);
  };

  doc.addEventListener('visibilitychange', onVisibilityChange);
  doc.addEventListener('fullscreenchange', onFullscreenChange);

  tracker.start();
  startLoop();

  return {
    teardown() {
      stopLoop();
      doc.removeEventListener('visibilitychange', onVisibilityChange);
      doc.removeEventListener('fullscreenchange', onFullscreenChange);
      tracker.stop();
      seek.detach();
      bar.destroy();
    },
  };
}

// ── 啟動 ──
init();
})();
