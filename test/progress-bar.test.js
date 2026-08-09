import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProgressBar } from '../src/content/progress-bar.js';
import { HOST_HEIGHT } from '../src/content/config.js';

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
