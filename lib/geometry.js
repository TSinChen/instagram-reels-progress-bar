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

function clipsAxis(value) {
  return typeof value === 'string' && (
    value.includes('hidden') ||
    value.includes('clip') ||
    value.includes('scroll') ||
    value.includes('auto')
  );
}

/**
 * The portion of the video's box that survives every clipping ancestor.
 *
 * Carousel slides sit side by side in a strip wider than the post, with the inactive
 * slides hidden only by the frame's overflow clip. Their raw rects still fall inside the
 * desktop viewport, so without this they look fully visible.
 */
export function clippedRectFor(
  video,
  getStyle,
  getRect = (el) => el.getBoundingClientRect(),
) {
  if (!video) return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };

  const videoRect = getRect(video);
  let { left, top, right, bottom } = videoRect;

  if (typeof getStyle === 'function') {
    let node = video.parentElement;
    while (node && node.tagName !== 'BODY' && node.tagName !== 'HTML') {
      const style = getStyle(node);
      if (style) {
        const clipX = clipsAxis(style.overflow) || clipsAxis(style.overflowX);
        const clipY = clipsAxis(style.overflow) || clipsAxis(style.overflowY);
        if (clipX || clipY) {
          const rect = getRect(node);
          if (clipX) {
            left = Math.max(left, rect.left);
            right = Math.min(right, rect.right);
          }
          if (clipY) {
            top = Math.max(top, rect.top);
            bottom = Math.min(bottom, rect.bottom);
          }
        }
      }
      node = node.parentElement;
    }
  }

  const width = right > left ? right - left : 0;
  const height = bottom > top ? bottom - top : 0;
  return { left, top, right, bottom, width, height };
}
