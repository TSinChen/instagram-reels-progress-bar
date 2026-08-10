// Pure playback-state logic. Takes plain objects; no real video element required.

/**
 * How far playback can continue uninterrupted from the current position.
 * MSE buffers can be fragmented; a position inside a gap falls back to the last range.
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

/** readyState >= 3 (HAVE_FUTURE_DATA) means playback can continue. A user pause is not a stall. */
export function isStalled(video, lastSeekAt, now, thresholdMs) {
  if (!lastSeekAt) return false;
  if (video.readyState >= 3) return false;
  if (video.paused) return false;
  return now - lastSeekAt > thresholdMs;
}
