import { describe, it, expect } from 'vitest';
import { bufferedEndFor, isStalled } from '../lib/media-state.js';

/** A stand-in TimeRanges built from [[start, end], ...]. */
function fakeTimeRanges(ranges) {
  return {
    length: ranges.length,
    start: (i) => ranges[i][0],
    end: (i) => ranges[i][1],
  };
}

describe('bufferedEndFor', () => {
  it('returns 0 with no buffered data', () => {
    const video = { buffered: fakeTimeRanges([]), currentTime: 0 };
    expect(bufferedEndFor(video)).toBe(0);
  });

  it('returns 0 when buffered is undefined', () => {
    const video = { buffered: undefined, currentTime: 0 };
    expect(bufferedEndFor(video)).toBe(0);
  });

  it('returns the end of a single range', () => {
    const video = { buffered: fakeTimeRanges([[0, 12.5]]), currentTime: 3 };
    expect(bufferedEndFor(video)).toBe(12.5);
  });

  it('returns the end of the range containing the current position', () => {
    const video = {
      buffered: fakeTimeRanges([[0, 10], [20, 30]]),
      currentTime: 22,
    };
    expect(bufferedEndFor(video)).toBe(30);
  });

  it('falls back to the last range when the position is in a gap', () => {
    const video = {
      buffered: fakeTimeRanges([[0, 10], [20, 30]]),
      currentTime: 15,
    };
    expect(bufferedEndFor(video)).toBe(30);
  });

  it('a position exactly at a range start counts as inside it', () => {
    const video = {
      buffered: fakeTimeRanges([[0, 10], [20, 30]]),
      currentTime: 20,
    };
    expect(bufferedEndFor(video)).toBe(30);
  });

  it('a position exactly at a range end counts as inside it', () => {
    const video = {
      buffered: fakeTimeRanges([[0, 10], [20, 30]]),
      currentTime: 10,
    };
    expect(bufferedEndFor(video)).toBe(10);
  });
});

describe('isStalled', () => {
  const THRESHOLD = 1500;

  it('no stall without a preceding seek', () => {
    const video = { readyState: 1, paused: false };
    expect(isStalled(video, 0, 99999, THRESHOLD)).toBe(false);
  });

  it('no stall while data is available', () => {
    const video = { readyState: 4, paused: false };
    expect(isStalled(video, 1000, 5000, THRESHOLD)).toBe(false);
  });

  it('no stall while the user has paused', () => {
    const video = { readyState: 1, paused: true };
    expect(isStalled(video, 1000, 5000, THRESHOLD)).toBe(false);
  });

  it('no stall before the threshold elapses', () => {
    const video = { readyState: 1, paused: false };
    expect(isStalled(video, 1000, 2000, THRESHOLD)).toBe(false);
  });

  it('stalls once the threshold elapses without data', () => {
    const video = { readyState: 1, paused: false };
    expect(isStalled(video, 1000, 3000, THRESHOLD)).toBe(true);
  });

  it('readyState 3 means playback can continue, so no stall', () => {
    const video = { readyState: 3, paused: false };
    expect(isStalled(video, 1000, 9999, THRESHOLD)).toBe(false);
  });
});
