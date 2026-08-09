import { describe, it, expect } from 'vitest';
import { bufferedEndFor, isStalled } from '../src/content/media-state.js';

/** 做一個假的 TimeRanges。ranges 是 [[start, end], ...]。 */
function fakeTimeRanges(ranges) {
  return {
    length: ranges.length,
    start: (i) => ranges[i][0],
    end: (i) => ranges[i][1],
  };
}

describe('bufferedEndFor', () => {
  it('沒有緩衝資料時回傳 0', () => {
    const video = { buffered: fakeTimeRanges([]), currentTime: 0 };
    expect(bufferedEndFor(video)).toBe(0);
  });

  it('buffered 為 undefined 時回傳 0', () => {
    const video = { buffered: undefined, currentTime: 0 };
    expect(bufferedEndFor(video)).toBe(0);
  });

  it('單一緩衝區時回傳它的終點', () => {
    const video = { buffered: fakeTimeRanges([[0, 12.5]]), currentTime: 3 };
    expect(bufferedEndFor(video)).toBe(12.5);
  });

  it('多段緩衝區時回傳目前位置所在那段的終點', () => {
    const video = {
      buffered: fakeTimeRanges([[0, 10], [20, 30]]),
      currentTime: 22,
    };
    expect(bufferedEndFor(video)).toBe(30);
  });

  it('目前位置在緩衝區之間的空隙時，回傳最後一段的終點', () => {
    const video = {
      buffered: fakeTimeRanges([[0, 10], [20, 30]]),
      currentTime: 15,
    };
    expect(bufferedEndFor(video)).toBe(30);
  });

  it('目前位置剛好在某段的起點時仍算在那段內', () => {
    const video = {
      buffered: fakeTimeRanges([[0, 10], [20, 30]]),
      currentTime: 20,
    };
    expect(bufferedEndFor(video)).toBe(30);
  });

  it('目前位置剛好在某段的終點時仍算在那段內', () => {
    const video = {
      buffered: fakeTimeRanges([[0, 10], [20, 30]]),
      currentTime: 10,
    };
    expect(bufferedEndFor(video)).toBe(10);
  });
});

describe('isStalled', () => {
  const THRESHOLD = 1500;

  it('沒有 seek 過就不算卡頓', () => {
    const video = { readyState: 1, paused: false };
    expect(isStalled(video, 0, 99999, THRESHOLD)).toBe(false);
  });

  it('資料充足時不算卡頓', () => {
    const video = { readyState: 4, paused: false };
    expect(isStalled(video, 1000, 5000, THRESHOLD)).toBe(false);
  });

  it('使用者自己暫停時不算卡頓', () => {
    const video = { readyState: 1, paused: true };
    expect(isStalled(video, 1000, 5000, THRESHOLD)).toBe(false);
  });

  it('seek 後資料不足但還沒超過門檻時不算卡頓', () => {
    const video = { readyState: 1, paused: false };
    expect(isStalled(video, 1000, 2000, THRESHOLD)).toBe(false);
  });

  it('seek 後資料不足且超過門檻就算卡頓', () => {
    const video = { readyState: 1, paused: false };
    expect(isStalled(video, 1000, 3000, THRESHOLD)).toBe(true);
  });

  it('readyState 3 代表能繼續播，不算卡頓', () => {
    const video = { readyState: 3, paused: false };
    expect(isStalled(video, 1000, 9999, THRESHOLD)).toBe(false);
  });
});
