// 找出影片底部兩個角的圓角半徑。
//
// 我們的浮層是 position: fixed 掛在 body 上，不會被影片容器的 overflow: hidden
// 裁切。所以只要影片是圓角的，進度條兩端就會凸出到圓角外面。
// 這裡把該有的半徑找出來，讓浮層自己裁掉。
//
// 圓角通常不在 <video> 自己身上，而在某個 overflow: hidden 的外層容器，
// 所以要往上找幾層。層數設上限，避免在 Instagram 那種很深的 DOM 裡白繞。

/** 只認 px。百分比半徑會是橢圓，硬套會畫錯，直接當作沒有。 */
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

/** 這個元素會不會把超出邊界的子元素裁掉。 */
function clipsOverflow(style) {
  const values = [style.overflow, style.overflowX, style.overflowY];
  return values.some((v) => typeof v === 'string' && (v.includes('hidden') || v.includes('clip')));
}

/**
 * 回傳 { left, right } 兩個底角的半徑（px）。找不到就是 0。
 *
 * getStyle 是注入進來的，測試可以給假的，正式呼叫端傳 (el) => win.getComputedStyle(el)。
 */
export function bottomRadiiFor(video, getStyle, maxDepth = 5) {
  if (!video) return { left: 0, right: 0 };

  // 影片自己就有圓角的話最單純
  const own = readBottomRadii(getStyle(video));
  if (own.left || own.right) return own;

  let node = video.parentElement;
  for (let depth = 0; node && depth < maxDepth; depth += 1) {
    const style = getStyle(node);
    if (clipsOverflow(style)) {
      const radii = readBottomRadii(style);
      // 有裁切又有圓角，這層就是實際把影片切圓的那一層
      if (radii.left || radii.right) return radii;
    }
    node = node.parentElement;
  }

  return { left: 0, right: 0 };
}
