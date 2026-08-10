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
 * The shadow root stylesheet.
 *
 * `all: initial` also blocks inherited properties such as Instagram's global font stack.
 * The host's own positioning is inline, which outranks this, and per spec `all` leaves
 * custom properties, direction and unicode-bidi alone.
 *
 * Every var() carries a fallback so the bar is never unstyled while settings load.
 */
export const CSS = `
:host {
  all: initial;
  /* all: initial excludes direction and unicode-bidi, and the bar's geometry is
     physically left-to-right, so an RTL page would reorder the label against the fill. */
  direction: ltr;
}

.root {
  position: absolute;
  inset: 0;
  pointer-events: none;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans TC", sans-serif;
}

/* The only region that intercepts clicks meant for Instagram */
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
  height: var(--igrc-bar-idle, ${BAR_HEIGHT_IDLE}px);
  background: ${COLOR_TRACK};
  transition: height 120ms ease-out;
  overflow: hidden;
}

.root.is-active .track {
  height: var(--igrc-bar-hover, ${BAR_HEIGHT_HOVER}px);
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
  background: ${COLOR_BUFFERED};
}

.played {
  background: ${COLOR_PLAYED};
}

.handle {
  position: absolute;
  left: 0;
  bottom: calc(var(--igrc-bar-hover, ${BAR_HEIGHT_HOVER}px) / 2);
  width: var(--igrc-handle, ${HANDLE_SIZE}px);
  height: var(--igrc-handle, ${HANDLE_SIZE}px);
  margin-left: calc(var(--igrc-handle, ${HANDLE_SIZE}px) / -2);
  margin-bottom: calc(var(--igrc-handle, ${HANDLE_SIZE}px) / -2);
  border-radius: 50%;
  background: ${COLOR_HANDLE};
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
  /* Rides above the bar, so a thicker bar never covers it */
  bottom: calc(var(--igrc-bar-hover, ${BAR_HEIGHT_HOVER}px) + 6px);
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
