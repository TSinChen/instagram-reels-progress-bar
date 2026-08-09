import {
  HIT_ZONE_HEIGHT,
  BAR_HEIGHT_IDLE,
  BAR_HEIGHT_HOVER,
  HANDLE_SIZE,
  COLOR_PLAYED,
  COLOR_BUFFERED,
  COLOR_TRACK,
  COLOR_HANDLE,
} from './config.js';

/**
 * Shadow root 的樣式。
 *
 * `:host { all: initial }` 連繼承屬性都擋掉，避免 Instagram 的全域字型或
 * 行高設定影響到我們；host 本身的定位是用 inline style 設的，優先權更高不受影響。
 * （`all` 依規範不會重設自訂屬性，所以下面那些 `--igrc-*` 變數不受影響。）
 *
 * 使用者可調的項目一律走 CSS 自訂屬性，由 ProgressBar.applySettings 設在 host 上。
 * 自訂屬性會穿透 shadow 邊界繼承下來，所以設定一改整條進度條就跟著變，
 * 不用重建 DOM 也不用重新整理頁面。每個 var() 都帶預設值，
 * 萬一設定還沒載入完成也不會變成沒有樣式。
 */
export const CSS = `
:host {
  all: initial;
}

.root {
  position: absolute;
  inset: 0;
  pointer-events: none;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans TC", sans-serif;
}

/* 唯一會攔截 Instagram 原生點擊的區域，只有影片底部這條 */
.hit {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: var(--igrc-hit-zone, ${HIT_ZONE_HEIGHT}px);
  pointer-events: auto;
  cursor: pointer;
  touch-action: none;
}

.track {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: ${BAR_HEIGHT_IDLE}px;
  background: var(--igrc-color-track, ${COLOR_TRACK});
  transition: height 120ms ease-out;
  overflow: hidden;
}

.root.is-active .track {
  height: ${BAR_HEIGHT_HOVER}px;
}

.buffered,
.played {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 0;
}

.buffered {
  background: var(--igrc-color-buffered, ${COLOR_BUFFERED});
}

.played {
  background: var(--igrc-color-played, ${COLOR_PLAYED});
}

.handle {
  position: absolute;
  left: 0;
  bottom: ${BAR_HEIGHT_HOVER / 2}px;
  width: ${HANDLE_SIZE}px;
  height: ${HANDLE_SIZE}px;
  margin-left: ${-HANDLE_SIZE / 2}px;
  margin-bottom: ${-HANDLE_SIZE / 2}px;
  border-radius: 50%;
  background: var(--igrc-color-handle, ${COLOR_HANDLE});
  transform: scale(0);
  transition: transform 120ms ease-out;
}

.root.is-active .handle {
  transform: scale(1);
}

.root.is-dragging .handle {
  transform: scale(1.15);
}

.handle.is-stalled::after {
  content: '';
  position: absolute;
  inset: -5px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #ffffff;
  animation: igrc-spin 700ms linear infinite;
}

@keyframes igrc-spin {
  to { transform: rotate(360deg); }
}

.label {
  display: var(--igrc-label-display, block);
  position: absolute;
  left: 8px;
  bottom: 12px;
  font-size: 11px;
  line-height: 1;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  opacity: 0;
  transition: opacity 120ms ease-out;
  white-space: nowrap;
}

.root.is-active .label {
  opacity: 1;
}
`;
