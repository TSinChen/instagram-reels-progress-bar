import { CSS } from './styles.js';
import { formatTime } from './time-format.js';
import { cssVarsFor } from './settings.js';
import { HOST_HEIGHT, Z_INDEX } from './config.js';

const HOST_MARKER = 'data-igrc';

/** Draws only. Knows nothing about video; all state arrives through render. */
export class ProgressBar {
  constructor(doc = document) {
    this.doc = doc;
    this.host = null;
    this.rootEl = null;
    this.parts = {};
    this._visible = false;
    // Settings can arrive before mount
    this._pendingVars = null;
    this._pendingCorners = null;
  }

  get hitElement() {
    return this.parts.hit || null;
  }

  get trackElement() {
    return this.parts.track || null;
  }

  /** Reparents an existing host rather than rebuilding it, so fullscreen transitions are cheap. */
  mount(parent = this.doc.body) {
    if (this.host) {
      if (this.host.parentNode !== parent) parent.appendChild(this.host);
      return;
    }

    const host = this.doc.createElement('div');
    host.setAttribute(HOST_MARKER, 'host');
    host.style.cssText = [
      'position: fixed',
      'left: 0',
      'top: 0',
      'width: 0',
      `height: ${HOST_HEIGHT}px`,
      `z-index: ${Z_INDEX}`,
      'pointer-events: none',
      'display: none',
      'margin: 0',
      'padding: 0',
    ].join('; ');

    const shadow = host.attachShadow({ mode: 'open' });

    const style = this.doc.createElement('style');
    style.textContent = CSS;

    const rootEl = this.doc.createElement('div');
    rootEl.className = 'root';
    rootEl.innerHTML = [
      '<div class="label"></div>',
      '<div class="track"><div class="buffered"></div><div class="played"></div></div>',
      '<div class="handle"></div>',
      '<div class="hit"></div>',
    ].join('');

    shadow.append(style, rootEl);
    parent.appendChild(host);

    this.host = host;
    this.rootEl = rootEl;
    this.parts = {
      label: rootEl.querySelector('.label'),
      track: rootEl.querySelector('.track'),
      buffered: rootEl.querySelector('.buffered'),
      played: rootEl.querySelector('.played'),
      handle: rootEl.querySelector('.handle'),
      hit: rootEl.querySelector('.hit'),
    };

    if (this._pendingVars) {
      this._writeVars(this._pendingVars);
      this._pendingVars = null;
    }
    if (this._pendingCorners) {
      const corners = this._pendingCorners;
      this._pendingCorners = null;
      this.applyCorners(corners);
    }
  }

  /** Only touches custom properties, so a drag in progress is never interrupted. */
  applySettings(settings) {
    const vars = cssVarsFor(settings);
    if (!this.host) {
      this._pendingVars = vars;
      return;
    }
    this._writeVars(vars);
  }

  _writeVars(vars) {
    for (const [name, value] of Object.entries(vars)) {
      this.host.style.setProperty(name, value);
    }
  }

  /** Aligns the bottom edge with the video bottom edge. */
  syncTo(rect) {
    if (!this.host) return;
    this.host.style.left = `${rect.left}px`;
    this.host.style.top = `${rect.bottom - HOST_HEIGHT}px`;
    this.host.style.width = `${rect.width}px`;
  }

  /**
   * Clips on the host, not the track: CSS scales radii down when they exceed the box,
   * so a 22px radius on a 3px-tall track would draw the wrong arc.
   * Without a radius, overflow stays visible or the handle is halved at either end.
   */
  applyCorners({ left = 0, right = 0 } = {}) {
    if (!this.host) {
      this._pendingCorners = { left, right };
      return;
    }
    this.host.style.borderBottomLeftRadius = `${left}px`;
    this.host.style.borderBottomRightRadius = `${right}px`;
    this.host.style.overflow = left || right ? 'hidden' : 'visible';
  }

  render(state) {
    if (!this.host) return;

    const { duration } = state;
    if (!Number.isFinite(duration) || duration <= 0) {
      this.hide();
      return;
    }
    this.show();

    const playedRatio = clamp01(state.playedTime / duration);
    const bufferedRatio = clamp01(state.bufferedEnd / duration);

    this.parts.played.style.width = `${playedRatio * 100}%`;
    this.parts.buffered.style.width = `${bufferedRatio * 100}%`;
    this.parts.handle.style.left = `${playedRatio * 100}%`;

    this.rootEl.classList.toggle('is-active', Boolean(state.active));
    this.rootEl.classList.toggle('is-dragging', Boolean(state.dragging));
    this.parts.handle.classList.toggle('is-stalled', Boolean(state.stalled));

    this.parts.label.textContent = `${formatTime(state.labelTime)} / ${formatTime(duration)}`;
  }

  show() {
    if (!this.host || this._visible) return;
    this.host.style.display = 'block';
    this._visible = true;
  }

  hide() {
    if (!this.host || !this._visible) return;
    this.host.style.display = 'none';
    this._visible = false;
  }

  destroy() {
    if (this.host) this.host.remove();
    this.host = null;
    this.rootEl = null;
    this.parts = {};
    this._visible = false;
  }
}

function clamp01(value) {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value > 1 ? 1 : value;
}
