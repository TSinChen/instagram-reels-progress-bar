// Replaces the media properties of every <video> on the page with controllable values.
// The elements stay real, so layout, rects and pointer events behave normally; only the
// media behaviour is simulated, which keeps results deterministic without a video file.
(() => {
  function fakeTimeRanges(ranges) {
    return {
      length: ranges.length,
      start: (i) => ranges[i][0],
      end: (i) => ranges[i][1],
    };
  }

  function stubVideo(el, duration, startTime) {
    let time = startTime;
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
      get: () => fakeTimeRanges([[0, duration * 0.6]]),
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
    stubVideo(el, Number(el.dataset.duration), Number(el.dataset.start || 0));
  });
})();
