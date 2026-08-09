import { VideoTracker } from './video-tracker.js';
import { ProgressBar } from './progress-bar.js';
import { SeekController } from './seek-controller.js';
import { bufferedEndFor, isStalled } from './media-state.js';
import { bottomRadiiFor } from './corner-radius.js';
import { createSettingsStore, DEFAULTS } from './settings.js';
import { STALL_THRESHOLD_MS } from './config.js';

const HOST_SELECTOR = '[data-igrc="host"]';

/**
 * playedTime 與 labelTime 刻意分開：hover 還沒按下去時進度條要停在真實位置，
 * 只有標籤跟著指標走預告目的地。
 */
export function buildRenderState(video, seek, now) {
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

/** 已經注入過就回傳 null，避免 SPA 導航造成重複注入。 */
export function init({ doc = document, win = window, storageArea = null } = {}) {
  if (doc.querySelector(HOST_SELECTOR)) return null;

  const bar = new ProgressBar(doc);
  bar.mount(doc.body);

  // 先用預設值畫，storage 讀回來再套，避免進度條晚出現
  bar.applySettings(DEFAULTS);
  const settings = createSettingsStore(storageArea);
  settings.load().then((loaded) => bar.applySettings(loaded));
  const unwatchSettings = settings.watch((next) => bar.applySettings(next));

  const seek = new SeekController({ win });

  const tracker = new VideoTracker((video) => {
    seek.detach();
    cornerKey = '';
    if (!video) {
      bar.hide();
      return;
    }
    seek.attach(video, { hit: bar.hitElement, track: bar.trackElement });
  }, { doc, win });

  let rafId = 0;
  let running = false;

  // 每幀讀 getComputedStyle 太浪費，只在影片或尺寸變了才重算
  let cornerKey = '';
  const getStyle = (el) => win.getComputedStyle(el);

  function syncCorners(video, rect) {
    const key = `${rect.width}x${rect.height}`;
    if (key === cornerKey) return;
    cornerKey = key;
    bar.applyCorners(bottomRadiiFor(video, getStyle));
  }

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

    syncCorners(video, rect);
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

  // 全螢幕時掛在 body 底下的元素會被蓋住
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
      unwatchSettings();
      doc.removeEventListener('visibilitychange', onVisibilityChange);
      doc.removeEventListener('fullscreenchange', onFullscreenChange);
      tracker.stop();
      seek.detach();
      bar.destroy();
    },
  };
}
