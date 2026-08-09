// 找出影片底部兩個角的圓角半徑。
//
// 浮層是 position: fixed 掛在 body 上，不會被影片容器的 overflow: hidden
// 裁到，所以圓角影片的進度條兩端會凸出去，得自己裁。

/** 百分比半徑是橢圓，硬套會畫錯，當作沒有。 */
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
 * 回傳 { left, right }（px），找不到就是 0。
 *
 * 圓角通常不在 <video> 身上而在某個 overflow: hidden 的外層，所以要往上找。
 * getStyle 注入進來讓測試好替換，正式呼叫端傳 (el) => win.getComputedStyle(el)。
 */
export function bottomRadiiFor(video, getStyle, maxDepth = 5) {
  if (!video) return { left: 0, right: 0 };

  const own = readBottomRadii(getStyle(video));
  if (own.left || own.right) return own;

  let node = video.parentElement;
  for (let depth = 0; node && depth < maxDepth; depth += 1) {
    const style = getStyle(node);
    // 同時有裁切與圓角，這層才是實際把影片切圓的那一層
    if (clipsOverflow(style)) {
      const radii = readBottomRadii(style);
      if (radii.left || radii.right) return radii;
    }
    node = node.parentElement;
  }

  return { left: 0, right: 0 };
}
