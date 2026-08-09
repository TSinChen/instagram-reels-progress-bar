import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { init, buildRenderState } from '../src/content/main.js';

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
  it('閒置時 playedTime 與 labelTime 都是真實播放位置', () => {
    const state = buildRenderState(makeVideo(), makeSeek(), 1000);
    expect(state.playedTime).toBe(10);
    expect(state.labelTime).toBe(10);
    expect(state.active).toBe(false);
    expect(state.dragging).toBe(false);
  });

  it('hover 時進度條停在真實位置，只有標籤跟著指標走', () => {
    const seek = makeSeek({ hovering: true, hoverTime: 33 });
    const state = buildRenderState(makeVideo(), seek, 1000);
    expect(state.playedTime).toBe(10);
    expect(state.labelTime).toBe(33);
    expect(state.active).toBe(true);
  });

  it('拖曳時進度條與標籤都用拖曳暫存值', () => {
    const seek = makeSeek({ hovering: true, dragging: true, dragTime: 25 });
    const state = buildRenderState(makeVideo(), seek, 1000);
    expect(state.playedTime).toBe(25);
    expect(state.labelTime).toBe(25);
    expect(state.active).toBe(true);
    expect(state.dragging).toBe(true);
  });

  it('帶出影片長度與緩衝終點', () => {
    const state = buildRenderState(makeVideo(), makeSeek(), 1000);
    expect(state.duration).toBe(40);
    expect(state.bufferedEnd).toBe(20);
  });

  it('seek 後資料不足超過門檻時標記卡頓', () => {
    const video = makeVideo({ readyState: 1 });
    const seek = makeSeek({ lastSeekAt: 1000 });
    const state = buildRenderState(video, seek, 3000);
    expect(state.stalled).toBe(true);
  });

  it('資料補齊後不再標記卡頓，並清掉 seek 時間戳', () => {
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

  it('會在文件裡建立浮層', () => {
    const app = init({ doc: document, win });
    expect(document.querySelector('[data-igrc="host"]')).not.toBe(null);
    app.teardown();
  });

  it('重複 init 不會建立第二個浮層，第二次回傳 null', () => {
    const app = init({ doc: document, win });
    const second = init({ doc: document, win });
    expect(second).toBe(null);
    expect(document.querySelectorAll('[data-igrc="host"]').length).toBe(1);
    app.teardown();
  });

  it('teardown 會把浮層移除', () => {
    const app = init({ doc: document, win });
    app.teardown();
    expect(document.querySelector('[data-igrc="host"]')).toBe(null);
  });

  it('teardown 之後可以重新 init', () => {
    init({ doc: document, win }).teardown();
    const app = init({ doc: document, win });
    expect(app).not.toBe(null);
    app.teardown();
  });
});
