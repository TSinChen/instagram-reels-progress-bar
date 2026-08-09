import { init } from '../../lib/main.js';

/** 做一個假的 TimeRanges。 */
function fakeTimeRanges(ranges) {
  return {
    length: ranges.length,
    start: (i) => ranges[i][0],
    end: (i) => ranges[i][1],
  };
}

/**
 * 把一個真的 <video> 元素的媒體屬性換成可控的假值。
 * 保留真實元素是為了讓版面、getBoundingClientRect 與指標事件都是真的，
 * 只有媒體行為是模擬的，這樣驗證結果才確定。
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

  // 讓時間自己前進，看得出進度條會動
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
