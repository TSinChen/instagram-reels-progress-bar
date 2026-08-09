import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SeekController } from '../lib/seek-controller.js';

/** 收集所有排入的 rAF callback，測試中手動觸發。 */
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

/** 建立 hit 與 track 元素，track 的矩形固定為 left 0、寬 400。 */
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

  it('初始狀態不是 hover 也不是拖曳', () => {
    expect(controller.hovering).toBe(false);
    expect(controller.dragging).toBe(false);
  });

  it('pointerenter 進入 hover 狀態', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerenter', 0));
    expect(controller.hovering).toBe(true);
  });

  it('pointerleave 離開 hover 狀態', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerenter', 0));
    parts.hit.dispatchEvent(pointerEvent('pointerleave', 0));
    expect(controller.hovering).toBe(false);
  });

  it('hover 時的 pointermove 更新 hoverTime 但不動 currentTime', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerenter', 0));
    parts.hit.dispatchEvent(pointerEvent('pointermove', 200));
    expect(controller.hoverTime).toBe(20);
    win.flush();
    expect(video.currentTime).toBe(0);
  });

  it('pointerdown 立刻排定一次 seek', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    expect(controller.dragging).toBe(true);
    expect(controller.dragTime).toBe(10);
    win.flush();
    expect(video.currentTime).toBe(10);
  });

  it('pointerdown 會擷取指標，讓拖出範圍仍收得到事件', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    expect(parts.hit.setPointerCapture).toHaveBeenCalledWith(1);
  });

  it('pointerdown 會阻止事件冒泡，避免觸發 Instagram 的播放暫停', () => {
    const event = pointerEvent('pointerdown', 100);
    const stopPropagation = vi.spyOn(event, 'stopPropagation');
    parts.hit.dispatchEvent(event);
    expect(stopPropagation).toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it('click 會被攔下不往外冒泡', () => {
    const event = pointerEvent('click', 100);
    const stopPropagation = vi.spyOn(event, 'stopPropagation');
    parts.hit.dispatchEvent(event);
    expect(stopPropagation).toHaveBeenCalled();
  });

  it('拖曳中的多次 pointermove 只會寫入一次 currentTime', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    parts.hit.dispatchEvent(pointerEvent('pointermove', 200));
    parts.hit.dispatchEvent(pointerEvent('pointermove', 300));
    expect(win.pendingCount()).toBe(1);
    win.flush();
    expect(video.currentTime).toBe(30);
  });

  it('pointerup 立刻寫入最終位置，不等下一個 frame', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    parts.hit.dispatchEvent(pointerEvent('pointermove', 360));
    parts.hit.dispatchEvent(pointerEvent('pointerup', 360));
    expect(video.currentTime).toBe(36);
    expect(controller.dragging).toBe(false);
  });

  it('pointerup 後 hoverTime 跟上放開的位置', () => {
    // 指標停在放開的位置，標籤就必須顯示那裡，
    // 不能停留在拖曳開始前的舊 hoverTime
    parts.hit.dispatchEvent(pointerEvent('pointerenter', 0));
    parts.hit.dispatchEvent(pointerEvent('pointermove', 40));
    expect(controller.hoverTime).toBe(4);
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 40));
    parts.hit.dispatchEvent(pointerEvent('pointermove', 200));
    parts.hit.dispatchEvent(pointerEvent('pointerup', 320));
    expect(controller.hoverTime).toBe(32);
  });

  it('pointerup 會釋放指標擷取', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    parts.hit.dispatchEvent(pointerEvent('pointerup', 100));
    expect(parts.hit.releasePointerCapture).toHaveBeenCalledWith(1);
  });

  it('pointercancel 也會結束拖曳', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    parts.hit.dispatchEvent(pointerEvent('pointercancel', 100));
    expect(controller.dragging).toBe(false);
  });

  it('拖到左端之外夾成 0 秒', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    parts.hit.dispatchEvent(pointerEvent('pointerup', -500));
    expect(video.currentTime).toBe(0);
  });

  it('拖到右端之外夾成全長', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    parts.hit.dispatchEvent(pointerEvent('pointerup', 9999));
    expect(video.currentTime).toBe(40);
  });

  it('duration 無效時 seek 到 0，不寫入 NaN', () => {
    video.duration = NaN;
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 200));
    win.flush();
    expect(video.currentTime).toBe(0);
  });

  it('seek 後記錄時間戳供卡頓判定使用', () => {
    expect(controller.lastSeekAt).toBe(0);
    nowValue = 5000;
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    win.flush();
    expect(controller.lastSeekAt).toBe(5000);
  });

  it('clearSeekMark 把時間戳歸零', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    win.flush();
    controller.clearSeekMark();
    expect(controller.lastSeekAt).toBe(0);
  });

  it('拖曳中離開感應區仍維持 hover 狀態', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerenter', 0));
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    parts.hit.dispatchEvent(pointerEvent('pointerleave', 100));
    expect(controller.hovering).toBe(true);
    expect(controller.dragging).toBe(true);
  });

  it('detach 之後事件不再影響影片', () => {
    controller.detach();
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 200));
    win.flush();
    expect(video.currentTime).toBe(0);
    expect(controller.dragging).toBe(false);
  });

  it('detach 會重設 hover 與拖曳狀態', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerenter', 0));
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    controller.detach();
    expect(controller.hovering).toBe(false);
    expect(controller.dragging).toBe(false);
  });

  it('寫入 currentTime 拋錯時不會讓整個流程炸掉', () => {
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
