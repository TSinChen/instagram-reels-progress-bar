// Bottom corner radii of the video.
//
// A fixed-position overlay on body is not clipped by an ancestor overflow, so over a
// rounded video the bar would protrude past the curve unless it clips itself.

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
 * Returns { left, right } in px, or zeros when nothing clips the video.
 *
 * The radius usually sits on an ancestor that clips, not on the video itself.
 * getStyle is injected so tests can supply their own.
 */
export function bottomRadiiFor(video, getStyle, maxDepth = 5) {
  if (!video) return { left: 0, right: 0 };

  const own = readBottomRadii(getStyle(video));
  if (own.left || own.right) return own;

  let node = video.parentElement;
  for (let depth = 0; node && depth < maxDepth; depth += 1) {
    const style = getStyle(node);
    // Only an element that both clips and rounds is the one shaping the video
    if (clipsOverflow(style)) {
      const radii = readBottomRadii(style);
      if (radii.left || radii.right) return radii;
    }
    node = node.parentElement;
  }

  return { left: 0, right: 0 };
}
