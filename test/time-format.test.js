import { describe, it, expect } from 'vitest';
import { formatTime } from '../lib/time-format.js';

describe('formatTime', () => {
  it('把 0 秒格式化成 0:00', () => {
    expect(formatTime(0)).toBe('0:00');
  });

  it('個位數秒數補零', () => {
    expect(formatTime(7)).toBe('0:07');
  });

  it('小數點無條件捨去', () => {
    expect(formatTime(7.9)).toBe('0:07');
  });

  it('超過一分鐘會進位', () => {
    expect(formatTime(67)).toBe('1:07');
  });

  it('59:59 是兩位數分鐘的邊界', () => {
    expect(formatTime(3599)).toBe('59:59');
  });

  it('超過一小時仍以分鐘表示，不進位成小時', () => {
    expect(formatTime(3600)).toBe('60:00');
  });

  it('NaN 視為 0:00', () => {
    expect(formatTime(NaN)).toBe('0:00');
  });

  it('Infinity 視為 0:00', () => {
    expect(formatTime(Infinity)).toBe('0:00');
  });

  it('負數視為 0:00', () => {
    expect(formatTime(-5)).toBe('0:00');
  });

  it('undefined 視為 0:00', () => {
    expect(formatTime(undefined)).toBe('0:00');
  });
});
