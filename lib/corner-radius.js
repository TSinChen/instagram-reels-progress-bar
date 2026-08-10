// Bottom corner radii of the video.
//
// A fixed-position overlay on body is not clipped by an ancestor overflow, so over a
// rounded video the bar would protrude past the curve unless it clips itself.

/** Tolerance for subpixel layout when matching an ancestor's edges to the video's. */
const EDGE_EPSILON = 1;

/** Percentage radii describe an ellipse; applying them verbatim draws the wrong shape. */
function parsePx(value) {
  if (typeof value !== 'string' || value.includes('%')) return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function readBottomRadii(style) {
  return {
    left: parsePx(style.borderBottomLeftRadius),
    right: parsePx(style.borderBottomRightRadius),
  };
}

function clipsOverflow(style) {
  const values = [style.overflow, style.overflowX, style.overflowY];
  return values.some((v) => typeof v === 'string' && (v.includes('hidden') || v.includes('clip')));
}

/**
 * Returns { left, right } in px, or zeros when nothing rounds the video's bottom corners.
 *
 * The radius usually sits on an ancestor that clips, not on the video itself. Each corner
 * is taken only when that ancestor's edge actually coincides with the video's — a
 * container wider than the video (a lightbox with a comment column beside it) rounds its
 * own corner somewhere else entirely, and copying that radius would draw a curve where
 * the video has a square edge.
 *
 * getStyle and getRect are injected so tests can supply their own.
 */
export function bottomRadiiFor(
  video,
  getStyle,
  maxDepth = 5,
  getRect = (el) => el.getBoundingClientRect(),
) {
  if (!video) return { left: 0, right: 0 };

  const own = readBottomRadii(getStyle(video));
  if (own.left || own.right) return own;

  const videoRect = getRect(video);
  let node = video.parentElement;

  for (let depth = 0; node && depth < maxDepth; depth += 1) {
    const style = getStyle(node);
    if (clipsOverflow(style)) {
      const radii = readBottomRadii(style);
      const rect = getRect(node);
      const sharesBottom = Math.abs(rect.bottom - videoRect.bottom) <= EDGE_EPSILON;
      const left = sharesBottom && Math.abs(rect.left - videoRect.left) <= EDGE_EPSILON
        ? radii.left : 0;
      const right = sharesBottom && Math.abs(rect.right - videoRect.right) <= EDGE_EPSILON
        ? radii.right : 0;
      // Neither corner lines up, so keep looking outwards rather than giving up here
      if (left || right) return { left, right };
    }
    node = node.parentElement;
  }

  return { left: 0, right: 0 };
}
