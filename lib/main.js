import { VideoTracker } from './video-tracker.js';
import { ProgressBar } from './progress-bar.js';
import { SeekController } from './seek-controller.js';
import { bufferedEndFor, isStalled } from './media-state.js';
import { bottomRadiiFor } from './corner-radius.js';
import { createSettingsStore, DEFAULTS } from './settings.js';
import { STALL_THRESHOLD_MS } from './config.js';

const HOST_SELECTOR = '[data-igrc="host"]';

/**
 * playedTime and labelTime differ on purpose: while hovering without pressing, the fill
 * stays at the real position and only the label previews where a click would land.
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

/** Returns null if already injected, so SPA navigation cannot inject twice. */
export function init({ doc = document, win = window, storageArea = null } = {}) {
  if (doc.querySelector(HOST_SELECTOR)) return null;

  const bar = new ProgressBar(doc);
  bar.mount(doc.body);

  // Paint defaults first so the storage round-trip does not delay the bar
  bar.applySettings(DEFAULTS);
  const settings = createSettingsStore(storageArea);

  // A change arriving while the initial read is in flight is newer than that read
  let sawChange = false;
  settings.load().then((loaded) => {
    if (!sawChange) bar.applySettings(loaded);
  });
  const unwatchSettings = settings.watch((next) => {
    sawChange = true;
    bar.applySettings(next);
  });

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

  // getComputedStyle every frame is wasteful; recompute only when the video or its size changes
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

  // Elements under body are painted beneath the fullscreen element
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
