import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pickActiveVideo, VideoTracker } from '../lib/video-tracker.js';

const viewport = { width: 1000, height: 800 };

/**
 * 做一個假的 video 元素。只需要 getBoundingClientRect 與 paused。
 * 用普通物件而不是真的 <video>，因為 jsdom 的 getBoundingClientRect 一律回傳全 0。
 */
function fakeVideo({ left = 0, top = 0, width = 400, height = 600, paused = false, id = '' } = {}) {
  return {
    id,
    paused,
    getBoundingClientRect: () => ({
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
    }),
  };
}

describe('pickActiveVideo', () => {
  it('沒有影片時回傳 null', () => {
    expect(pickActiveVideo([], viewport)).toBe(null);
  });

  it('只有一支完全可見的影片就選它', () => {
    const v = fakeVideo({ id: 'a' });
    expect(pickActiveVideo([v], viewport)).toBe(v);
  });

  it('略過寬度小於 80px 的元素', () => {
    const tiny = fakeVideo({ id: 'tiny', width: 40, height: 600 });
    expect(pickActiveVideo([tiny], viewport)).toBe(null);
  });

  it('略過高度小於 80px 的元素', () => {
    const tiny = fakeVideo({ id: 'tiny', width: 400, height: 40 });
    expect(pickActiveVideo([tiny], viewport)).toBe(null);
  });

  it('露出比例低於 50% 的不列入候選', () => {
    // 高 600，只露出 200 → 比例 0.33
    const barelyVisible = fakeVideo({ id: 'barely', top: 600, height: 600 });
    expect(pickActiveVideo([barelyVisible], viewport)).toBe(null);
  });

  it('露出比例剛好 50% 列入候選', () => {
    // 高 600，top = 500 → 露出 300 → 比例 0.5
    const half = fakeVideo({ id: 'half', top: 500, height: 600 });
    expect(pickActiveVideo([half], viewport)).toBe(half);
  });

  it('兩支都完全可見時選面積大的', () => {
    const small = fakeVideo({ id: 'small', width: 200, height: 200 });
    const large = fakeVideo({ id: 'large', width: 400, height: 600 });
    expect(pickActiveVideo([small, large], viewport)).toBe(large);
  });

  it('面積大小順序顛倒也選得到面積大的', () => {
    const small = fakeVideo({ id: 'small', width: 200, height: 200 });
    const large = fakeVideo({ id: 'large', width: 400, height: 600 });
    expect(pickActiveVideo([large, small], viewport)).toBe(large);
  });

  it('面積接近平手時優先選播放中的', () => {
    const pausedOne = fakeVideo({ id: 'paused', width: 400, height: 600, paused: true });
    const playingOne = fakeVideo({ id: 'playing', width: 400, height: 598, paused: false });
    expect(pickActiveVideo([pausedOne, playingOne], viewport)).toBe(playingOne);
  });

  it('面積差距超過容忍值時仍以面積為準，即使大的那支是暫停的', () => {
    const bigPaused = fakeVideo({ id: 'big', width: 400, height: 600, paused: true });
    const smallPlaying = fakeVideo({ id: 'small', width: 200, height: 200, paused: false });
    expect(pickActiveVideo([bigPaused, smallPlaying], viewport)).toBe(bigPaused);
  });

  it('全部都在視窗外時回傳 null', () => {
    const above = fakeVideo({ id: 'above', top: -900, height: 600 });
    const below = fakeVideo({ id: 'below', top: 900, height: 600 });
    expect(pickActiveVideo([above, below], viewport)).toBe(null);
  });
});

describe('VideoTracker', () => {
  let doc;
  let win;

  beforeEach(() => {
    vi.useFakeTimers();
    doc = document;
    doc.body.innerHTML = '';
    win = {
      innerWidth: 1000,
      innerHeight: 800,
      setInterval: (fn, ms) => setInterval(fn, ms),
      clearInterval: (id) => clearInterval(id),
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (id) => clearTimeout(id),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    doc.body.innerHTML = '';
  });

  /** 插入一個真的 <video> 並覆寫它的 getBoundingClientRect。 */
  function addVideo({ width = 400, height = 600, top = 0, paused = false } = {}) {
    const el = doc.createElement('video');
    el.getBoundingClientRect = () => ({
      left: 0,
      top,
      right: width,
      bottom: top + height,
      width,
      height,
    });
    Object.defineProperty(el, 'paused', { value: paused, configurable: true });
    doc.body.appendChild(el);
    return el;
  }

  it('start 之後立刻回報找到的影片', () => {
    const video = addVideo();
    const onChange = vi.fn();
    const tracker = new VideoTracker(onChange, { doc, win });
    tracker.start();
    expect(onChange).toHaveBeenCalledWith(video);
    expect(tracker.current).toBe(video);
    tracker.stop();
  });

  it('沒有影片時回報 null 只發生一次', () => {
    const onChange = vi.fn();
    const tracker = new VideoTracker(onChange, { doc, win });
    tracker.start();
    tracker.evaluate();
    tracker.evaluate();
    expect(onChange).not.toHaveBeenCalled();
    expect(tracker.current).toBe(null);
    tracker.stop();
  });

  it('同一支影片重複評估不會重複回報', () => {
    addVideo();
    const onChange = vi.fn();
    const tracker = new VideoTracker(onChange, { doc, win });
    tracker.start();
    tracker.evaluate();
    tracker.evaluate();
    expect(onChange).toHaveBeenCalledTimes(1);
    tracker.stop();
  });

  it('影片被移除後回報 null', () => {
    const video = addVideo();
    const onChange = vi.fn();
    const tracker = new VideoTracker(onChange, { doc, win });
    tracker.start();
    onChange.mockClear();
    video.remove();
    tracker.evaluate();
    expect(onChange).toHaveBeenCalledWith(null);
    expect(tracker.current).toBe(null);
    tracker.stop();
  });

  it('定時器到期會自動重新評估', () => {
    const onChange = vi.fn();
    const tracker = new VideoTracker(onChange, { doc, win });
    tracker.start();
    const video = addVideo();
    vi.advanceTimersByTime(250);
    expect(onChange).toHaveBeenCalledWith(video);
    tracker.stop();
  });

  it('stop 之後定時器不再觸發', () => {
    const onChange = vi.fn();
    const tracker = new VideoTracker(onChange, { doc, win });
    tracker.start();
    tracker.stop();
    addVideo();
    vi.advanceTimersByTime(1000);
    expect(onChange).not.toHaveBeenCalled();
  });
});
