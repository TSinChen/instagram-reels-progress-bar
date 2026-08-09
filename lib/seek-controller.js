import { ratioFromPointerX, timeFromRatio } from './geometry.js';

/**
 * 把感應區上的指標事件翻譯成對 video.currentTime 的寫入。
 *
 * 這個模組不碰 UI，只維護互動狀態（hover / dragging / 目標時間），
 * 由 main.js 的渲染迴圈去讀這些狀態決定怎麼畫。
 */
export class SeekController {
  constructor({ win = window, now = () => Date.now() } = {}) {
    this.win = win;
    this.now = now;

    this.video = null;
    this.hit = null;
    this.track = null;

    this.hovering = false;
    this.dragging = false;
    this.hoverTime = 0;
    this.dragTime = 0;
    this.lastSeekAt = 0;

    this._pendingSeek = null;
    this._rafId = 0;
    this._pointerId = null;

    this._onPointerEnter = () => { this.hovering = true; };
    this._onPointerLeave = () => { if (!this.dragging) this.hovering = false; };
    this._onPointerMove = (event) => this._handleMove(event);
    this._onPointerDown = (event) => this._handleDown(event);
    this._onPointerUp = (event) => this._handleUp(event);
    this._onPointerCancel = (event) => this._handleUp(event);
    this._onClick = (event) => {
      event.stopPropagation();
      event.preventDefault();
    };
  }

  attach(video, { hit, track }) {
    this.detach();
    this.video = video;
    this.hit = hit;
    this.track = track;

    hit.addEventListener('pointerenter', this._onPointerEnter);
    hit.addEventListener('pointerleave', this._onPointerLeave);
    hit.addEventListener('pointermove', this._onPointerMove);
    hit.addEventListener('pointerdown', this._onPointerDown);
    hit.addEventListener('pointerup', this._onPointerUp);
    hit.addEventListener('pointercancel', this._onPointerCancel);
    hit.addEventListener('click', this._onClick);
  }

  detach() {
    if (this.hit) {
      this.hit.removeEventListener('pointerenter', this._onPointerEnter);
      this.hit.removeEventListener('pointerleave', this._onPointerLeave);
      this.hit.removeEventListener('pointermove', this._onPointerMove);
      this.hit.removeEventListener('pointerdown', this._onPointerDown);
      this.hit.removeEventListener('pointerup', this._onPointerUp);
      this.hit.removeEventListener('pointercancel', this._onPointerCancel);
      this.hit.removeEventListener('click', this._onClick);
    }
    this.video = null;
    this.hit = null;
    this.track = null;
    this.hovering = false;
    this.dragging = false;
    this.hoverTime = 0;
    this.dragTime = 0;
    this.lastSeekAt = 0;
    this._pendingSeek = null;
    this._pointerId = null;
  }

  /** 資料補齊後由 main.js 呼叫，讓卡頓指示消失。 */
  clearSeekMark() {
    this.lastSeekAt = 0;
  }

  _timeAt(clientX) {
    if (!this.video || !this.track) return 0;
    const rect = this.track.getBoundingClientRect();
    const ratio = ratioFromPointerX(clientX, rect);
    return timeFromRatio(ratio, this.video.duration);
  }

  _handleMove(event) {
    const time = this._timeAt(event.clientX);
    if (this.dragging) {
      this.dragTime = time;
      this._scheduleSeek(time);
    } else {
      this.hoverTime = time;
    }
  }

  _handleDown(event) {
    if (!this.video) return;
    event.preventDefault();
    event.stopPropagation();

    this.dragging = true;
    this.hovering = true;
    this._pointerId = event.pointerId;

    // 擷取指標，這樣拖到影片外面甚至視窗外面都還收得到 pointermove
    if (typeof this.hit.setPointerCapture === 'function') {
      try {
        this.hit.setPointerCapture(event.pointerId);
      } catch {
        // 某些情況下指標已經失效，忽略即可
      }
    }

    const time = this._timeAt(event.clientX);
    this.dragTime = time;
    this._scheduleSeek(time);
  }

  _handleUp(event) {
    if (!this.dragging) return;
    event.stopPropagation();

    const time = this._timeAt(event.clientX);
    this.dragTime = time;

    // 放開的位置必須精確，不等下一個 frame，直接寫入
    this._pendingSeek = time;
    this._commitSeek();

    if (this._pointerId !== null && typeof this.hit.releasePointerCapture === 'function') {
      try {
        this.hit.releasePointerCapture(this._pointerId);
      } catch {
        // 指標已釋放，忽略
      }
    }
    this._pointerId = null;
    this.dragging = false;
  }

  /** 把寫入節流到每個 animation frame 最多一次。 */
  _scheduleSeek(time) {
    this._pendingSeek = time;
    if (this._rafId) return;
    this._rafId = this.win.requestAnimationFrame(() => {
      this._rafId = 0;
      this._commitSeek();
    });
  }

  _commitSeek() {
    if (this._pendingSeek === null || !this.video) return;
    const time = this._pendingSeek;
    this._pendingSeek = null;
    try {
      this.video.currentTime = time;
      this.lastSeekAt = this.now();
    } catch {
      // 播放器在某些狀態下會拒絕寫入，忽略這一次即可
    }
  }
}
