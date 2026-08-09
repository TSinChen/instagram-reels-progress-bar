// 所有可調數值集中在這裡。其他模組不得寫死尺寸、顏色或時間常數。

// ── 版面尺寸 ──────────────────────────────────────────────
/** Shadow host 的高度。下緣對齊影片下緣，上半部用來放時間標籤。 */
export const HOST_HEIGHT = 48;
/** host 內部真正接收指標事件的底部條帶高度。這是唯一會攔截 Instagram 原生點擊的區域。 */
export const HIT_ZONE_HEIGHT = 16;
/** 閒置時的進度條高度。 */
export const BAR_HEIGHT_IDLE = 3;
/** hover 或拖曳時的進度條高度。 */
export const BAR_HEIGHT_HOVER = 6;
/** 拖曳圓點直徑。 */
export const HANDLE_SIZE = 12;

// ── 顏色 ─────────────────────────────────────────────────
// 已播放用白色而非 YouTube 的紅色，比較貼合 Instagram 的視覺調性。
// 想換成紅色改成 '#ff0033'，想換成 Instagram 藍改成 '#0095F6'。
export const COLOR_PLAYED = '#ffffff';
export const COLOR_BUFFERED = 'rgba(255, 255, 255, 0.45)';
export const COLOR_TRACK = 'rgba(255, 255, 255, 0.25)';
export const COLOR_HANDLE = '#ffffff';

// ── 作用中影片的選取規則 ───────────────────────────────────
/** 小於這個寬或高的 video 元素視為縮圖或隱藏的預載元素，直接略過。 */
export const MIN_VIDEO_SIZE = 80;
/** 影片露出比例低於這個值就不列入候選。 */
export const MIN_VISIBLE_RATIO = 0.5;
/** 兩支影片的可視面積差距在這個比例內視為平手，此時優先選播放中的那支。 */
export const AREA_TIE_TOLERANCE = 0.05;

// ── 時間常數 ─────────────────────────────────────────────
/** 重新評估作用中影片的間隔。 */
export const SELECT_INTERVAL_MS = 200;
/** DOM 變動後延遲多久才重新評估，避免 React 連續重繪時空轉。 */
export const MUTATION_DEBOUNCE_MS = 150;
/** seek 後超過這個時間仍未取得足夠資料就顯示卡頓指示。 */
export const STALL_THRESHOLD_MS = 1500;

// ── 其他 ─────────────────────────────────────────────────
/** 浮層的 z-index。刻意略低於 int32 上限，留空間給真正需要蓋在最上層的東西。 */
export const Z_INDEX = 2147483000;
