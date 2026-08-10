import { visibleArea } from './geometry.js';
import {
  MIN_VIDEO_SIZE,
  MIN_VISIBLE_RATIO,
  AREA_TIE_TOLERANCE,
  SELECT_INTERVAL_MS,
  MUTATION_DEBOUNCE_MS,
} from './config.js';

/**
 * Picks the video the user is watching.
 * One rule covers the Reels page, the feed and the post lightbox; no per-page cases.
 */
export function pickActiveVideo(videos, viewport) {
  let best = null;

  for (const video of videos) {
    const rect = video.getBoundingClientRect();
    if (rect.width < MIN_VIDEO_SIZE || rect.height < MIN_VIDEO_SIZE) continue;

    const area = visibleArea(rect, viewport);
    const ratio = area / (rect.width * rect.height);
    if (ratio < MIN_VISIBLE_RATIO) continue;

    const candidate = { video, area };
    if (best === null || beats(candidate, best)) {
      best = candidate;
    }
  }

  return best ? best.video : null;
}

/** Playback state breaks ties between similarly sized videos. */
function beats(candidate, current) {
  const tie = Math.abs(candidate.area - current.area) <= current.area * AREA_TIE_TOLERANCE;
  if (tie) {
    return !candidate.video.paused && current.video.paused;
  }
  return candidate.area > current.area;
}

/**
 * Tracks the active video and calls onChange when it changes.
 * The interval, scroll and mutation triggers only signal "re-evaluate"; the decision
 * always goes through pickActiveVideo.
 */
export class VideoTracker {
  constructor(onChange, { doc = document, win = window } = {}) {
    this.onChange = onChange;
    this.doc = doc;
    this.win = win;
    this.current = null;
    this._intervalId = null;
    this._mutationTimerId = null;
    this._observer = null;
    this._onScroll = () => this.evaluate();
  }

  start() {
    this.evaluate();

    this._intervalId = this.win.setInterval(() => this.evaluate(), SELECT_INTERVAL_MS);

    // Capture phase is required to see scrolling inside nested containers
    this.win.addEventListener('scroll', this._onScroll, { passive: true, capture: true });

    if (typeof MutationObserver === 'function' && this.doc.body) {
      this._observer = new MutationObserver(() => {
        this.win.clearTimeout(this._mutationTimerId);
        this._mutationTimerId = this.win.setTimeout(
          () => this.evaluate(),
          MUTATION_DEBOUNCE_MS,
        );
      });
      this._observer.observe(this.doc.body, { childList: true, subtree: true });
    }
  }

  stop() {
    if (this._intervalId !== null) {
      this.win.clearInterval(this._intervalId);
      this._intervalId = null;
    }
    this.win.clearTimeout(this._mutationTimerId);
    this._mutationTimerId = null;
    this.win.removeEventListener('scroll', this._onScroll, { capture: true });
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    this.current = null;
  }

  evaluate() {
    const videos = this.doc.querySelectorAll('video');
    const viewport = { width: this.win.innerWidth, height: this.win.innerHeight };
    const next = pickActiveVideo(videos, viewport);
    if (next !== this.current) {
      this.current = next;
      this.onChange(next);
    }
  }
}
