import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { init, buildRenderState } from '../lib/main.js';

function fakeTimeRanges(ranges) {
  return {
    length: ranges.length,
    start: (i) => ranges[i][0],
    end: (i) => ranges[i][1],
  };
}

function makeVideo(overrides = {}) {
  return {
    currentTime: 10,
    duration: 40,
    paused: false,
    readyState: 4,
    buffered: fakeTimeRanges([[0, 20]]),
    ...overrides,
  };
}

function makeSeek(overrides = {}) {
  return {
    hovering: false,
    dragging: false,
    hoverTime: 0,
    dragTime: 0,
    lastSeekAt: 0,
    clearSeekMark: vi.fn(),
    ...overrides,
  };
}

describe('buildRenderState', () => {
  it('idle: both played and label times track real playback', () => {
    const state = buildRenderState(makeVideo(), makeSeek(), 1000);
    expect(state.playedTime).toBe(10);
    expect(state.labelTime).toBe(10);
    expect(state.active).toBe(false);
    expect(state.dragging).toBe(false);
  });

  it('hovering: the fill stays put and only the label follows the pointer', () => {
    const seek = makeSeek({ hovering: true, hoverTime: 33 });
    const state = buildRenderState(makeVideo(), seek, 1000);
    expect(state.playedTime).toBe(10);
    expect(state.labelTime).toBe(33);
    expect(state.active).toBe(true);
  });

  it('dragging: both the fill and the label use the drag position', () => {
    const seek = makeSeek({ hovering: true, dragging: true, dragTime: 25 });
    const state = buildRenderState(makeVideo(), seek, 1000);
    expect(state.playedTime).toBe(25);
    expect(state.labelTime).toBe(25);
    expect(state.active).toBe(true);
    expect(state.dragging).toBe(true);
  });

  it('carries duration and buffered end through', () => {
    const state = buildRenderState(makeVideo(), makeSeek(), 1000);
    expect(state.duration).toBe(40);
    expect(state.bufferedEnd).toBe(20);
  });

  it('flags a stall once a seek has waited past the threshold', () => {
    const video = makeVideo({ readyState: 1 });
    const seek = makeSeek({ lastSeekAt: 1000 });
    const state = buildRenderState(video, seek, 3000);
    expect(state.stalled).toBe(true);
  });

  it('clears the stall and the seek mark once data is available', () => {
    const video = makeVideo({ readyState: 4 });
    const seek = makeSeek({ lastSeekAt: 1000 });
    const state = buildRenderState(video, seek, 9000);
    expect(state.stalled).toBe(false);
    expect(seek.clearSeekMark).toHaveBeenCalled();
  });
});

describe('init', () => {
  let win;
  let rafCallbacks;

  beforeEach(() => {
    document.body.innerHTML = '';
    rafCallbacks = [];
    win = {
      innerWidth: 1000,
      innerHeight: 800,
      requestAnimationFrame: (fn) => { rafCallbacks.push(fn); return rafCallbacks.length; },
      cancelAnimationFrame: () => {},
      setInterval: () => 1,
      clearInterval: () => {},
      setTimeout: () => 1,
      clearTimeout: () => {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('mounts the overlay into the document', () => {
    const app = init({ doc: document, win });
    expect(document.querySelector('[data-igrc="host"]')).not.toBe(null);
    app.teardown();
  });

  it('a second init returns null and mounts nothing', () => {
    const app = init({ doc: document, win });
    const second = init({ doc: document, win });
    expect(second).toBe(null);
    expect(document.querySelectorAll('[data-igrc="host"]').length).toBe(1);
    app.teardown();
  });

  it('teardown removes the overlay', () => {
    const app = init({ doc: document, win });
    app.teardown();
    expect(document.querySelector('[data-igrc="host"]')).toBe(null);
  });

  it('init works again after teardown', () => {
    init({ doc: document, win }).teardown();
    const app = init({ doc: document, win });
    expect(app).not.toBe(null);
    app.teardown();
  });
});
