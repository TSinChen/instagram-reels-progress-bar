import { VideoTracker } from './video-tracker.js';
import { ProgressBar } from './progress-bar.js';
import { SeekController } from './seek-controller.js';
import { bufferedEndFor, isStalled } from './media-state.js';
import { STALL_THRESHOLD_MS } from './config.js';

const HOST_SELECTOR = '[data-igrc="host"]';

/**
 * 組出 ProgressBar.render 需要的狀態。
 *
 * playedTime 與 labelTime 刻意分開：只是 hover 還沒按下去時，
 * 進度條要停在真實播放位置，只有標籤跟著指標走預告目的地。
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

/**
 * 啟動整個功能。回傳 teardown 供測試與熱重載使用。
 * 已經注入過就回傳 null，避免 Instagram 的 SPA 導航造成重複注入。
 */
export function init({ doc = document, win = window } = {}) {
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
