import { CSS } from './styles.js';
import { formatTime } from './time-format.js';
import { HOST_HEIGHT, Z_INDEX } from './config.js';

const HOST_MARKER = 'data-igrc';

/**
 * 進度條的 UI。只負責畫，不知道 video 的存在，也不處理任何互動邏輯。
 * 所有狀態都由 render 的參數傳進來。
 */
export class ProgressBar {
  constructor(doc = document) {
    this.doc = doc;
    this.host = null;
    this.rootEl = null;
    this.parts = {};
    this._visible = false;
  }

  get hitElement() {
    return this.parts.hit || null;
  }

  get trackElement() {
    return this.parts.track || null;
  }

  /**
   * 建立 host 並掛到 parent。
   * 已經建立過就只做搬家，這樣進出全螢幕時不會重建整個 UI。
   */
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
  }

  /** 把 host 對齊到影片矩形，下緣貼齊影片下緣。 */
  syncTo(rect) {
    if (!this.host) return;
    this.host.style.left = `${rect.left}px`;
    this.host.style.top = `${rect.bottom - HOST_HEIGHT}px`;
    this.host.style.width = `${rect.width}px`;
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
