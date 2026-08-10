import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { init, buildRenderState } from '../lib/main.js';
import { HOST_HEIGHT } from '../lib/config.js';
import { STORAGE_KEY } from '../lib/settings.js';

/** A stand-in storage area that behaves like chrome.storage.sync. */
function fakeArea(initial = {}) {
  const data = { ...initial };
  const listeners = [];
  return {
    async get(key) {
      return key in data ? { [key]: data[key] } : {};
    },
    async set(patch) {
      const changes = {};
      for (const [k, v] of Object.entries(patch)) {
        changes[k] = { oldValue: data[k], newValue: v };
        data[k] = v;
      }
      listeners.forEach((fn) => fn(changes));
    },
    onChanged: {
      addListener: (fn) => listeners.push(fn),
      removeListener: (fn) => {
        const i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      },
    },
    listenerCount: () => listeners.length,
  };
}

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

/** A window whose animation frames only run when the test asks for them. */
function makeWin(overrides = {}) {
  const frames = [];
  return {
    innerWidth: 1000,
    innerHeight: 800,
    requestAnimationFrame: (fn) => frames.push(fn),
    cancelAnimationFrame: vi.fn(),
    setInterval: vi.fn(() => 1),
    clearInterval: vi.fn(),
    setTimeout: () => 1,
    clearTimeout: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getComputedStyle: () => ({
      overflow: 'visible',
      overflowX: 'visible',
      overflowY: 'visible',
      borderBottomLeftRadius: '0px',
      borderBottomRightRadius: '0px',
    }),
    /** Runs the frame the loop most recently queued. */
    tick() {
      const next = frames.pop();
      frames.length = 0;
      if (next) next();
    },
    frameCount: () => frames.length,
    ...overrides,
  };
}

/** A real <video> whose rect is fixed, since jsdom reports zeros. */
function addVideo({ left = 100, top = 50, width = 400, height = 600 } = {}) {
  const el = document.createElement('video');
  el.getBoundingClientRect = () => ({
    left, top, right: left + width, bottom: top + height, width, height,
  });
  Object.defineProperty(el, 'paused', { value: false, configurable: true });
  Object.defineProperty(el, 'duration', { value: 40, configurable: true });
  Object.defineProperty(el, 'currentTime', { value: 10, writable: true, configurable: true });
  Object.defineProperty(el, 'readyState', { value: 4, configurable: true });
  Object.defineProperty(el, 'buffered', {
    value: { length: 1, start: () => 0, end: () => 30 },
    configurable: true,
  });
  document.body.appendChild(el);
  return el;
}

const host = () => document.querySelector('[data-igrc="host"]');

describe('init', () => {
  let win;

  beforeEach(() => {
    document.body.innerHTML = '';
    win = makeWin();
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

describe('the render loop', () => {
  let win;
  let app;

  beforeEach(() => {
    document.body.innerHTML = '';
    win = makeWin();
  });

  afterEach(() => {
    if (app) app.teardown();
    app = null;
    document.body.innerHTML = '';
  });

  it('aligns the overlay with the tracked video', () => {
    addVideo({ left: 120, top: 40, width: 380, height: 660 });
    app = init({ doc: document, win });
    win.tick();
    expect(host().style.left).toBe('120px');
    expect(host().style.width).toBe('380px');
    expect(host().style.top).toBe(`${40 + 660 - HOST_HEIGHT}px`);
  });

  it('paints playback state onto the bar', () => {
    addVideo();
    app = init({ doc: document, win });
    win.tick();
    const shadow = host().shadowRoot;
    expect(host().style.display).toBe('block');
    expect(shadow.querySelector('.played').style.width).toBe('25%');
    expect(shadow.querySelector('.buffered').style.width).toBe('75%');
    expect(shadow.querySelector('.label').textContent).toBe('0:10 / 0:40');
  });

  it('hides the overlay once the video leaves the document', () => {
    const video = addVideo();
    app = init({ doc: document, win });
    win.tick();
    expect(host().style.display).toBe('block');

    video.remove();
    win.tick();
    expect(host().style.display).toBe('none');
  });

  it('hides the overlay for a zero-sized video', () => {
    const video = addVideo();
    app = init({ doc: document, win });
    win.tick();

    video.getBoundingClientRect = () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 });
    win.tick();
    expect(host().style.display).toBe('none');
  });

  it('reads the corner radii once while the video keeps its size', () => {
    addVideo();
    const getComputedStyle = vi.fn(() => ({
      overflow: 'visible', overflowX: 'visible', overflowY: 'visible',
      borderBottomLeftRadius: '0px', borderBottomRightRadius: '0px',
    }));
    win = makeWin({ getComputedStyle });
    app = init({ doc: document, win });
    win.tick();
    const afterFirstFrame = getComputedStyle.mock.calls.length;
    expect(afterFirstFrame).toBeGreaterThan(0);
    win.tick();
    win.tick();
    expect(getComputedStyle.mock.calls.length).toBe(afterFirstFrame);
  });

  it('keeps queuing frames while it runs', () => {
    addVideo();
    app = init({ doc: document, win });
    expect(win.frameCount()).toBe(1);
    win.tick();
    expect(win.frameCount()).toBe(1);
  });
});

describe('init wiring', () => {
  let win;
  let app;

  beforeEach(() => {
    document.body.innerHTML = '';
    win = makeWin();
  });

  afterEach(() => {
    if (app) app.teardown();
    app = null;
    document.body.innerHTML = '';
  });

  /** The seek controller measures against the track, which jsdom sizes at zero. */
  function sizeTrack(width = 400) {
    const track = host().shadowRoot.querySelector('.track');
    track.getBoundingClientRect = () => ({ left: 0, width, right: width, top: 0, bottom: 6, height: 6 });
  }

  function pointer(type, clientX) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { clientX, pointerId: 1 });
    return event;
  }

  it('routes pointer events on the bar to the tracked video', () => {
    const video = addVideo();
    app = init({ doc: document, win });
    sizeTrack(400);

    const hit = host().shadowRoot.querySelector('.hit');
    hit.setPointerCapture = () => {};
    hit.releasePointerCapture = () => {};
    hit.dispatchEvent(pointer('pointerdown', 100));
    hit.dispatchEvent(pointer('pointerup', 300));

    expect(video.currentTime).toBe(30);
  });

  it('applies settings loaded from the injected storage area', async () => {
    addVideo();
    const stored = { [STORAGE_KEY]: { barThickness: 7, handleSize: 18, hitZoneHeight: 24, showLabel: false } };
    app = init({ doc: document, win, storageArea: fakeArea(stored) });
    await Promise.resolve();
    await Promise.resolve();

    expect(host().style.getPropertyValue('--igrc-bar-idle')).toBe('7px');
    expect(host().style.getPropertyValue('--igrc-handle')).toBe('18px');
    expect(host().style.getPropertyValue('--igrc-label-display')).toBe('none');
  });

  it('applies later storage changes without a reload', async () => {
    addVideo();
    const area = fakeArea();
    app = init({ doc: document, win, storageArea: area });
    await Promise.resolve();

    await area.set({ [STORAGE_KEY]: { barThickness: 6 } });
    expect(host().style.getPropertyValue('--igrc-bar-idle')).toBe('6px');
  });
});

describe('teardown', () => {
  let win;

  beforeEach(() => {
    document.body.innerHTML = '';
    win = makeWin();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('stops the render loop', () => {
    addVideo();
    const app = init({ doc: document, win });
    win.tick();
    app.teardown();

    expect(win.cancelAnimationFrame).toHaveBeenCalled();
    // A frame that was already queued must not paint after teardown
    expect(() => win.tick()).not.toThrow();
    expect(document.querySelector('[data-igrc="host"]')).toBe(null);
  });

  it('stops the tracker interval', () => {
    addVideo();
    const app = init({ doc: document, win });
    app.teardown();
    expect(win.clearInterval).toHaveBeenCalled();
  });

  it('unsubscribes from storage', async () => {
    addVideo();
    const area = fakeArea();
    const app = init({ doc: document, win, storageArea: area });
    await Promise.resolve();
    expect(area.listenerCount()).toBe(1);

    app.teardown();
    expect(area.listenerCount()).toBe(0);
  });

  it('detaches the seek controller', () => {
    const video = addVideo();
    const app = init({ doc: document, win });
    const hit = host().shadowRoot.querySelector('.hit');
    hit.setPointerCapture = () => {};
    app.teardown();

    const event = new Event('pointerdown', { bubbles: true, cancelable: true });
    Object.assign(event, { clientX: 300, pointerId: 1 });
    hit.dispatchEvent(event);
    expect(video.currentTime).toBe(10);
  });

  it('removes its document listeners', () => {
    addVideo();
    const removed = [];
    const doc = document;
    const original = doc.removeEventListener.bind(doc);
    doc.removeEventListener = (type, fn, opts) => { removed.push(type); return original(type, fn, opts); };

    init({ doc, win }).teardown();
    doc.removeEventListener = original;

    expect(removed).toContain('visibilitychange');
    expect(removed).toContain('fullscreenchange');
  });
});

describe('fullscreen', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    delete document.fullscreenElement;
  });

  it('moves the overlay inside the fullscreen element and back', () => {
    document.body.innerHTML = '';
    const win = makeWin();
    addVideo();
    const app = init({ doc: document, win });
    expect(host().parentNode).toBe(document.body);

    const container = document.createElement('div');
    document.body.appendChild(container);
    Object.defineProperty(document, 'fullscreenElement', { value: container, configurable: true });
    document.dispatchEvent(new Event('fullscreenchange'));
    expect(host().parentNode).toBe(container);

    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
    document.dispatchEvent(new Event('fullscreenchange'));
    expect(host().parentNode).toBe(document.body);

    app.teardown();
  });
});
