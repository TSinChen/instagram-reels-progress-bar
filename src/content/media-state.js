// 從 video 元素讀出播放狀態的純邏輯。吃普通物件，不需要真的 video 元素。

/**
 * 目前播放位置所在的那段緩衝區的終點秒數。
 * Instagram 用 MSE 串流，buffered 可能有多段不連續的區間，
 * 我們要顯示的是「從現在往後能連續播到哪」。
 * 位置落在空隙時退而回傳最後一段的終點。
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

/**
 * seek 之後是否卡在等資料。
 * readyState >= 3（HAVE_FUTURE_DATA）代表能繼續播，不算卡頓。
 * 使用者自己按暫停也不算。
 */
export function isStalled(video, lastSeekAt, now, thresholdMs) {
  if (!lastSeekAt) return false;
  if (video.readyState >= 3) return false;
  if (video.paused) return false;
  return now - lastSeekAt > thresholdMs;
}
