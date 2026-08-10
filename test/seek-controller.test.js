import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SeekController } from '../lib/seek-controller.js';

/** Collects queued rAF callbacks so tests can run them on demand. */
function makeFakeWindow() {
  const callbacks = [];
  return {
    requestAnimationFrame(fn) {
      callbacks.push(fn);
      return callbacks.length;
    },
    cancelAnimationFrame() {},
    flush() {
      const pending = callbacks.splice(0, callbacks.length);
      pending.forEach((fn) => fn());
    },
    pendingCount: () => callbacks.length,
  };
}

function makeVideo() {
  return { currentTime: 0, duration: 40, paused: false, readyState: 4 };
}

/** Builds the hit and track elements; the track sits at left 0 and is 400 wide. */
function makeParts() {
  const hit = document.createElement('div');
  const track = document.createElement('div');
  track.getBoundingClientRect = () => ({ left: 0, width: 400, right: 400, top: 0, bottom: 6, height: 6 });
  hit.setPointerCapture = vi.fn();
  hit.releasePointerCapture = vi.fn();
  document.body.append(hit, track);
  return { hit, track };
}

function pointerEvent(type, clientX, extra = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { clientX, pointerId: 1, ...extra });
  return event;
}

describe('SeekController', () => {
  let win;
  let video;
  let parts;
  let controller;
  let nowValue;

  beforeEach(() => {
    document.body.innerHTML = '';
    win = makeFakeWindow();
    video = makeVideo();
    parts = makeParts();
    nowValue = 1000;
    controller = new SeekController({ win, now: () => nowValue });
    controller.attach(video, parts);
  });

  afterEach(() => {
    controller.detach();
    document.body.innerHTML = '';
  });

  it('starts neither hovering nor dragging', () => {
    expect(controller.hovering).toBe(false);
    expect(controller.dragging).toBe(false);
  });

  it('picks up a pointer that is already inside when attaching', () => {
    // Re-attaching to the same element does not replay pointerenter
    const hovered = makeParts();
    hovered.hit.matches = (sel) => sel === ':hover';
    const fresh = new SeekController({ win, now: () => nowValue });
    fresh.attach(makeVideo(), hovered);
    expect(fresh.hovering).toBe(true);
    fresh.detach();
  });

  it('pointerenter starts hovering', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerenter', 0));
    expect(controller.hovering).toBe(true);
  });

  it('pointerleave stops hovering', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerenter', 0));
    parts.hit.dispatchEvent(pointerEvent('pointerleave', 0));
    expect(controller.hovering).toBe(false);
  });

  it('pointermove while hovering updates hoverTime without seeking', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerenter', 0));
    parts.hit.dispatchEvent(pointerEvent('pointermove', 200));
    expect(controller.hoverTime).toBe(20);
    win.flush();
    expect(video.currentTime).toBe(0);
  });

  it('pointerdown schedules a seek immediately', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    expect(controller.dragging).toBe(true);
    expect(controller.dragTime).toBe(10);
    win.flush();
    expect(video.currentTime).toBe(10);
  });

  it('pointerdown captures the pointer so a drag survives leaving the bar', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    expect(parts.hit.setPointerCapture).toHaveBeenCalledWith(1);
  });

  it('pointerdown stops propagation so Instagram does not toggle playback', () => {
    const event = pointerEvent('pointerdown', 100);
    const stopPropagation = vi.spyOn(event, 'stopPropagation');
    parts.hit.dispatchEvent(event);
    expect(stopPropagation).toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it('click is swallowed rather than propagated', () => {
    const event = pointerEvent('click', 100);
    const stopPropagation = vi.spyOn(event, 'stopPropagation');
    parts.hit.dispatchEvent(event);
    expect(stopPropagation).toHaveBeenCalled();
  });

  it('several pointermoves during a drag produce one write', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    parts.hit.dispatchEvent(pointerEvent('pointermove', 200));
    parts.hit.dispatchEvent(pointerEvent('pointermove', 300));
    expect(win.pendingCount()).toBe(1);
    win.flush();
    expect(video.currentTime).toBe(30);
  });

  it('pointerup writes the final position without waiting for a frame', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    parts.hit.dispatchEvent(pointerEvent('pointermove', 360));
    parts.hit.dispatchEvent(pointerEvent('pointerup', 360));
    expect(video.currentTime).toBe(36);
    expect(controller.dragging).toBe(false);
  });

  it('hoverTime follows the release position after pointerup', () => {
    // The pointer rests where it was released, so the label must show that position
    parts.hit.dispatchEvent(pointerEvent('pointerenter', 0));
    parts.hit.dispatchEvent(pointerEvent('pointermove', 40));
    expect(controller.hoverTime).toBe(4);
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 40));
    parts.hit.dispatchEvent(pointerEvent('pointermove', 200));
    parts.hit.dispatchEvent(pointerEvent('pointerup', 320));
    expect(controller.hoverTime).toBe(32);
  });

  it('pointerup releases the pointer capture', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    parts.hit.dispatchEvent(pointerEvent('pointerup', 100));
    expect(parts.hit.releasePointerCapture).toHaveBeenCalledWith(1);
  });

  it('pointercancel also ends the drag', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    parts.hit.dispatchEvent(pointerEvent('pointercancel', 100));
    expect(controller.dragging).toBe(false);
  });

  it('dragging past the left edge clamps to zero', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    parts.hit.dispatchEvent(pointerEvent('pointerup', -500));
    expect(video.currentTime).toBe(0);
  });

  it('dragging past the right edge clamps to the duration', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    parts.hit.dispatchEvent(pointerEvent('pointerup', 9999));
    expect(video.currentTime).toBe(40);
  });

  it('an unusable duration seeks to zero rather than writing NaN', () => {
    video.duration = NaN;
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 200));
    win.flush();
    expect(video.currentTime).toBe(0);
  });

  it('records a timestamp for stall detection after seeking', () => {
    expect(controller.lastSeekAt).toBe(0);
    nowValue = 5000;
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    win.flush();
    expect(controller.lastSeekAt).toBe(5000);
  });

  it('clearSeekMark resets the timestamp', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    win.flush();
    controller.clearSeekMark();
    expect(controller.lastSeekAt).toBe(0);
  });

  it('leaving the hit area mid-drag keeps the hover state', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerenter', 0));
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    parts.hit.dispatchEvent(pointerEvent('pointerleave', 100));
    expect(controller.hovering).toBe(true);
    expect(controller.dragging).toBe(true);
  });

  it('events no longer reach the video after detach', () => {
    controller.detach();
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 200));
    win.flush();
    expect(video.currentTime).toBe(0);
    expect(controller.dragging).toBe(false);
  });

  it('detach resets the hover and drag state', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerenter', 0));
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    controller.detach();
    expect(controller.hovering).toBe(false);
    expect(controller.dragging).toBe(false);
  });

  it('a throwing currentTime setter does not break the flow', () => {
    const brokenVideo = {
      duration: 40,
      paused: false,
      readyState: 4,
      get currentTime() { return 0; },
      set currentTime(_value) { throw new Error('InvalidStateError'); },
    };
    controller.detach();
    controller.attach(brokenVideo, parts);
    expect(() => {
      parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
      win.flush();
    }).not.toThrow();
  });
});
