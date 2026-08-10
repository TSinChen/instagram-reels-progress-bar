import { describe, it, expect } from 'vitest';
import { visibleArea, ratioFromPointerX, timeFromRatio } from '../lib/geometry.js';

const viewport = { width: 1000, height: 800 };

describe('visibleArea', () => {
  it('returns the full area when fully on screen', () => {
    const rect = { left: 100, top: 100, right: 300, bottom: 400 };
    expect(visibleArea(rect, viewport)).toBe(200 * 300);
  });

  it('counts only the visible part when the top overflows', () => {
    const rect = { left: 0, top: -100, right: 200, bottom: 100 };
    expect(visibleArea(rect, viewport)).toBe(200 * 100);
  });

  it('counts only the visible part when the bottom overflows', () => {
    const rect = { left: 0, top: 700, right: 200, bottom: 900 };
    expect(visibleArea(rect, viewport)).toBe(200 * 100);
  });

  it('clamps to the viewport width when both sides overflow', () => {
    const rect = { left: -50, top: 0, right: 1050, bottom: 100 };
    expect(visibleArea(rect, viewport)).toBe(1000 * 100);
  });

  it('returns zero when entirely above the viewport', () => {
    const rect = { left: 0, top: -300, right: 200, bottom: -100 };
    expect(visibleArea(rect, viewport)).toBe(0);
  });

  it('returns zero when entirely below the viewport', () => {
    const rect = { left: 0, top: 900, right: 200, bottom: 1100 };
    expect(visibleArea(rect, viewport)).toBe(0);
  });

  it('counts a rect flush with the edge as not visible', () => {
    const rect = { left: 0, top: 800, right: 200, bottom: 1000 };
    expect(visibleArea(rect, viewport)).toBe(0);
  });
});

describe('ratioFromPointerX', () => {
  const barRect = { left: 100, width: 400 };

  it('returns 0 at the left edge', () => {
    expect(ratioFromPointerX(100, barRect)).toBe(0);
  });

  it('returns 0.5 at the midpoint', () => {
    expect(ratioFromPointerX(300, barRect)).toBe(0.5);
  });

  it('returns 1 at the right edge', () => {
    expect(ratioFromPointerX(500, barRect)).toBe(1);
  });

  it('clamps to 0 left of the bar', () => {
    expect(ratioFromPointerX(-200, barRect)).toBe(0);
  });

  it('clamps to 1 right of the bar', () => {
    expect(ratioFromPointerX(9999, barRect)).toBe(1);
  });

  it('returns 0 for zero width rather than dividing by zero', () => {
    expect(ratioFromPointerX(300, { left: 100, width: 0 })).toBe(0);
  });

  it('returns 0 for a null rect', () => {
    expect(ratioFromPointerX(300, null)).toBe(0);
  });
});

describe('timeFromRatio', () => {
  it('scales the ratio by the duration', () => {
    expect(timeFromRatio(0.5, 60)).toBe(30);
  });

  it('returns 0 for ratio 0', () => {
    expect(timeFromRatio(0, 60)).toBe(0);
  });

  it('returns the full duration for ratio 1', () => {
    expect(timeFromRatio(1, 60)).toBe(60);
  });

  it('returns 0 for a zero duration', () => {
    expect(timeFromRatio(0.5, 0)).toBe(0);
  });

  it('returns 0 for a NaN duration', () => {
    expect(timeFromRatio(0.5, NaN)).toBe(0);
  });

  it('returns 0 for an infinite duration (live video)', () => {
    expect(timeFromRatio(0.5, Infinity)).toBe(0);
  });
});
