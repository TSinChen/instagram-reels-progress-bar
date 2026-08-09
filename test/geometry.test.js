import { describe, it, expect } from 'vitest';
import { visibleArea, ratioFromPointerX, timeFromRatio } from '../lib/geometry.js';

const viewport = { width: 1000, height: 800 };

describe('visibleArea', () => {
  it('完全在視窗內時回傳整個面積', () => {
    const rect = { left: 100, top: 100, right: 300, bottom: 400 };
    expect(visibleArea(rect, viewport)).toBe(200 * 300);
  });

  it('上緣超出視窗時只算露出的部分', () => {
    const rect = { left: 0, top: -100, right: 200, bottom: 100 };
    expect(visibleArea(rect, viewport)).toBe(200 * 100);
  });

  it('下緣超出視窗時只算露出的部分', () => {
    const rect = { left: 0, top: 700, right: 200, bottom: 900 };
    expect(visibleArea(rect, viewport)).toBe(200 * 100);
  });

  it('左右都超出時以視窗寬度為準', () => {
    const rect = { left: -50, top: 0, right: 1050, bottom: 100 };
    expect(visibleArea(rect, viewport)).toBe(1000 * 100);
  });

  it('完全在視窗上方時回傳 0', () => {
    const rect = { left: 0, top: -300, right: 200, bottom: -100 };
    expect(visibleArea(rect, viewport)).toBe(0);
  });

  it('完全在視窗下方時回傳 0', () => {
    const rect = { left: 0, top: 900, right: 200, bottom: 1100 };
    expect(visibleArea(rect, viewport)).toBe(0);
  });

  it('剛好貼齊邊界不算露出', () => {
    const rect = { left: 0, top: 800, right: 200, bottom: 1000 };
    expect(visibleArea(rect, viewport)).toBe(0);
  });
});

describe('ratioFromPointerX', () => {
  const barRect = { left: 100, width: 400 };

  it('指標在左端回傳 0', () => {
    expect(ratioFromPointerX(100, barRect)).toBe(0);
  });

  it('指標在正中央回傳 0.5', () => {
    expect(ratioFromPointerX(300, barRect)).toBe(0.5);
  });

  it('指標在右端回傳 1', () => {
    expect(ratioFromPointerX(500, barRect)).toBe(1);
  });

  it('指標在左端之外夾成 0', () => {
    expect(ratioFromPointerX(-200, barRect)).toBe(0);
  });

  it('指標在右端之外夾成 1', () => {
    expect(ratioFromPointerX(9999, barRect)).toBe(1);
  });

  it('寬度為 0 時回傳 0，不得除以零', () => {
    expect(ratioFromPointerX(300, { left: 100, width: 0 })).toBe(0);
  });

  it('barRect 為 null 時回傳 0', () => {
    expect(ratioFromPointerX(300, null)).toBe(0);
  });
});

describe('timeFromRatio', () => {
  it('比例乘上長度', () => {
    expect(timeFromRatio(0.5, 60)).toBe(30);
  });

  it('比例 0 回傳 0', () => {
    expect(timeFromRatio(0, 60)).toBe(0);
  });

  it('比例 1 回傳全長', () => {
    expect(timeFromRatio(1, 60)).toBe(60);
  });

  it('長度為 0 時回傳 0', () => {
    expect(timeFromRatio(0.5, 0)).toBe(0);
  });

  it('長度為 NaN 時回傳 0', () => {
    expect(timeFromRatio(0.5, NaN)).toBe(0);
  });

  it('長度為 Infinity（直播）時回傳 0', () => {
    expect(timeFromRatio(0.5, Infinity)).toBe(0);
  });
});
