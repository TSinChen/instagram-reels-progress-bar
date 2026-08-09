// 純幾何計算。這個模組不碰 DOM，只吃普通物件，方便測試。

/**
 * 矩形與視窗的交集面積。完全不相交時回傳 0。
 */
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

/**
 * 指標 x 座標在進度條上的比例，夾在 0..1。
 * 寬度為 0 或 barRect 不存在時回傳 0，避免除以零產生 NaN。
 */
export function ratioFromPointerX(pointerX, barRect) {
  if (!barRect || !(barRect.width > 0)) return 0;
  const raw = (pointerX - barRect.left) / barRect.width;
  if (raw < 0) return 0;
  if (raw > 1) return 1;
  return raw;
}

/**
 * 比例換算成秒數。
 * duration 無效（未載入中繼資料、直播的 Infinity）時回傳 0。
 */
export function timeFromRatio(ratio, duration) {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return ratio * duration;
}
