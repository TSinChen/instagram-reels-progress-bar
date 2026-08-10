import { describe, it, expect } from 'vitest';
import { overlayRectsFor, clearSpanFor } from '../lib/overlays.js';

function box(left, top, right, bottom) {
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

/** A landscape video; the bar occupies the bottom 16px, so the band is y 624..640. */
const VIDEO = box(100, 100, 500, 640);
const BAND = 16;

const span = (left, right) => ({ left, right });

describe('clearSpanFor', () => {
  it('gives the whole width when nothing overlaps', () => {
    expect(clearSpanFor(VIDEO, BAND, [])).toEqual(span(100, 500));
  });

  it('ignores a panel that ends above the band', () => {
    // A portrait reel is taller than the comment panel, so the bar clears it
    expect(clearSpanFor(VIDEO, BAND, [box(380, 60, 540, 610)])).toEqual(span(100, 500));
  });

  it('ignores a panel that starts below the video', () => {
    expect(clearSpanFor(VIDEO, BAND, [box(380, 660, 540, 900)])).toEqual(span(100, 500));
  });

  it('ignores a panel beside the video', () => {
    expect(clearSpanFor(VIDEO, BAND, [box(520, 100, 800, 700)])).toEqual(span(100, 500));
  });

  it('stops the bar where a panel over the right of the video begins', () => {
    expect(clearSpanFor(VIDEO, BAND, [box(380, 60, 540, 700)])).toEqual(span(100, 380));
  });

  it('starts the bar where a panel over the left of the video ends', () => {
    expect(clearSpanFor(VIDEO, BAND, [box(0, 60, 260, 700)])).toEqual(span(260, 500));
  });

  it('takes the wider side when a panel sits in the middle', () => {
    expect(clearSpanFor(VIDEO, BAND, [box(200, 60, 260, 700)])).toEqual(span(260, 500));
    expect(clearSpanFor(VIDEO, BAND, [box(300, 60, 400, 700)])).toEqual(span(100, 300));
  });

  it('returns null when the whole bottom edge is covered', () => {
    expect(clearSpanFor(VIDEO, BAND, [box(0, 0, 900, 900)])).toBe(null);
  });

  it('merges panels that overlap each other', () => {
    const overlays = [box(200, 60, 320, 700), box(280, 60, 460, 700)];
    expect(clearSpanFor(VIDEO, BAND, overlays)).toEqual(span(100, 200));
  });

  it('picks the widest gap between several panels', () => {
    const overlays = [box(120, 60, 160, 700), box(400, 60, 440, 700)];
    // gaps: 100..120 (20), 160..400 (240), 440..500 (60)
    expect(clearSpanFor(VIDEO, BAND, overlays)).toEqual(span(160, 400));
  });

  it('is unaffected by the order panels arrive in', () => {
    const a = box(120, 60, 160, 700);
    const b = box(400, 60, 440, 700);
    expect(clearSpanFor(VIDEO, BAND, [a, b])).toEqual(clearSpanFor(VIDEO, BAND, [b, a]));
  });

  it('treats a panel resting exactly on the band top as clear', () => {
    expect(clearSpanFor(VIDEO, BAND, [box(380, 60, 540, 624)])).toEqual(span(100, 500));
  });

  it('catches a panel that dips one pixel into the band', () => {
    expect(clearSpanFor(VIDEO, BAND, [box(380, 60, 540, 625)])).toEqual(span(100, 380));
  });

  it('grows the band with the hit zone setting', () => {
    const panel = [box(380, 60, 540, 615)];
    expect(clearSpanFor(VIDEO, 16, panel)).toEqual(span(100, 500));
    expect(clearSpanFor(VIDEO, 32, panel)).toEqual(span(100, 380));
  });

  it('returns the sliver left over rather than deciding it is too small', () => {
    // Whether a sliver is worth drawing is the caller's policy, not geometry
    expect(clearSpanFor(VIDEO, BAND, [box(0, 60, 490, 700)])).toEqual(span(490, 500));
  });
});

/** Builds a document fragment whose elements report the rects the test names. */
function scope(entries) {
  const root = document.createElement('div');
  const video = document.createElement('video');
  const rects = new Map();

  for (const { tag = 'div', attrs = {}, rect, holdsVideo = false } of entries) {
    const el = document.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
    if (holdsVideo) el.appendChild(video);
    if (rect) rects.set(el, rect);
    root.appendChild(el);
  }
  if (!video.parentElement) root.appendChild(video);

  return { root, video, getRect: (el) => rects.get(el) || box(0, 0, 0, 0) };
}

const DIALOG = { attrs: { role: 'dialog' } };

describe('overlayRectsFor', () => {
  it('finds a dialog drawn over the video', () => {
    const { root, video, getRect } = scope([{ ...DIALOG, rect: box(380, 60, 540, 700) }]);
    expect(overlayRectsFor(root, video, getRect)).toEqual([box(380, 60, 540, 700)]);
  });

  it('skips a dialog that contains the video', () => {
    // The post lightbox is itself a dialog, with the video inside it
    const { root, video, getRect } = scope([
      { ...DIALOG, rect: box(0, 0, 900, 700), holdsVideo: true },
    ]);
    expect(overlayRectsFor(root, video, getRect)).toEqual([]);
  });

  it('still reports a nested dialog beside the video inside a lightbox', () => {
    const { root, video, getRect } = scope([
      { ...DIALOG, rect: box(0, 0, 900, 700), holdsVideo: true },
      { ...DIALOG, rect: box(380, 60, 540, 700) },
    ]);
    expect(overlayRectsFor(root, video, getRect)).toEqual([box(380, 60, 540, 700)]);
  });

  it('skips collapsed dialogs', () => {
    const { root, video, getRect } = scope([{ ...DIALOG, rect: box(0, 0, 0, 0) }]);
    expect(overlayRectsFor(root, video, getRect)).toEqual([]);
  });

  it('finds an open native dialog and ignores a closed one', () => {
    const { root, video, getRect } = scope([
      { tag: 'dialog', attrs: { open: '' }, rect: box(200, 60, 300, 700) },
      { tag: 'dialog', rect: box(0, 60, 100, 700) },
    ]);
    expect(overlayRectsFor(root, video, getRect)).toEqual([box(200, 60, 300, 700)]);
  });

  it('ignores everything that is not a dialog', () => {
    const { root, video, getRect } = scope([
      { attrs: { role: 'button' }, rect: box(100, 100, 500, 640) },
      { attrs: { role: 'presentation' }, rect: box(100, 100, 500, 640) },
    ]);
    expect(overlayRectsFor(root, video, getRect)).toEqual([]);
  });
});
