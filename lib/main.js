import { VideoTracker } from './video-tracker.js';
import { ProgressBar } from './progress-bar.js';
import { SeekController } from './seek-controller.js';
import { bufferedEndFor, isStalled } from './media-state.js';
import { bottomRadiiFor } from './corner-radius.js';
import { overlayRectsFor, clearSpanFor } from './overlays.js';
import { createSettingsStore, DEFAULTS } from './settings.js';
import { STALL_THRESHOLD_MS, MIN_BAR_WIDTH } from './config.js';

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

  // Elements under body are painted beneath the fullscreen element, so both the bar and
  // the overlays it has to dodge are only meaningful within whichever of the two is live
  const scopeRoot = () => doc.fullscreenElement || doc.body;

  const bar = new ProgressBar(doc);
  bar.mount(scopeRoot());

  // The bar only has to dodge overlays that reach into the band it occupies
  let bandHeight = DEFAULTS.hitZoneHeight;
  const applySettings = (next) => {
    bandHeight = next.hitZoneHeight;
    bar.applySettings(next);
  };

  // Paint defaults first so the storage round-trip does not delay the bar
  applySettings(DEFAULTS);
  const settings = createSettingsStore(storageArea);

  // A change arriving while the initial read is in flight is newer than that read
  let sawChange = false;
  settings.load().then((loaded) => {
    if (!sawChange) applySettings(loaded);
  });
  const unwatchSettings = settings.watch((next) => {
    sawChange = true;
    applySettings(next);
  });

  const seek = new SeekController({ win });

  // The loop only runs while a video is active. Frames queued with nothing to draw still
  // keep the renderer producing them, which costs power on pages that have no video at all.
  const tracker = new VideoTracker((video) => {
    seek.detach();
    cornerKey = '';
    if (!video) {
      bar.hide();
      stopLoop();
      return;
    }
    seek.attach(video, { hit: bar.hitElement, track: bar.trackElement });
    if (!doc.hidden) startLoop();
  }, { doc, win });

  let rafId = 0;
  let running = false;

  // getComputedStyle every frame is wasteful; recompute only when the geometry changes.
  // Position matters as well as size, because which corners are taken depends on whether
  // the clipping ancestor's edges line up with the video's.
  let cornerKey = '';
  const getStyle = (el) => win.getComputedStyle(el);

  function syncCorners(video, rect, span) {
    const key = `${rect.left},${rect.right},${rect.bottom}|${span.left},${span.right}`;
    if (key === cornerKey) return;
    cornerKey = key;
    const radii = bottomRadiiFor(video, getStyle);
    // An end cut short by an overlay no longer sits on the video's corner
    bar.applyCorners({
      left: span.left === rect.left ? radii.left : 0,
      right: span.right === rect.right ? radii.right : 0,
    });
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

    const span = clearSpanFor(rect, bandHeight, overlayRectsFor(scopeRoot(), video));
    if (!span || span.right - span.left < MIN_BAR_WIDTH) {
      bar.hide();
      return;
    }

    syncCorners(video, rect, span);
    bar.syncTo({ left: span.left, width: span.right - span.left, bottom: rect.bottom });
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
    else if (tracker.current) startLoop();
  };

  const onFullscreenChange = () => {
    bar.mount(scopeRoot());
  };

  doc.addEventListener('visibilitychange', onVisibilityChange);
  doc.addEventListener('fullscreenchange', onFullscreenChange);

  // start() evaluates immediately; if it finds a video, onChange starts the loop
  tracker.start();

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
