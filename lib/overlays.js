// Panels Instagram draws on top of the video, and the width they leave for the bar.
//
// On the Reels page the comment panel opens over the right of the video instead of beside
// it, so a bar spanning the full video width paints across the panel and swallows clicks
// meant for its comment box.

const OVERLAY_SELECTOR = '[role="dialog"], dialog[open]';

/** A dialog that contains the video is the video's own container, not something over it. */
export function overlayRectsFor(root, video, getRect = (el) => el.getBoundingClientRect()) {
  const rects = [];
  for (const el of root.querySelectorAll(OVERLAY_SELECTOR)) {
    if (el.contains(video)) continue;
    const rect = getRect(el);
    if (rect.width > 0 && rect.height > 0) rects.push(rect);
  }
  return rects;
}

/**
 * The widest run along the video's bottom edge that no overlay covers, or null when every
 * part of it is covered.
 *
 * Only overlays reaching into the band the bar occupies count. A panel that ends above it
 * is not in the way, which is what happens on a portrait reel.
 */
export function clearSpanFor(rect, bandHeight, overlays) {
  const bandTop = rect.bottom - bandHeight;
  const blocked = [];

  for (const overlay of overlays) {
    if (overlay.bottom <= bandTop || overlay.top >= rect.bottom) continue;
    const left = Math.max(overlay.left, rect.left);
    const right = Math.min(overlay.right, rect.right);
    if (right > left) blocked.push({ left, right });
  }

  if (blocked.length === 0) return { left: rect.left, right: rect.right };

  blocked.sort((a, b) => a.left - b.left);
  let widest = null;
  let cursor = rect.left;
  for (const block of blocked) {
    if (block.left - cursor > widthOf(widest)) widest = { left: cursor, right: block.left };
    if (block.right > cursor) cursor = block.right;
  }
  if (rect.right - cursor > widthOf(widest)) widest = { left: cursor, right: rect.right };

  return widest;
}

function widthOf(span) {
  return span ? span.right - span.left : 0;
}
