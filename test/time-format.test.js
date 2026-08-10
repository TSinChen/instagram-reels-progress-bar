import { describe, it, expect } from 'vitest';
import { formatTime } from '../lib/time-format.js';

describe('formatTime', () => {
  it('formats zero as 0:00', () => {
    expect(formatTime(0)).toBe('0:00');
  });

  it('pads single-digit seconds', () => {
    expect(formatTime(7)).toBe('0:07');
  });

  it('truncates fractional seconds', () => {
    expect(formatTime(7.9)).toBe('0:07');
  });

  it('rolls over past a minute', () => {
    expect(formatTime(67)).toBe('1:07');
  });

  it('59:59 is the two-digit minute boundary', () => {
    expect(formatTime(3599)).toBe('59:59');
  });

  it('past an hour it keeps counting minutes rather than adding hours', () => {
    expect(formatTime(3600)).toBe('60:00');
  });

  it('NaN formats as 0:00', () => {
    expect(formatTime(NaN)).toBe('0:00');
  });

  it('Infinity formats as 0:00', () => {
    expect(formatTime(Infinity)).toBe('0:00');
  });

  it('a negative value formats as 0:00', () => {
    expect(formatTime(-5)).toBe('0:00');
  });

  it('undefined formats as 0:00', () => {
    expect(formatTime(undefined)).toBe('0:00');
  });
});
