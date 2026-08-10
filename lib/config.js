// Colour, timing and size constants. User-adjustable defaults live in settings.js.

/** Overlay height. Bottom edge aligns with the video; the label sits in the upper half. */
export const HOST_HEIGHT = 48;
/**
 * Mirrors the corresponding fields in settings.js DEFAULTS and must stay in sync.
 * Only ever used as the fallback in styles.js var() calls, before applySettings runs.
 */
export const HIT_ZONE_HEIGHT = 16;
export const BAR_HEIGHT_IDLE = 3;
export const BAR_HEIGHT_HOVER = 6;
export const HANDLE_SIZE = 12;

export const COLOR_PLAYED = '#ffffff';
export const COLOR_BUFFERED = 'rgba(255, 255, 255, 0.45)';
export const COLOR_TRACK = 'rgba(255, 255, 255, 0.25)';
export const COLOR_HANDLE = '#ffffff';

/** Videos narrower or shorter than this are thumbnails or preload elements. */
export const MIN_VIDEO_SIZE = 80;
/** Below this visible fraction a video is not a candidate. */
export const MIN_VISIBLE_RATIO = 0.5;
/** Within this margin two videos count as tied, and playback state decides. */
export const AREA_TIE_TOLERANCE = 0.05;

export const SELECT_INTERVAL_MS = 200;
/** Debounce after DOM mutations so a burst of React re-renders costs one evaluation. */
export const MUTATION_DEBOUNCE_MS = 150;
/** Show the stall indicator if a seek has not produced playable data within this. */
export const STALL_THRESHOLD_MS = 1500;

export const Z_INDEX = 2147483000;
