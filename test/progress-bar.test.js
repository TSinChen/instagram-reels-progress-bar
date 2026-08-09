import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProgressBar } from '../lib/progress-bar.js';
import { HOST_HEIGHT } from '../lib/config.js';

function baseState(overrides = {}) {
  return {
    duration: 40,
    playedTime: 10,
    labelTime: 10,
    bufferedEnd: 20,
    active: false,
    dragging: false,
    stalled: false,
    ...overrides,
  };
}

describe('ProgressBar', () => {
  let bar;

  beforeEach(() => {
    document.body.innerHTML = '';
    bar = new ProgressBar(document);
  });

  afterEach(() => {
    bar.destroy();
    document.body.innerHTML = '';
  });

  it('mount 會建立一個帶 shadow root 的 host', () => {
    bar.mount();
    const host = document.querySelector('[data-igrc="host"]');
    expect(host).not.toBe(null);
    expect(host.shadowRoot).not.toBe(null);
  });

  it('重複 mount 不會建立第二個 host', () => {
    bar.mount();
    bar.mount();
    expect(document.querySelectorAll('[data-igrc="host"]').length).toBe(1);
  });

  it('mount 到不同 parent 會把 host 搬過去', () => {
    bar.mount();
    const other = document.createElement('div');
    document.body.appendChild(other);
    bar.mount(other);
    expect(document.querySelectorAll('[data-igrc="host"]').length).toBe(1);
    expect(other.querySelector('[data-igrc="host"]')).not.toBe(null);
  });

  it('syncTo 把 host 對齊到影片矩形的底部', () => {
    bar.mount();
    bar.syncTo({ left: 120, bottom: 500, width: 360 });
    const host = document.querySelector('[data-igrc="host"]');
    expect(host.style.left).toBe('120px');
    expect(host.style.width).toBe('360px');
    expect(host.style.top).toBe(`${500 - HOST_HEIGHT}px`);
  });

  it('render 依比例設定已播放與已緩衝的寬度', () => {
    bar.mount();
    bar.render(baseState());
    const root = document.querySelector('[data-igrc="host"]').shadowRoot;
    expect(root.querySelector('.played').style.width).toBe('25%');
    expect(root.querySelector('.buffered').style.width).toBe('50%');
  });

  it('render 把圓點放在已播放進度的末端', () => {
    bar.mount();
    bar.render(baseState());
    const root = document.querySelector('[data-igrc="host"]').shadowRoot;
    expect(root.querySelector('.handle').style.left).toBe('25%');
  });

  it('已播放時間超過總長度時寬度夾在 100%', () => {
    bar.mount();
    bar.render(baseState({ playedTime: 999 }));
    const root = document.querySelector('[data-igrc="host"]').shadowRoot;
    expect(root.querySelector('.played').style.width).toBe('100%');
  });

  it('緩衝終點超過總長度時寬度夾在 100%', () => {
    bar.mount();
    bar.render(baseState({ bufferedEnd: 999 }));
    const root = document.querySelector('[data-igrc="host"]').shadowRoot;
    expect(root.querySelector('.buffered').style.width).toBe('100%');
  });

  it('標籤顯示 labelTime 與總長度', () => {
    bar.mount();
    bar.render(baseState({ labelTime: 7 }));
    const root = document.querySelector('[data-igrc="host"]').shadowRoot;
    expect(root.querySelector('.label').textContent).toBe('0:07 / 0:40');
  });

  it('hover 時 labelTime 與 playedTime 可以不同', () => {
    bar.mount();
    bar.render(baseState({ playedTime: 10, labelTime: 30, active: true }));
    const root = document.querySelector('[data-igrc="host"]').shadowRoot;
    expect(root.querySelector('.played').style.width).toBe('25%');
    expect(root.querySelector('.label').textContent).toBe('0:30 / 0:40');
  });

  it('active 時加上 is-active class', () => {
    bar.mount();
    bar.render(baseState({ active: true }));
    const root = document.querySelector('[data-igrc="host"]').shadowRoot;
    expect(root.querySelector('.root').classList.contains('is-active')).toBe(true);
  });

  it('dragging 時同時有 is-active 與 is-dragging', () => {
    bar.mount();
    bar.render(baseState({ active: true, dragging: true }));
    const root = document.querySelector('[data-igrc="host"]').shadowRoot;
    const rootEl = root.querySelector('.root');
    expect(rootEl.classList.contains('is-active')).toBe(true);
    expect(rootEl.classList.contains('is-dragging')).toBe(true);
  });

  it('stalled 時圓點加上 is-stalled class', () => {
    bar.mount();
    bar.render(baseState({ stalled: true }));
    const root = document.querySelector('[data-igrc="host"]').shadowRoot;
    expect(root.querySelector('.handle').classList.contains('is-stalled')).toBe(true);
  });

  it('duration 為 NaN 時整條隱藏', () => {
    bar.mount();
    bar.render(baseState({ duration: NaN }));
    const host = document.querySelector('[data-igrc="host"]');
    expect(host.style.display).toBe('none');
  });

  it('duration 為 Infinity（直播）時整條隱藏', () => {
    bar.mount();
    bar.render(baseState({ duration: Infinity }));
    const host = document.querySelector('[data-igrc="host"]');
    expect(host.style.display).toBe('none');
  });

  it('duration 為 0 時整條隱藏', () => {
    bar.mount();
    bar.render(baseState({ duration: 0 }));
    const host = document.querySelector('[data-igrc="host"]');
    expect(host.style.display).toBe('none');
  });

  it('duration 恢復有效後會重新顯示', () => {
    bar.mount();
    bar.render(baseState({ duration: NaN }));
    bar.render(baseState());
    const host = document.querySelector('[data-igrc="host"]');
    expect(host.style.display).toBe('block');
  });

  it('mount 之前呼叫 render 不會拋錯', () => {
    expect(() => bar.render(baseState())).not.toThrow();
  });

  it('mount 之前呼叫 syncTo 不會拋錯', () => {
    expect(() => bar.syncTo({ left: 0, bottom: 0, width: 100 })).not.toThrow();
  });

  it('destroy 會把 host 從文件移除', () => {
    bar.mount();
    bar.destroy();
    expect(document.querySelector('[data-igrc="host"]')).toBe(null);
  });

  it('hitElement 與 trackElement 在 mount 後可取用', () => {
    bar.mount();
    expect(bar.hitElement).not.toBe(null);
    expect(bar.trackElement).not.toBe(null);
  });
});

describe('ProgressBar.applySettings', () => {
  let bar;

  beforeEach(() => {
    document.body.innerHTML = '';
    bar = new ProgressBar(document);
  });

  afterEach(() => {
    bar.destroy();
    document.body.innerHTML = '';
  });

  it('把粗細寫成閒置與 hover 兩個自訂屬性', () => {
    bar.mount();
    bar.applySettings({ barThickness: 5 });
    const host = document.querySelector('[data-igrc="host"]');
    expect(host.style.getPropertyValue('--igrc-bar-idle')).toBe('5px');
    expect(host.style.getPropertyValue('--igrc-bar-hover')).toBe('10px');
  });

  it('把圓點大小寫成自訂屬性', () => {
    bar.mount();
    bar.applySettings({ handleSize: 18 });
    const host = document.querySelector('[data-igrc="host"]');
    expect(host.style.getPropertyValue('--igrc-handle')).toBe('18px');
  });

  it('把感應區高度寫成帶單位的自訂屬性', () => {
    bar.mount();
    bar.applySettings({ hitZoneHeight: 24 });
    const host = document.querySelector('[data-igrc="host"]');
    expect(host.style.getPropertyValue('--igrc-hit-zone')).toBe('24px');
  });

  it('關閉時間標籤時寫入 display none', () => {
    bar.mount();
    bar.applySettings({ showLabel: false });
    const host = document.querySelector('[data-igrc="host"]');
    expect(host.style.getPropertyValue('--igrc-label-display')).toBe('none');
  });

  it('mount 之前套用設定不會拋錯，mount 之後會補上', () => {
    expect(() => bar.applySettings({ barThickness: 7 })).not.toThrow();
    bar.mount();
    const host = document.querySelector('[data-igrc="host"]');
    expect(host.style.getPropertyValue('--igrc-bar-idle')).toBe('7px');
  });

  it('重複套用會覆蓋前一次的值', () => {
    bar.mount();
    bar.applySettings({ handleSize: 20 });
    bar.applySettings({ handleSize: 10 });
    const host = document.querySelector('[data-igrc="host"]');
    expect(host.style.getPropertyValue('--igrc-handle')).toBe('10px');
  });

  it('套用設定不會重建 shadow DOM，正在拖曳的狀態得以保留', () => {
    bar.mount();
    const before = bar.hitElement;
    bar.applySettings({ barThickness: 6 });
    expect(bar.hitElement).toBe(before);
  });
});

describe('ProgressBar.applyCorners', () => {
  let bar;

  beforeEach(() => {
    document.body.innerHTML = '';
    bar = new ProgressBar(document);
  });

  afterEach(() => {
    bar.destroy();
    document.body.innerHTML = '';
  });

  const host = () => document.querySelector('[data-igrc="host"]');

  it('有圓角時裁切浮層，避免進度條凸出圓角外', () => {
    bar.mount();
    bar.applyCorners({ left: 22, right: 22 });
    expect(host().style.borderBottomLeftRadius).toBe('22px');
    expect(host().style.borderBottomRightRadius).toBe('22px');
    expect(host().style.overflow).toBe('hidden');
  });

  it('左右半徑不同時分別套用', () => {
    bar.mount();
    bar.applyCorners({ left: 4, right: 16 });
    expect(host().style.borderBottomLeftRadius).toBe('4px');
    expect(host().style.borderBottomRightRadius).toBe('16px');
  });

  it('沒有圓角時不裁切，否則圓點在兩端會被切掉一半', () => {
    bar.mount();
    bar.applyCorners({ left: 0, right: 0 });
    expect(host().style.overflow).toBe('visible');
  });

  it('從有圓角切回無圓角時會解除裁切', () => {
    bar.mount();
    bar.applyCorners({ left: 22, right: 22 });
    bar.applyCorners({ left: 0, right: 0 });
    expect(host().style.overflow).toBe('visible');
    expect(host().style.borderBottomLeftRadius).toBe('0px');
  });

  it('不帶參數呼叫視為沒有圓角', () => {
    bar.mount();
    bar.applyCorners();
    expect(host().style.overflow).toBe('visible');
  });

  it('mount 之前呼叫不會拋錯，mount 之後會補上', () => {
    expect(() => bar.applyCorners({ left: 12, right: 12 })).not.toThrow();
    bar.mount();
    expect(host().style.borderBottomLeftRadius).toBe('12px');
    expect(host().style.overflow).toBe('hidden');
  });
});
