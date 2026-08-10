// Pure geometry. No DOM access.

/** Area of the rect that falls inside the viewport. */
export function visibleArea(rect, viewport) {
  const left = Math.max(rect.left, 0);
  const top = Math.max(rect.top, 0);
  const right = Math.min(rect.right, viewport.width);
  const bottom = Math.min(rect.bottom, viewport.height);
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return 0;
  return width * height;
}

/** Pointer position as a 0..1 fraction of the bar. Zero width yields 0 rather than NaN. */
export function ratioFromPointerX(pointerX, barRect) {
  if (!barRect || !(barRect.width > 0)) return 0;
  const raw = (pointerX - barRect.left) / barRect.width;
  if (raw < 0) return 0;
  if (raw > 1) return 1;
  return raw;
}

/** Returns 0 when duration is unusable: metadata not loaded, or Infinity for live video. */
export function timeFromRatio(ratio, duration) {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return ratio * duration;
}
