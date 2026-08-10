import { init } from '../../lib/main.js';

/** A stand-in TimeRanges. */
function fakeTimeRanges(ranges) {
  return {
    length: ranges.length,
    start: (i) => ranges[i][0],
    end: (i) => ranges[i][1],
  };
}

/**
 * Replaces a real <video> element's media properties with controllable values, so layout
 * and pointer behaviour stay real while the media behaviour is deterministic.
 */
function stubVideo(el, { duration, currentTime = 0, bufferedEnd = duration * 0.6 }) {
  let time = currentTime;
  Object.defineProperty(el, 'duration', { get: () => duration, configurable: true });
  Object.defineProperty(el, 'currentTime', {
    get: () => time,
    set: (value) => {
      time = Math.min(duration, Math.max(0, value));
      el.dataset.seekLog = String(Math.round(time * 100) / 100);
    },
    configurable: true,
  });
  Object.defineProperty(el, 'buffered', {
    get: () => fakeTimeRanges([[0, bufferedEnd]]),
    configurable: true,
  });
  Object.defineProperty(el, 'paused', { get: () => false, configurable: true });
  Object.defineProperty(el, 'readyState', { get: () => 4, configurable: true });

  // Advance the clock so the bar visibly moves
  setInterval(() => {
    time = time + 0.1 >= duration ? 0 : time + 0.1;
  }, 100);
}

document.querySelectorAll('video[data-duration]').forEach((el) => {
  stubVideo(el, {
    duration: Number(el.dataset.duration),
    currentTime: Number(el.dataset.start || 0),
  });
});

init();
window.__igrcReady = true;
