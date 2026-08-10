import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pickActiveVideo, VideoTracker } from '../lib/video-tracker.js';

const viewport = { width: 1000, height: 800 };

/**
 * A stand-in video. Only getBoundingClientRect and paused are needed, and a plain object
 * is used because jsdom returns an all-zero rect for real elements.
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
  it('returns null with no videos', () => {
    expect(pickActiveVideo([], viewport)).toBe(null);
  });

  it('picks the only fully visible video', () => {
    const v = fakeVideo({ id: 'a' });
    expect(pickActiveVideo([v], viewport)).toBe(v);
  });

  it('skips elements narrower than the minimum', () => {
    const tiny = fakeVideo({ id: 'tiny', width: 40, height: 600 });
    expect(pickActiveVideo([tiny], viewport)).toBe(null);
  });

  it('skips elements shorter than the minimum', () => {
    const tiny = fakeVideo({ id: 'tiny', width: 400, height: 40 });
    expect(pickActiveVideo([tiny], viewport)).toBe(null);
  });

  it('a video less than half visible is not a candidate', () => {
    // 600 tall, 200 visible: a ratio of 0.33
    const barelyVisible = fakeVideo({ id: 'barely', top: 600, height: 600 });
    expect(pickActiveVideo([barelyVisible], viewport)).toBe(null);
  });

  it('a video exactly half visible is a candidate', () => {
    // 600 tall at top 500: 300 visible, a ratio of 0.5
    const half = fakeVideo({ id: 'half', top: 500, height: 600 });
    expect(pickActiveVideo([half], viewport)).toBe(half);
  });

  it('picks the larger of two fully visible videos', () => {
    const small = fakeVideo({ id: 'small', width: 200, height: 200 });
    const large = fakeVideo({ id: 'large', width: 400, height: 600 });
    expect(pickActiveVideo([small, large], viewport)).toBe(large);
  });

  it('picks the larger video regardless of document order', () => {
    const small = fakeVideo({ id: 'small', width: 200, height: 200 });
    const large = fakeVideo({ id: 'large', width: 400, height: 600 });
    expect(pickActiveVideo([large, small], viewport)).toBe(large);
  });

  it('prefers the playing video when areas are close', () => {
    const pausedOne = fakeVideo({ id: 'paused', width: 400, height: 600, paused: true });
    const playingOne = fakeVideo({ id: 'playing', width: 400, height: 598, paused: false });
    expect(pickActiveVideo([pausedOne, playingOne], viewport)).toBe(playingOne);
  });

  it('area wins past the tie margin even if the larger video is paused', () => {
    const bigPaused = fakeVideo({ id: 'big', width: 400, height: 600, paused: true });
    const smallPlaying = fakeVideo({ id: 'small', width: 200, height: 200, paused: false });
    expect(pickActiveVideo([bigPaused, smallPlaying], viewport)).toBe(bigPaused);
  });

  it('returns null when every video is off screen', () => {
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

  /** Inserts a real <video> with its rect overridden. */
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

  it('reports the video it finds as soon as it starts', () => {
    const video = addVideo();
    const onChange = vi.fn();
    const tracker = new VideoTracker(onChange, { doc, win });
    tracker.start();
    expect(onChange).toHaveBeenCalledWith(video);
    expect(tracker.current).toBe(video);
    tracker.stop();
  });

  it('reports null once when there are no videos', () => {
    const onChange = vi.fn();
    const tracker = new VideoTracker(onChange, { doc, win });
    tracker.start();
    tracker.evaluate();
    tracker.evaluate();
    expect(onChange).not.toHaveBeenCalled();
    expect(tracker.current).toBe(null);
    tracker.stop();
  });

  it('re-evaluating the same video does not report again', () => {
    addVideo();
    const onChange = vi.fn();
    const tracker = new VideoTracker(onChange, { doc, win });
    tracker.start();
    tracker.evaluate();
    tracker.evaluate();
    expect(onChange).toHaveBeenCalledTimes(1);
    tracker.stop();
  });

  it('reports null after the video is removed', () => {
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

  it('re-evaluates when the interval fires', () => {
    const onChange = vi.fn();
    const tracker = new VideoTracker(onChange, { doc, win });
    tracker.start();
    const video = addVideo();
    vi.advanceTimersByTime(250);
    expect(onChange).toHaveBeenCalledWith(video);
    tracker.stop();
  });

  it('the interval stops firing after stop', () => {
    const onChange = vi.fn();
    const tracker = new VideoTracker(onChange, { doc, win });
    tracker.start();
    tracker.stop();
    addVideo();
    vi.advanceTimersByTime(1000);
    expect(onChange).not.toHaveBeenCalled();
  });
});
