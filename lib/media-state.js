// 播放狀態的純邏輯。吃普通物件，不需要真的 video 元素。

/**
 * 從現在往後能連續播到哪。
 * MSE 串流的 buffered 可能有多段，位置落在空隙時回傳最後一段的終點。
 */
export function bufferedEndFor(video) {
  const buffered = video.buffered;
  if (!buffered || buffered.length === 0) return 0;
  const t = video.currentTime;
  for (let i = 0; i < buffered.length; i += 1) {
    if (t >= buffered.start(i) && t <= buffered.end(i)) {
      return buffered.end(i);
    }
  }
  return buffered.end(buffered.length - 1);
}

/** readyState >= 3（HAVE_FUTURE_DATA）代表能繼續播；使用者自己暫停也不算卡頓。 */
export function isStalled(video, lastSeekAt, now, thresholdMs) {
  if (!lastSeekAt) return false;
  if (video.readyState >= 3) return false;
  if (video.paused) return false;
  return now - lastSeekAt > thresholdMs;
}
