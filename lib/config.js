// 不開放給使用者調的常數。可調的在 settings.js。

/** 浮層高度。下緣對齊影片下緣，上半部放時間標籤。 */
export const HOST_HEIGHT = 48;
/** 感應區、進度條、圓點的預設值，被 settings 的 CSS 變數覆蓋前的 fallback。 */
export const HIT_ZONE_HEIGHT = 16;
export const BAR_HEIGHT_IDLE = 3;
export const BAR_HEIGHT_HOVER = 6;
export const HANDLE_SIZE = 12;

export const COLOR_PLAYED = '#ffffff';
export const COLOR_BUFFERED = 'rgba(255, 255, 255, 0.45)';
export const COLOR_TRACK = 'rgba(255, 255, 255, 0.25)';
export const COLOR_HANDLE = '#ffffff';

/** 小於這個寬或高的 video 視為縮圖或預載元素。 */
export const MIN_VIDEO_SIZE = 80;
/** 露出比例低於此值不列入候選。 */
export const MIN_VISIBLE_RATIO = 0.5;
/** 可視面積差距在此比例內視為平手，改由播放狀態決勝。 */
export const AREA_TIE_TOLERANCE = 0.05;

export const SELECT_INTERVAL_MS = 200;
/** DOM 變動後的 debounce，避免 React 連續重繪時空轉。 */
export const MUTATION_DEBOUNCE_MS = 150;
/** seek 後超過這個時間仍取不到資料就顯示卡頓指示。 */
export const STALL_THRESHOLD_MS = 1500;

export const Z_INDEX = 2147483000;
