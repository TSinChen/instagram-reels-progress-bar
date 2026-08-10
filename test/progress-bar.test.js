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

  it('mount creates a host with a shadow root', () => {
    bar.mount();
    const host = document.querySelector('[data-igrc="host"]');
    expect(host).not.toBe(null);
    expect(host.shadowRoot).not.toBe(null);
  });

  it('a second mount does not create another host', () => {
    bar.mount();
    bar.mount();
    expect(document.querySelectorAll('[data-igrc="host"]').length).toBe(1);
  });

  it('mounting into a different parent moves the host', () => {
    bar.mount();
    const other = document.createElement('div');
    document.body.appendChild(other);
    bar.mount(other);
    expect(document.querySelectorAll('[data-igrc="host"]').length).toBe(1);
    expect(other.querySelector('[data-igrc="host"]')).not.toBe(null);
  });

  it('syncTo aligns the host with the bottom of the video', () => {
    bar.mount();
    bar.syncTo({ left: 120, bottom: 500, width: 360 });
    const host = document.querySelector('[data-igrc="host"]');
    expect(host.style.left).toBe('120px');
    expect(host.style.width).toBe('360px');
    expect(host.style.top).toBe(`${500 - HOST_HEIGHT}px`);
  });

  it('render sizes the played and buffered fills', () => {
    bar.mount();
    bar.render(baseState());
    const root = document.querySelector('[data-igrc="host"]').shadowRoot;
    expect(root.querySelector('.played').style.width).toBe('25%');
    expect(root.querySelector('.buffered').style.width).toBe('50%');
  });

  it('render places the handle at the end of the fill', () => {
    bar.mount();
    bar.render(baseState());
    const root = document.querySelector('[data-igrc="host"]').shadowRoot;
    expect(root.querySelector('.handle').style.left).toBe('25%');
  });

  it('a played time past the duration clamps to 100%', () => {
    bar.mount();
    bar.render(baseState({ playedTime: 999 }));
    const root = document.querySelector('[data-igrc="host"]').shadowRoot;
    expect(root.querySelector('.played').style.width).toBe('100%');
  });

  it('a buffered end past the duration clamps to 100%', () => {
    bar.mount();
    bar.render(baseState({ bufferedEnd: 999 }));
    const root = document.querySelector('[data-igrc="host"]').shadowRoot;
    expect(root.querySelector('.buffered').style.width).toBe('100%');
  });

  it('the label shows the label time and the duration', () => {
    bar.mount();
    bar.render(baseState({ labelTime: 7 }));
    const root = document.querySelector('[data-igrc="host"]').shadowRoot;
    expect(root.querySelector('.label').textContent).toBe('0:07 / 0:40');
  });

  it('the label time and the fill can differ while hovering', () => {
    bar.mount();
    bar.render(baseState({ playedTime: 10, labelTime: 30, active: true }));
    const root = document.querySelector('[data-igrc="host"]').shadowRoot;
    expect(root.querySelector('.played').style.width).toBe('25%');
    expect(root.querySelector('.label').textContent).toBe('0:30 / 0:40');
  });

  it('active adds the is-active class', () => {
    bar.mount();
    bar.render(baseState({ active: true }));
    const root = document.querySelector('[data-igrc="host"]').shadowRoot;
    expect(root.querySelector('.root').classList.contains('is-active')).toBe(true);
  });

  it('dragging adds both is-active and is-dragging', () => {
    bar.mount();
    bar.render(baseState({ active: true, dragging: true }));
    const root = document.querySelector('[data-igrc="host"]').shadowRoot;
    const rootEl = root.querySelector('.root');
    expect(rootEl.classList.contains('is-active')).toBe(true);
    expect(rootEl.classList.contains('is-dragging')).toBe(true);
  });

  it('stalled adds is-stalled to the handle', () => {
    bar.mount();
    bar.render(baseState({ stalled: true }));
    const root = document.querySelector('[data-igrc="host"]').shadowRoot;
    expect(root.querySelector('.handle').classList.contains('is-stalled')).toBe(true);
  });

  it('hides entirely for a NaN duration', () => {
    bar.mount();
    bar.render(baseState({ duration: NaN }));
    const host = document.querySelector('[data-igrc="host"]');
    expect(host.style.display).toBe('none');
  });

  it('hides entirely for an infinite duration (live video)', () => {
    bar.mount();
    bar.render(baseState({ duration: Infinity }));
    const host = document.querySelector('[data-igrc="host"]');
    expect(host.style.display).toBe('none');
  });

  it('hides entirely for a zero duration', () => {
    bar.mount();
    bar.render(baseState({ duration: 0 }));
    const host = document.querySelector('[data-igrc="host"]');
    expect(host.style.display).toBe('none');
  });

  it('reappears once the duration becomes usable again', () => {
    bar.mount();
    bar.render(baseState({ duration: NaN }));
    bar.render(baseState());
    const host = document.querySelector('[data-igrc="host"]');
    expect(host.style.display).toBe('block');
  });

  it('render before mount does not throw', () => {
    expect(() => bar.render(baseState())).not.toThrow();
  });

  it('syncTo before mount does not throw', () => {
    expect(() => bar.syncTo({ left: 0, bottom: 0, width: 100 })).not.toThrow();
  });

  it('destroy removes the host from the document', () => {
    bar.mount();
    bar.destroy();
    expect(document.querySelector('[data-igrc="host"]')).toBe(null);
  });

  it('hitElement and trackElement are available after mount', () => {
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

  it('thickness becomes both the idle and hover custom properties', () => {
    bar.mount();
    bar.applySettings({ barThickness: 5 });
    const host = document.querySelector('[data-igrc="host"]');
    expect(host.style.getPropertyValue('--igrc-bar-idle')).toBe('5px');
    expect(host.style.getPropertyValue('--igrc-bar-hover')).toBe('10px');
  });

  it('handle size becomes a custom property', () => {
    bar.mount();
    bar.applySettings({ handleSize: 18 });
    const host = document.querySelector('[data-igrc="host"]');
    expect(host.style.getPropertyValue('--igrc-handle')).toBe('18px');
  });

  it('hover area height becomes a custom property with units', () => {
    bar.mount();
    bar.applySettings({ hitZoneHeight: 24 });
    const host = document.querySelector('[data-igrc="host"]');
    expect(host.style.getPropertyValue('--igrc-hit-zone')).toBe('24px');
  });

  it('hiding the time label writes display none', () => {
    bar.mount();
    bar.applySettings({ showLabel: false });
    const host = document.querySelector('[data-igrc="host"]');
    expect(host.style.getPropertyValue('--igrc-label-display')).toBe('none');
  });

  it('settings applied before mount are held and applied on mount', () => {
    expect(() => bar.applySettings({ barThickness: 7 })).not.toThrow();
    bar.mount();
    const host = document.querySelector('[data-igrc="host"]');
    expect(host.style.getPropertyValue('--igrc-bar-idle')).toBe('7px');
  });

  it('a later apply overwrites the previous value', () => {
    bar.mount();
    bar.applySettings({ handleSize: 20 });
    bar.applySettings({ handleSize: 10 });
    const host = document.querySelector('[data-igrc="host"]');
    expect(host.style.getPropertyValue('--igrc-handle')).toBe('10px');
  });

  it('applying settings does not rebuild the shadow DOM, so a drag survives', () => {
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

  it('a radius clips the overlay so the bar cannot overhang the corner', () => {
    bar.mount();
    bar.applyCorners({ left: 22, right: 22 });
    expect(host().style.borderBottomLeftRadius).toBe('22px');
    expect(host().style.borderBottomRightRadius).toBe('22px');
    expect(host().style.overflow).toBe('hidden');
  });

  it('applies differing left and right radii', () => {
    bar.mount();
    bar.applyCorners({ left: 4, right: 16 });
    expect(host().style.borderBottomLeftRadius).toBe('4px');
    expect(host().style.borderBottomRightRadius).toBe('16px');
  });

  it('no radius leaves overflow visible, or the handle would be halved at the ends', () => {
    bar.mount();
    bar.applyCorners({ left: 0, right: 0 });
    expect(host().style.overflow).toBe('visible');
  });

  it('going back to no radius removes the clip', () => {
    bar.mount();
    bar.applyCorners({ left: 22, right: 22 });
    bar.applyCorners({ left: 0, right: 0 });
    expect(host().style.overflow).toBe('visible');
    expect(host().style.borderBottomLeftRadius).toBe('0px');
  });

  it('calling with no argument means no radius', () => {
    bar.mount();
    bar.applyCorners();
    expect(host().style.overflow).toBe('visible');
  });

  it('a call before mount is held and applied on mount', () => {
    expect(() => bar.applyCorners({ left: 12, right: 12 })).not.toThrow();
    bar.mount();
    expect(host().style.borderBottomLeftRadius).toBe('12px');
    expect(host().style.overflow).toBe('hidden');
  });
});
