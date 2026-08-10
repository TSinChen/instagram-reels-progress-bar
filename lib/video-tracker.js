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
  const candidates = [];

  for (const video of videos) {
    const rect = video.getBoundingClientRect();
    if (rect.width < MIN_VIDEO_SIZE || rect.height < MIN_VIDEO_SIZE) continue;

    const area = visibleArea(rect, viewport);
    if (area / (rect.width * rect.height) < MIN_VISIBLE_RATIO) continue;

    candidates.push({ video, area });
  }

  if (candidates.length === 0) return null;

  // Sorting first, then comparing only the top two, keeps the result independent of
  // document order. Folding with a pairwise "beats" test does not: a tie margin measured
  // against whichever candidate is currently winning is asymmetric, so the relation is
  // not transitive and the winner depends on the order videos happen to appear in.
  candidates.sort((a, b) => b.area - a.area);
  const [first, second] = candidates;

  const tied = second && first.area - second.area <= first.area * AREA_TIE_TOLERANCE;
  if (tied && first.video.paused !== second.video.paused) {
    return first.video.paused ? second.video : first.video;
  }
  return first.video;
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
