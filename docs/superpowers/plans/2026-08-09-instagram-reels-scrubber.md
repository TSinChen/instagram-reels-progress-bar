# Instagram Reels 進度條 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 做一個 Chrome MV3 擴充功能，在 Instagram 的 Reels 與影片底部加上可拖曳的進度條。

**Architecture:** 不修改 Instagram 的 DOM。在 `document.body` 掛一個 Shadow DOM 浮層，用 `position: fixed` 疊在「當前作用中的那支 `<video>`」上方，逐幀依 `getBoundingClientRect()` 對齊。唯一的 DOM 錨點是 `<video>` 標準元素，不依賴任何 Instagram 的 class 名稱。程式碼拆成七個職責單一的 ES module，其中純函式模組（`geometry`、`time-format`、`media-state`、`video-tracker` 的選取邏輯）完全不碰 DOM，可獨立測試。

**Tech Stack:** 原生 JavaScript ES modules、Chrome Manifest V3、Shadow DOM、vitest + jsdom（僅開發期依賴）。

## Global Constraints

- **執行期零依賴。** 擴充功能本身不得引入任何第三方函式庫。`vitest` 與 `jsdom` 只能是 `devDependencies`。
- **零建置步驟。** 不使用 bundler。使用者「載入未封裝項目」指向專案根目錄即可執行。透過 `import(chrome.runtime.getURL(...))` 動態載入 ES module。
- **不得依賴 Instagram 的 CSS class 名稱或 DOM 階層。** 只能以 `document.querySelectorAll('video')` 定位。
- **不得修改 Instagram 的 DOM 樹。** 所有 UI 都在自己的 Shadow DOM host 內。
- **所有可調數值集中在 `src/content/config.js`。** 其他模組不得寫死顏色、尺寸、時間常數。
- **Manifest V3**，`matches` 為 `https://www.instagram.com/*` 與 `https://instagram.com/*`。
- **不做**：鍵盤快捷鍵、點擊暫停播放、播放速度控制、音量記憶、設定頁、popup、Firefox 相容。
- 註解與使用者可見文字使用繁體中文；識別字使用英文。
- 每個 task 結束一定要跑 `npm test` 全綠再 commit。

## File Structure

```
manifest.json                       擴充功能宣告
package.json                        僅開發期依賴與 test script
vitest.config.js                    測試環境設定（jsdom）
src/content/loader.js               classic script，動態 import main.js（唯一被 manifest 直接載入的檔案）
src/content/config.js               所有可調常數
src/content/time-format.js          秒數 → "M:SS"
src/content/geometry.js             純幾何：可視面積、指標位置 → ratio → 時間
src/content/media-state.js          純媒體狀態：緩衝終點、卡頓判定
src/content/video-tracker.js        選出當前作用中的影片並回報變更
src/content/styles.js               Shadow root 的 CSS 字串
src/content/progress-bar.js         Shadow DOM UI，只負責畫
src/content/seek-controller.js      指標事件 → 時間換算 → 寫入 currentTime
src/content/main.js                 生命週期接線與渲染迴圈
icons/icon16.png icon48.png icon128.png
tools/make-icons.mjs                產生圖示（一次性，無第三方依賴）
tools/serve.mjs                     驗證用靜態伺服器（無第三方依賴）
test/*.test.js                      vitest 單元測試
test/fixtures/mock-instagram.html   模擬三種 Instagram 版面的驗證頁
test/fixtures/bootstrap.js          驗證頁的啟動腳本（取代 loader.js）
README.md                           安裝與驗收步驟
```

相對於 spec，這裡多了一個 `media-state.js`：把「緩衝終點計算」與「卡頓判定」從 `main.js` 抽出來，否則這兩段邏輯會埋在 rAF 迴圈裡無法測試。

---

### Task 1: 專案骨架、測試環境、`config.js`、`time-format.js`

**Files:**
- Create: `package.json`
- Create: `vitest.config.js`
- Create: `src/content/config.js`
- Create: `src/content/time-format.js`
- Test: `test/time-format.test.js`

**Interfaces:**
- Consumes: 無
- Produces:
  - `config.js` 具名匯出常數：`HOST_HEIGHT: number`、`HIT_ZONE_HEIGHT: number`、`BAR_HEIGHT_IDLE: number`、`BAR_HEIGHT_HOVER: number`、`HANDLE_SIZE: number`、`COLOR_PLAYED: string`、`COLOR_BUFFERED: string`、`COLOR_TRACK: string`、`COLOR_HANDLE: string`、`MIN_VIDEO_SIZE: number`、`MIN_VISIBLE_RATIO: number`、`AREA_TIE_TOLERANCE: number`、`SELECT_INTERVAL_MS: number`、`MUTATION_DEBOUNCE_MS: number`、`STALL_THRESHOLD_MS: number`、`Z_INDEX: number`
  - `time-format.js`：`formatTime(seconds: number): string`

- [ ] **Step 1: 建立 npm 專案並安裝測試工具**

```bash
cd "D:/Projects/instagram-reels-controller"
npm init -y
npm pkg set name=instagram-reels-scrubber
npm pkg set private=true
npm pkg set type=module
npm pkg set scripts.test="vitest run"
npm pkg set scripts.test:watch="vitest"
npm pkg delete main
npm install -D vitest jsdom
```

- [ ] **Step 2: 建立 vitest 設定**

建立 `vitest.config.js`：

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.js'],
  },
});
```

- [ ] **Step 3: 寫失敗的測試**

建立 `test/time-format.test.js`：

```js
import { describe, it, expect } from 'vitest';
import { formatTime } from '../src/content/time-format.js';

describe('formatTime', () => {
  it('把 0 秒格式化成 0:00', () => {
    expect(formatTime(0)).toBe('0:00');
  });

  it('個位數秒數補零', () => {
    expect(formatTime(7)).toBe('0:07');
  });

  it('小數點無條件捨去', () => {
    expect(formatTime(7.9)).toBe('0:07');
  });

  it('超過一分鐘會進位', () => {
    expect(formatTime(67)).toBe('1:07');
  });

  it('59:59 是兩位數分鐘的邊界', () => {
    expect(formatTime(3599)).toBe('59:59');
  });

  it('超過一小時仍以分鐘表示，不進位成小時', () => {
    expect(formatTime(3600)).toBe('60:00');
  });

  it('NaN 視為 0:00', () => {
    expect(formatTime(NaN)).toBe('0:00');
  });

  it('Infinity 視為 0:00', () => {
    expect(formatTime(Infinity)).toBe('0:00');
  });

  it('負數視為 0:00', () => {
    expect(formatTime(-5)).toBe('0:00');
  });

  it('undefined 視為 0:00', () => {
    expect(formatTime(undefined)).toBe('0:00');
  });
});
```

- [ ] **Step 4: 執行測試確認失敗**

Run: `npm test -- time-format`
Expected: FAIL，錯誤訊息為找不到 `../src/content/time-format.js`

- [ ] **Step 5: 寫最小實作**

建立 `src/content/time-format.js`：

```js
/**
 * 把秒數格式化成 M:SS。
 * 超過一小時不進位成 H:MM:SS，因為 Instagram 影片不會這麼長，
 * 統一格式讓標籤寬度可預測。
 */
export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}
```

- [ ] **Step 6: 執行測試確認通過**

Run: `npm test -- time-format`
Expected: PASS，10 個測試全綠

- [ ] **Step 7: 建立 config.js**

建立 `src/content/config.js`：

```js
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
```

- [ ] **Step 8: 建立 .gitignore 並執行全部測試**

`.gitignore` 應已包含 `node_modules/`（brainstorming 階段建立）。確認內容：

```bash
cat .gitignore
```

Expected: 包含 `node_modules/`。若無則加上。

Run: `npm test`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vitest.config.js .gitignore src/content/config.js src/content/time-format.js test/time-format.test.js
git commit -m "feat: 加入專案骨架、可調常數與時間格式化

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `geometry.js` 純幾何計算

**Files:**
- Create: `src/content/geometry.js`
- Test: `test/geometry.test.js`

**Interfaces:**
- Consumes: 無（純函式，不 import 任何模組）
- Produces:
  - `visibleArea(rect: {left,top,right,bottom}, viewport: {width,height}): number` — 矩形與視窗的交集面積，無交集回傳 0
  - `ratioFromPointerX(pointerX: number, barRect: {left,width}): number` — 指標 x 座標在進度條上的比例，夾在 0..1
  - `timeFromRatio(ratio: number, duration: number): number` — 比例換算成秒數，`duration` 無效時回傳 0

- [ ] **Step 1: 寫失敗的測試**

建立 `test/geometry.test.js`：

```js
import { describe, it, expect } from 'vitest';
import { visibleArea, ratioFromPointerX, timeFromRatio } from '../src/content/geometry.js';

const viewport = { width: 1000, height: 800 };

describe('visibleArea', () => {
  it('完全在視窗內時回傳整個面積', () => {
    const rect = { left: 100, top: 100, right: 300, bottom: 400 };
    expect(visibleArea(rect, viewport)).toBe(200 * 300);
  });

  it('上緣超出視窗時只算露出的部分', () => {
    const rect = { left: 0, top: -100, right: 200, bottom: 100 };
    expect(visibleArea(rect, viewport)).toBe(200 * 100);
  });

  it('下緣超出視窗時只算露出的部分', () => {
    const rect = { left: 0, top: 700, right: 200, bottom: 900 };
    expect(visibleArea(rect, viewport)).toBe(200 * 100);
  });

  it('左右都超出時以視窗寬度為準', () => {
    const rect = { left: -50, top: 0, right: 1050, bottom: 100 };
    expect(visibleArea(rect, viewport)).toBe(1000 * 100);
  });

  it('完全在視窗上方時回傳 0', () => {
    const rect = { left: 0, top: -300, right: 200, bottom: -100 };
    expect(visibleArea(rect, viewport)).toBe(0);
  });

  it('完全在視窗下方時回傳 0', () => {
    const rect = { left: 0, top: 900, right: 200, bottom: 1100 };
    expect(visibleArea(rect, viewport)).toBe(0);
  });

  it('剛好貼齊邊界不算露出', () => {
    const rect = { left: 0, top: 800, right: 200, bottom: 1000 };
    expect(visibleArea(rect, viewport)).toBe(0);
  });
});

describe('ratioFromPointerX', () => {
  const barRect = { left: 100, width: 400 };

  it('指標在左端回傳 0', () => {
    expect(ratioFromPointerX(100, barRect)).toBe(0);
  });

  it('指標在正中央回傳 0.5', () => {
    expect(ratioFromPointerX(300, barRect)).toBe(0.5);
  });

  it('指標在右端回傳 1', () => {
    expect(ratioFromPointerX(500, barRect)).toBe(1);
  });

  it('指標在左端之外夾成 0', () => {
    expect(ratioFromPointerX(-200, barRect)).toBe(0);
  });

  it('指標在右端之外夾成 1', () => {
    expect(ratioFromPointerX(9999, barRect)).toBe(1);
  });

  it('寬度為 0 時回傳 0，不得除以零', () => {
    expect(ratioFromPointerX(300, { left: 100, width: 0 })).toBe(0);
  });

  it('barRect 為 null 時回傳 0', () => {
    expect(ratioFromPointerX(300, null)).toBe(0);
  });
});

describe('timeFromRatio', () => {
  it('比例乘上長度', () => {
    expect(timeFromRatio(0.5, 60)).toBe(30);
  });

  it('比例 0 回傳 0', () => {
    expect(timeFromRatio(0, 60)).toBe(0);
  });

  it('比例 1 回傳全長', () => {
    expect(timeFromRatio(1, 60)).toBe(60);
  });

  it('長度為 0 時回傳 0', () => {
    expect(timeFromRatio(0.5, 0)).toBe(0);
  });

  it('長度為 NaN 時回傳 0', () => {
    expect(timeFromRatio(0.5, NaN)).toBe(0);
  });

  it('長度為 Infinity（直播）時回傳 0', () => {
    expect(timeFromRatio(0.5, Infinity)).toBe(0);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npm test -- geometry`
Expected: FAIL，找不到 `../src/content/geometry.js`

- [ ] **Step 3: 寫最小實作**

建立 `src/content/geometry.js`：

```js
// 純幾何計算。這個模組不碰 DOM，只吃普通物件，方便測試。

/**
 * 矩形與視窗的交集面積。完全不相交時回傳 0。
 */
export function visibleArea(rect, viewport) {
  const left = Math.max(rect.left, 0);
  const top = Math.max(rect.top, 0);
  const right = Math.min(rect.right, viewport.width);
  const bottom = Math.min(rect.bottom, viewport.height);
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return 0;
  return width * height;
}

/**
 * 指標 x 座標在進度條上的比例，夾在 0..1。
 * 寬度為 0 或 barRect 不存在時回傳 0，避免除以零產生 NaN。
 */
export function ratioFromPointerX(pointerX, barRect) {
  if (!barRect || !(barRect.width > 0)) return 0;
  const raw = (pointerX - barRect.left) / barRect.width;
  if (raw < 0) return 0;
  if (raw > 1) return 1;
  return raw;
}

/**
 * 比例換算成秒數。
 * duration 無效（未載入中繼資料、直播的 Infinity）時回傳 0。
 */
export function timeFromRatio(ratio, duration) {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return ratio * duration;
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npm test -- geometry`
Expected: PASS，20 個測試全綠

- [ ] **Step 5: Commit**

```bash
git add src/content/geometry.js test/geometry.test.js
git commit -m "feat: 加入純幾何計算模組

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `media-state.js` 緩衝終點與卡頓判定

**Files:**
- Create: `src/content/media-state.js`
- Test: `test/media-state.test.js`

**Interfaces:**
- Consumes: 無
- Produces:
  - `bufferedEndFor(video: {buffered, currentTime}): number` — 目前播放位置所在的那段緩衝區的終點秒數；不在任何緩衝區內時回傳最後一段的終點；沒有緩衝資料回傳 0
  - `isStalled({readyState, paused}, lastSeekAt: number, now: number, thresholdMs: number): boolean` — seek 之後是否卡住

**背景說明：** `video.buffered` 是一個 `TimeRanges` 物件，介面是 `length`、`start(i)`、`end(i)`。串流播放時可能有多段不連續的緩衝區。我們要顯示的是「從目前位置往後能連續播到哪」，所以要找出包含 `currentTime` 的那一段。

- [ ] **Step 1: 寫失敗的測試**

建立 `test/media-state.test.js`：

```js
import { describe, it, expect } from 'vitest';
import { bufferedEndFor, isStalled } from '../src/content/media-state.js';

/** 做一個假的 TimeRanges。ranges 是 [[start, end], ...]。 */
function fakeTimeRanges(ranges) {
  return {
    length: ranges.length,
    start: (i) => ranges[i][0],
    end: (i) => ranges[i][1],
  };
}

describe('bufferedEndFor', () => {
  it('沒有緩衝資料時回傳 0', () => {
    const video = { buffered: fakeTimeRanges([]), currentTime: 0 };
    expect(bufferedEndFor(video)).toBe(0);
  });

  it('buffered 為 undefined 時回傳 0', () => {
    const video = { buffered: undefined, currentTime: 0 };
    expect(bufferedEndFor(video)).toBe(0);
  });

  it('單一緩衝區時回傳它的終點', () => {
    const video = { buffered: fakeTimeRanges([[0, 12.5]]), currentTime: 3 };
    expect(bufferedEndFor(video)).toBe(12.5);
  });

  it('多段緩衝區時回傳目前位置所在那段的終點', () => {
    const video = {
      buffered: fakeTimeRanges([[0, 10], [20, 30]]),
      currentTime: 22,
    };
    expect(bufferedEndFor(video)).toBe(30);
  });

  it('目前位置在緩衝區之間的空隙時，回傳最後一段的終點', () => {
    const video = {
      buffered: fakeTimeRanges([[0, 10], [20, 30]]),
      currentTime: 15,
    };
    expect(bufferedEndFor(video)).toBe(30);
  });

  it('目前位置剛好在某段的起點時仍算在那段內', () => {
    const video = {
      buffered: fakeTimeRanges([[0, 10], [20, 30]]),
      currentTime: 20,
    };
    expect(bufferedEndFor(video)).toBe(30);
  });

  it('目前位置剛好在某段的終點時仍算在那段內', () => {
    const video = {
      buffered: fakeTimeRanges([[0, 10], [20, 30]]),
      currentTime: 10,
    };
    expect(bufferedEndFor(video)).toBe(10);
  });
});

describe('isStalled', () => {
  const THRESHOLD = 1500;

  it('沒有 seek 過就不算卡頓', () => {
    const video = { readyState: 1, paused: false };
    expect(isStalled(video, 0, 99999, THRESHOLD)).toBe(false);
  });

  it('資料充足時不算卡頓', () => {
    const video = { readyState: 4, paused: false };
    expect(isStalled(video, 1000, 5000, THRESHOLD)).toBe(false);
  });

  it('使用者自己暫停時不算卡頓', () => {
    const video = { readyState: 1, paused: true };
    expect(isStalled(video, 1000, 5000, THRESHOLD)).toBe(false);
  });

  it('seek 後資料不足但還沒超過門檻時不算卡頓', () => {
    const video = { readyState: 1, paused: false };
    expect(isStalled(video, 1000, 2000, THRESHOLD)).toBe(false);
  });

  it('seek 後資料不足且超過門檻就算卡頓', () => {
    const video = { readyState: 1, paused: false };
    expect(isStalled(video, 1000, 3000, THRESHOLD)).toBe(true);
  });

  it('readyState 3 代表能繼續播，不算卡頓', () => {
    const video = { readyState: 3, paused: false };
    expect(isStalled(video, 1000, 9999, THRESHOLD)).toBe(false);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npm test -- media-state`
Expected: FAIL，找不到 `../src/content/media-state.js`

- [ ] **Step 3: 寫最小實作**

建立 `src/content/media-state.js`：

```js
// 從 video 元素讀出播放狀態的純邏輯。吃普通物件，不需要真的 video 元素。

/**
 * 目前播放位置所在的那段緩衝區的終點秒數。
 * Instagram 用 MSE 串流，buffered 可能有多段不連續的區間，
 * 我們要顯示的是「從現在往後能連續播到哪」。
 * 位置落在空隙時退而回傳最後一段的終點。
 */
export function bufferedEndFor(video) {
  const buffered = video.buffered;
  if (!buffered || buffered.length === 0) return 0;
  const t = video.currentTime;
  for (let i = 0; i < buffered.length; i += 1) {
    if (t >= buffered.start(i) && t <= buffered.end(i)) {
      return buffered.end(i);
    }
  }
  return buffered.end(buffered.length - 1);
}

/**
 * seek 之後是否卡在等資料。
 * readyState >= 3（HAVE_FUTURE_DATA）代表能繼續播，不算卡頓。
 * 使用者自己按暫停也不算。
 */
export function isStalled(video, lastSeekAt, now, thresholdMs) {
  if (!lastSeekAt) return false;
  if (video.readyState >= 3) return false;
  if (video.paused) return false;
  return now - lastSeekAt > thresholdMs;
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npm test -- media-state`
Expected: PASS，13 個測試全綠

- [ ] **Step 5: Commit**

```bash
git add src/content/media-state.js test/media-state.test.js
git commit -m "feat: 加入緩衝終點與卡頓判定邏輯

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `video-tracker.js` 選出當前作用中的影片

**Files:**
- Create: `src/content/video-tracker.js`
- Test: `test/video-tracker.test.js`

**Interfaces:**
- Consumes: `geometry.visibleArea`、`config.MIN_VIDEO_SIZE`、`config.MIN_VISIBLE_RATIO`、`config.AREA_TIE_TOLERANCE`、`config.SELECT_INTERVAL_MS`、`config.MUTATION_DEBOUNCE_MS`
- Produces:
  - `pickActiveVideo(videos: Iterable<HTMLVideoElement>, viewport: {width,height}): HTMLVideoElement | null` — 純函式
  - `class VideoTracker`
    - `constructor(onChange: (video: HTMLVideoElement | null) => void, options?: { doc?: Document, win?: Window })`
    - `start(): void`
    - `stop(): void`
    - `evaluate(): void` — 立即重新評估一次（測試用，也給 start 內部呼叫）
    - `current: HTMLVideoElement | null` — 唯讀屬性，目前選中的影片

**選取規則（來自 spec）：** 排除寬或高小於 `MIN_VIDEO_SIZE` 的元素 → 只保留露出比例 ≥ `MIN_VISIBLE_RATIO` 的 → 取可視面積最大者 → 面積差距在 `AREA_TIE_TOLERANCE` 以內視為平手，此時優先選 `paused === false` 的。

- [ ] **Step 1: 寫 `pickActiveVideo` 的失敗測試**

建立 `test/video-tracker.test.js`：

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pickActiveVideo, VideoTracker } from '../src/content/video-tracker.js';

const viewport = { width: 1000, height: 800 };

/**
 * 做一個假的 video 元素。只需要 getBoundingClientRect 與 paused。
 * 用普通物件而不是真的 <video>，因為 jsdom 的 getBoundingClientRect 一律回傳全 0。
 */
function fakeVideo({ left = 0, top = 0, width = 400, height = 600, paused = false, id = '' } = {}) {
  return {
    id,
    paused,
    getBoundingClientRect: () => ({
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
    }),
  };
}

describe('pickActiveVideo', () => {
  it('沒有影片時回傳 null', () => {
    expect(pickActiveVideo([], viewport)).toBe(null);
  });

  it('只有一支完全可見的影片就選它', () => {
    const v = fakeVideo({ id: 'a' });
    expect(pickActiveVideo([v], viewport)).toBe(v);
  });

  it('略過寬度小於 80px 的元素', () => {
    const tiny = fakeVideo({ id: 'tiny', width: 40, height: 600 });
    expect(pickActiveVideo([tiny], viewport)).toBe(null);
  });

  it('略過高度小於 80px 的元素', () => {
    const tiny = fakeVideo({ id: 'tiny', width: 400, height: 40 });
    expect(pickActiveVideo([tiny], viewport)).toBe(null);
  });

  it('露出比例低於 50% 的不列入候選', () => {
    // 高 600，只露出 200 → 比例 0.33
    const barelyVisible = fakeVideo({ id: 'barely', top: 600, height: 600 });
    expect(pickActiveVideo([barelyVisible], viewport)).toBe(null);
  });

  it('露出比例剛好 50% 列入候選', () => {
    // 高 600，top = 500 → 露出 300 → 比例 0.5
    const half = fakeVideo({ id: 'half', top: 500, height: 600 });
    expect(pickActiveVideo([half], viewport)).toBe(half);
  });

  it('兩支都完全可見時選面積大的', () => {
    const small = fakeVideo({ id: 'small', width: 200, height: 200 });
    const large = fakeVideo({ id: 'large', width: 400, height: 600 });
    expect(pickActiveVideo([small, large], viewport)).toBe(large);
  });

  it('面積大小順序顛倒也選得到面積大的', () => {
    const small = fakeVideo({ id: 'small', width: 200, height: 200 });
    const large = fakeVideo({ id: 'large', width: 400, height: 600 });
    expect(pickActiveVideo([large, small], viewport)).toBe(large);
  });

  it('面積接近平手時優先選播放中的', () => {
    const pausedOne = fakeVideo({ id: 'paused', width: 400, height: 600, paused: true });
    const playingOne = fakeVideo({ id: 'playing', width: 400, height: 598, paused: false });
    expect(pickActiveVideo([pausedOne, playingOne], viewport)).toBe(playingOne);
  });

  it('面積差距超過容忍值時仍以面積為準，即使大的那支是暫停的', () => {
    const bigPaused = fakeVideo({ id: 'big', width: 400, height: 600, paused: true });
    const smallPlaying = fakeVideo({ id: 'small', width: 200, height: 200, paused: false });
    expect(pickActiveVideo([bigPaused, smallPlaying], viewport)).toBe(bigPaused);
  });

  it('全部都在視窗外時回傳 null', () => {
    const above = fakeVideo({ id: 'above', top: -900, height: 600 });
    const below = fakeVideo({ id: 'below', top: 900, height: 600 });
    expect(pickActiveVideo([above, below], viewport)).toBe(null);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npm test -- video-tracker`
Expected: FAIL，找不到 `../src/content/video-tracker.js`

- [ ] **Step 3: 寫 `pickActiveVideo` 實作**

建立 `src/content/video-tracker.js`：

```js
import { visibleArea } from './geometry.js';
import {
  MIN_VIDEO_SIZE,
  MIN_VISIBLE_RATIO,
  AREA_TIE_TOLERANCE,
  SELECT_INTERVAL_MS,
  MUTATION_DEBOUNCE_MS,
} from './config.js';

/**
 * 從一堆 video 元素裡選出「使用者現在正在看的那支」。
 *
 * 這一條規則同時涵蓋 Reels 專頁的上下滑、首頁 feed 的捲動、
 * 以及貼文燈箱，不需要為個別頁面寫特例。
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

/** 候選是否勝過目前最佳。面積接近時由播放狀態決勝。 */
function beats(candidate, current) {
  const tie = Math.abs(candidate.area - current.area) <= current.area * AREA_TIE_TOLERANCE;
  if (tie) {
    return !candidate.video.paused && current.video.paused;
  }
  return candidate.area > current.area;
}
```

- [ ] **Step 4: 執行測試確認 `pickActiveVideo` 通過**

Run: `npm test -- video-tracker`
Expected: PASS，11 個測試全綠

- [ ] **Step 5: 寫 `VideoTracker` 類別的失敗測試**

把以下內容附加到 `test/video-tracker.test.js` 的結尾：

```js
describe('VideoTracker', () => {
  let doc;
  let win;
  let timers;

  beforeEach(() => {
    vi.useFakeTimers();
    doc = document;
    doc.body.innerHTML = '';
    win = {
      innerWidth: 1000,
      innerHeight: 800,
      setInterval: (fn, ms) => setInterval(fn, ms),
      clearInterval: (id) => clearInterval(id),
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (id) => clearTimeout(id),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    doc.body.innerHTML = '';
  });

  /** 插入一個真的 <video> 並覆寫它的 getBoundingClientRect。 */
  function addVideo({ width = 400, height = 600, top = 0, paused = false } = {}) {
    const el = doc.createElement('video');
    el.getBoundingClientRect = () => ({
      left: 0,
      top,
      right: width,
      bottom: top + height,
      width,
      height,
    });
    Object.defineProperty(el, 'paused', { value: paused, configurable: true });
    doc.body.appendChild(el);
    return el;
  }

  it('start 之後立刻回報找到的影片', () => {
    const video = addVideo();
    const onChange = vi.fn();
    const tracker = new VideoTracker(onChange, { doc, win });
    tracker.start();
    expect(onChange).toHaveBeenCalledWith(video);
    expect(tracker.current).toBe(video);
    tracker.stop();
  });

  it('沒有影片時回報 null 只發生一次', () => {
    const onChange = vi.fn();
    const tracker = new VideoTracker(onChange, { doc, win });
    tracker.start();
    tracker.evaluate();
    tracker.evaluate();
    expect(onChange).not.toHaveBeenCalled();
    expect(tracker.current).toBe(null);
    tracker.stop();
  });

  it('同一支影片重複評估不會重複回報', () => {
    addVideo();
    const onChange = vi.fn();
    const tracker = new VideoTracker(onChange, { doc, win });
    tracker.start();
    tracker.evaluate();
    tracker.evaluate();
    expect(onChange).toHaveBeenCalledTimes(1);
    tracker.stop();
  });

  it('影片被移除後回報 null', () => {
    const video = addVideo();
    const onChange = vi.fn();
    const tracker = new VideoTracker(onChange, { doc, win });
    tracker.start();
    onChange.mockClear();
    video.remove();
    tracker.evaluate();
    expect(onChange).toHaveBeenCalledWith(null);
    expect(tracker.current).toBe(null);
    tracker.stop();
  });

  it('定時器到期會自動重新評估', () => {
    const onChange = vi.fn();
    const tracker = new VideoTracker(onChange, { doc, win });
    tracker.start();
    const video = addVideo();
    vi.advanceTimersByTime(250);
    expect(onChange).toHaveBeenCalledWith(video);
    tracker.stop();
  });

  it('stop 之後定時器不再觸發', () => {
    const onChange = vi.fn();
    const tracker = new VideoTracker(onChange, { doc, win });
    tracker.start();
    tracker.stop();
    addVideo();
    vi.advanceTimersByTime(1000);
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: 執行測試確認失敗**

Run: `npm test -- video-tracker`
Expected: FAIL，`VideoTracker is not a constructor`

- [ ] **Step 7: 實作 `VideoTracker` 類別**

把以下內容附加到 `src/content/video-tracker.js` 的結尾：

```js
/**
 * 持續追蹤當前作用中的影片，變更時呼叫 onChange。
 *
 * 三個觸發來源：固定間隔的定時器、捲動事件、DOM 變動。
 * 三者都只是「該重新評估了」的訊號，實際判斷一律走 pickActiveVideo。
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

    // capture 為 true 才收得到 Instagram 內層可捲動容器的捲動事件
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
```

- [ ] **Step 8: 執行測試確認通過**

Run: `npm test -- video-tracker`
Expected: PASS，17 個測試全綠

- [ ] **Step 9: 執行全部測試**

Run: `npm test`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/content/video-tracker.js test/video-tracker.test.js
git commit -m "feat: 加入當前作用中影片的追蹤邏輯

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `styles.js` 與 `progress-bar.js` Shadow DOM UI

**Files:**
- Create: `src/content/styles.js`
- Create: `src/content/progress-bar.js`
- Test: `test/progress-bar.test.js`

**Interfaces:**
- Consumes: `config` 全部常數、`time-format.formatTime`
- Produces:
  - `styles.js`：`CSS: string`
  - `progress-bar.js`：`class ProgressBar`
    - `constructor(doc?: Document)`
    - `mount(parent?: Element): void` — 建立 host 並掛到 parent；已存在但 parent 不同則搬過去（全螢幕切換用）
    - `syncTo(rect: {left, bottom, width}): void` — 把 host 對齊到影片矩形
    - `render(state): void` — `state` 形狀見下方
    - `hide(): void` / `show(): void`
    - `destroy(): void`
    - `hitElement: Element | null` — 唯讀，接收指標事件的條帶
    - `trackElement: Element | null` — 唯讀，進度條軌道，用來換算指標位置

  `render` 的 state 形狀：
  ```
  {
    duration: number,      // 影片總長度，無效時整條隱藏
    playedTime: number,    // 已播放進度條與圓點的位置（拖曳中為拖曳暫存值）
    labelTime: number,     // 標籤左半顯示的秒數（hover 時為目標時間）
    bufferedEnd: number,   // 已緩衝到幾秒
    active: boolean,       // hover 或拖曳中，決定是否長高與顯示標籤
    dragging: boolean,     // 拖曳中，圓點放大
    stalled: boolean       // 卡頓中，圓點顯示轉圈
  }
  ```

**為什麼 `playedTime` 與 `labelTime` 分開：** 只是 hover 還沒按下去時，已播放進度條應該停在真實播放位置，只有標籤跟著指標走預告「放開會跳到哪」。合成一個欄位的話，滑鼠一移過去進度條就亂跳。

- [ ] **Step 1: 建立 `styles.js`**

建立 `src/content/styles.js`：

```js
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
 * `:host { all: initial }` 連繼承屬性都擋掉，避免 Instagram 的全域字型或
 * 行高設定影響到我們；host 本身的定位是用 inline style 設的，優先權更高不受影響。
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
  height: ${HIT_ZONE_HEIGHT}px;
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
  background: ${COLOR_TRACK};
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
  background: ${COLOR_BUFFERED};
}

.played {
  background: ${COLOR_PLAYED};
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
```

- [ ] **Step 2: 寫失敗的測試**

建立 `test/progress-bar.test.js`：

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProgressBar } from '../src/content/progress-bar.js';
import { HOST_HEIGHT } from '../src/content/config.js';

function baseState(overrides = {}) {
  return {
    duration: 40,
    playedTime: 10,
    labelTime: 10,
    bufferedEnd: 20,
    active: false,
    dragging: false,
    stalled: false,
    ...overrides,
  };
}

describe('ProgressBar', () => {
  let bar;

  beforeEach(() => {
    document.body.innerHTML = '';
    bar = new ProgressBar(document);
  });

  afterEach(() => {
    bar.destroy();
    document.body.innerHTML = '';
  });

  it('mount 會建立一個帶 shadow root 的 host', () => {
    bar.mount();
    const host = document.querySelector('[data-igrc="host"]');
    expect(host).not.toBe(null);
    expect(host.shadowRoot).not.toBe(null);
  });

  it('重複 mount 不會建立第二個 host', () => {
    bar.mount();
    bar.mount();
    expect(document.querySelectorAll('[data-igrc="host"]').length).toBe(1);
  });

  it('mount 到不同 parent 會把 host 搬過去', () => {
    bar.mount();
    const other = document.createElement('div');
    document.body.appendChild(other);
    bar.mount(other);
    expect(document.querySelectorAll('[data-igrc="host"]').length).toBe(1);
    expect(other.querySelector('[data-igrc="host"]')).not.toBe(null);
  });

  it('syncTo 把 host 對齊到影片矩形的底部', () => {
    bar.mount();
    bar.syncTo({ left: 120, bottom: 500, width: 360 });
    const host = document.querySelector('[data-igrc="host"]');
    expect(host.style.left).toBe('120px');
    expect(host.style.width).toBe('360px');
    expect(host.style.top).toBe(`${500 - HOST_HEIGHT}px`);
  });

  it('render 依比例設定已播放與已緩衝的寬度', () => {
    bar.mount();
    bar.render(baseState());
    const root = document.querySelector('[data-igrc="host"]').shadowRoot;
    expect(root.querySelector('.played').style.width).toBe('25%');
    expect(root.querySelector('.buffered').style.width).toBe('50%');
  });

  it('render 把圓點放在已播放進度的末端', () => {
    bar.mount();
    bar.render(baseState());
    const root = document.querySelector('[data-igrc="host"]').shadowRoot;
    expect(root.querySelector('.handle').style.left).toBe('25%');
  });

  it('已播放時間超過總長度時寬度夾在 100%', () => {
    bar.mount();
    bar.render(baseState({ playedTime: 999 }));
    const root = document.querySelector('[data-igrc="host"]').shadowRoot;
    expect(root.querySelector('.played').style.width).toBe('100%');
  });

  it('緩衝終點超過總長度時寬度夾在 100%', () => {
    bar.mount();
    bar.render(baseState({ bufferedEnd: 999 }));
    const root = document.querySelector('[data-igrc="host"]').shadowRoot;
    expect(root.querySelector('.buffered').style.width).toBe('100%');
  });

  it('標籤顯示 labelTime 與總長度', () => {
    bar.mount();
    bar.render(baseState({ labelTime: 7 }));
    const root = document.querySelector('[data-igrc="host"]').shadowRoot;
    expect(root.querySelector('.label').textContent).toBe('0:07 / 0:40');
  });

  it('hover 時 labelTime 與 playedTime 可以不同', () => {
    bar.mount();
    bar.render(baseState({ playedTime: 10, labelTime: 30, active: true }));
    const root = document.querySelector('[data-igrc="host"]').shadowRoot;
    expect(root.querySelector('.played').style.width).toBe('25%');
    expect(root.querySelector('.label').textContent).toBe('0:30 / 0:40');
  });

  it('active 時加上 is-active class', () => {
    bar.mount();
    bar.render(baseState({ active: true }));
    const root = document.querySelector('[data-igrc="host"]').shadowRoot;
    expect(root.querySelector('.root').classList.contains('is-active')).toBe(true);
  });

  it('dragging 時同時有 is-active 與 is-dragging', () => {
    bar.mount();
    bar.render(baseState({ active: true, dragging: true }));
    const root = document.querySelector('[data-igrc="host"]').shadowRoot;
    const rootEl = root.querySelector('.root');
    expect(rootEl.classList.contains('is-active')).toBe(true);
    expect(rootEl.classList.contains('is-dragging')).toBe(true);
  });

  it('stalled 時圓點加上 is-stalled class', () => {
    bar.mount();
    bar.render(baseState({ stalled: true }));
    const root = document.querySelector('[data-igrc="host"]').shadowRoot;
    expect(root.querySelector('.handle').classList.contains('is-stalled')).toBe(true);
  });

  it('duration 為 NaN 時整條隱藏', () => {
    bar.mount();
    bar.render(baseState({ duration: NaN }));
    const host = document.querySelector('[data-igrc="host"]');
    expect(host.style.display).toBe('none');
  });

  it('duration 為 Infinity（直播）時整條隱藏', () => {
    bar.mount();
    bar.render(baseState({ duration: Infinity }));
    const host = document.querySelector('[data-igrc="host"]');
    expect(host.style.display).toBe('none');
  });

  it('duration 為 0 時整條隱藏', () => {
    bar.mount();
    bar.render(baseState({ duration: 0 }));
    const host = document.querySelector('[data-igrc="host"]');
    expect(host.style.display).toBe('none');
  });

  it('duration 恢復有效後會重新顯示', () => {
    bar.mount();
    bar.render(baseState({ duration: NaN }));
    bar.render(baseState());
    const host = document.querySelector('[data-igrc="host"]');
    expect(host.style.display).toBe('block');
  });

  it('mount 之前呼叫 render 不會拋錯', () => {
    expect(() => bar.render(baseState())).not.toThrow();
  });

  it('mount 之前呼叫 syncTo 不會拋錯', () => {
    expect(() => bar.syncTo({ left: 0, bottom: 0, width: 100 })).not.toThrow();
  });

  it('destroy 會把 host 從文件移除', () => {
    bar.mount();
    bar.destroy();
    expect(document.querySelector('[data-igrc="host"]')).toBe(null);
  });

  it('hitElement 與 trackElement 在 mount 後可取用', () => {
    bar.mount();
    expect(bar.hitElement).not.toBe(null);
    expect(bar.trackElement).not.toBe(null);
  });
});
```

- [ ] **Step 3: 執行測試確認失敗**

Run: `npm test -- progress-bar`
Expected: FAIL，找不到 `../src/content/progress-bar.js`

- [ ] **Step 4: 寫實作**

建立 `src/content/progress-bar.js`：

```js
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
```

- [ ] **Step 5: 執行測試確認通過**

Run: `npm test -- progress-bar`
Expected: PASS，21 個測試全綠

- [ ] **Step 6: 執行全部測試**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/content/styles.js src/content/progress-bar.js test/progress-bar.test.js
git commit -m "feat: 加入 Shadow DOM 進度條 UI

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `seek-controller.js` 指標互動與跳轉

**Files:**
- Create: `src/content/seek-controller.js`
- Test: `test/seek-controller.test.js`

**Interfaces:**
- Consumes: `geometry.ratioFromPointerX`、`geometry.timeFromRatio`
- Produces:
  - `class SeekController`
    - `constructor(options?: { win?: Window, now?: () => number })` — `now` 預設 `() => Date.now()`，測試時可注入
    - `attach(video: HTMLVideoElement, parts: { hit: Element, track: Element }): void`
    - `detach(): void`
    - `hovering: boolean` — 指標在感應區內
    - `dragging: boolean` — 拖曳中
    - `hoverTime: number` — 指標所指的秒數
    - `dragTime: number` — 拖曳中的目標秒數
    - `lastSeekAt: number` — 最後一次寫入 `currentTime` 的時間戳，`0` 代表尚未 seek 過。供 `media-state.isStalled` 使用。
    - `clearSeekMark(): void` — 把 `lastSeekAt` 歸零，資料補齊後由 `main.js` 呼叫

**節流設計：** 拖曳時 `pointermove` 觸發頻率遠高於畫面更新率，每次都寫 `video.currentTime` 會讓播放器不斷重新 seek。所以把寫入節流到每個 animation frame 最多一次，但 `pointerup` 一定會立刻補一次最終值，確保放開的位置精確。

- [ ] **Step 1: 寫失敗的測試**

建立 `test/seek-controller.test.js`：

```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SeekController } from '../src/content/seek-controller.js';

/** 收集所有排入的 rAF callback，測試中手動觸發。 */
function makeFakeWindow() {
  const callbacks = [];
  return {
    requestAnimationFrame(fn) {
      callbacks.push(fn);
      return callbacks.length;
    },
    cancelAnimationFrame() {},
    flush() {
      const pending = callbacks.splice(0, callbacks.length);
      pending.forEach((fn) => fn());
    },
    pendingCount: () => callbacks.length,
  };
}

function makeVideo() {
  return { currentTime: 0, duration: 40, paused: false, readyState: 4 };
}

/** 建立 hit 與 track 元素，track 的矩形固定為 left 0、寬 400。 */
function makeParts() {
  const hit = document.createElement('div');
  const track = document.createElement('div');
  track.getBoundingClientRect = () => ({ left: 0, width: 400, right: 400, top: 0, bottom: 6, height: 6 });
  hit.setPointerCapture = vi.fn();
  hit.releasePointerCapture = vi.fn();
  document.body.append(hit, track);
  return { hit, track };
}

function pointerEvent(type, clientX, extra = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { clientX, pointerId: 1, ...extra });
  return event;
}

describe('SeekController', () => {
  let win;
  let video;
  let parts;
  let controller;
  let nowValue;

  beforeEach(() => {
    document.body.innerHTML = '';
    win = makeFakeWindow();
    video = makeVideo();
    parts = makeParts();
    nowValue = 1000;
    controller = new SeekController({ win, now: () => nowValue });
    controller.attach(video, parts);
  });

  afterEach(() => {
    controller.detach();
    document.body.innerHTML = '';
  });

  it('初始狀態不是 hover 也不是拖曳', () => {
    expect(controller.hovering).toBe(false);
    expect(controller.dragging).toBe(false);
  });

  it('pointerenter 進入 hover 狀態', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerenter', 0));
    expect(controller.hovering).toBe(true);
  });

  it('pointerleave 離開 hover 狀態', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerenter', 0));
    parts.hit.dispatchEvent(pointerEvent('pointerleave', 0));
    expect(controller.hovering).toBe(false);
  });

  it('hover 時的 pointermove 更新 hoverTime 但不動 currentTime', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerenter', 0));
    parts.hit.dispatchEvent(pointerEvent('pointermove', 200));
    expect(controller.hoverTime).toBe(20);
    win.flush();
    expect(video.currentTime).toBe(0);
  });

  it('pointerdown 立刻排定一次 seek', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    expect(controller.dragging).toBe(true);
    expect(controller.dragTime).toBe(10);
    win.flush();
    expect(video.currentTime).toBe(10);
  });

  it('pointerdown 會擷取指標，讓拖出範圍仍收得到事件', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    expect(parts.hit.setPointerCapture).toHaveBeenCalledWith(1);
  });

  it('pointerdown 會阻止事件冒泡，避免觸發 Instagram 的播放暫停', () => {
    const event = pointerEvent('pointerdown', 100);
    const stopPropagation = vi.spyOn(event, 'stopPropagation');
    parts.hit.dispatchEvent(event);
    expect(stopPropagation).toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it('click 會被攔下不往外冒泡', () => {
    const event = pointerEvent('click', 100);
    const stopPropagation = vi.spyOn(event, 'stopPropagation');
    parts.hit.dispatchEvent(event);
    expect(stopPropagation).toHaveBeenCalled();
  });

  it('拖曳中的多次 pointermove 只會寫入一次 currentTime', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    parts.hit.dispatchEvent(pointerEvent('pointermove', 200));
    parts.hit.dispatchEvent(pointerEvent('pointermove', 300));
    expect(win.pendingCount()).toBe(1);
    win.flush();
    expect(video.currentTime).toBe(30);
  });

  it('pointerup 立刻寫入最終位置，不等下一個 frame', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    parts.hit.dispatchEvent(pointerEvent('pointermove', 360));
    parts.hit.dispatchEvent(pointerEvent('pointerup', 360));
    expect(video.currentTime).toBe(36);
    expect(controller.dragging).toBe(false);
  });

  it('pointerup 會釋放指標擷取', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    parts.hit.dispatchEvent(pointerEvent('pointerup', 100));
    expect(parts.hit.releasePointerCapture).toHaveBeenCalledWith(1);
  });

  it('pointercancel 也會結束拖曳', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    parts.hit.dispatchEvent(pointerEvent('pointercancel', 100));
    expect(controller.dragging).toBe(false);
  });

  it('拖到左端之外夾成 0 秒', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    parts.hit.dispatchEvent(pointerEvent('pointerup', -500));
    expect(video.currentTime).toBe(0);
  });

  it('拖到右端之外夾成全長', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    parts.hit.dispatchEvent(pointerEvent('pointerup', 9999));
    expect(video.currentTime).toBe(40);
  });

  it('duration 無效時 seek 到 0，不寫入 NaN', () => {
    video.duration = NaN;
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 200));
    win.flush();
    expect(video.currentTime).toBe(0);
  });

  it('seek 後記錄時間戳供卡頓判定使用', () => {
    expect(controller.lastSeekAt).toBe(0);
    nowValue = 5000;
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    win.flush();
    expect(controller.lastSeekAt).toBe(5000);
  });

  it('clearSeekMark 把時間戳歸零', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    win.flush();
    controller.clearSeekMark();
    expect(controller.lastSeekAt).toBe(0);
  });

  it('拖曳中離開感應區仍維持 hover 狀態', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerenter', 0));
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    parts.hit.dispatchEvent(pointerEvent('pointerleave', 100));
    expect(controller.hovering).toBe(true);
    expect(controller.dragging).toBe(true);
  });

  it('detach 之後事件不再影響影片', () => {
    controller.detach();
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 200));
    win.flush();
    expect(video.currentTime).toBe(0);
    expect(controller.dragging).toBe(false);
  });

  it('detach 會重設 hover 與拖曳狀態', () => {
    parts.hit.dispatchEvent(pointerEvent('pointerenter', 0));
    parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
    controller.detach();
    expect(controller.hovering).toBe(false);
    expect(controller.dragging).toBe(false);
  });

  it('寫入 currentTime 拋錯時不會讓整個流程炸掉', () => {
    const brokenVideo = {
      duration: 40,
      paused: false,
      readyState: 4,
      get currentTime() { return 0; },
      set currentTime(_value) { throw new Error('InvalidStateError'); },
    };
    controller.detach();
    controller.attach(brokenVideo, parts);
    expect(() => {
      parts.hit.dispatchEvent(pointerEvent('pointerdown', 100));
      win.flush();
    }).not.toThrow();
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npm test -- seek-controller`
Expected: FAIL，找不到 `../src/content/seek-controller.js`

- [ ] **Step 3: 寫實作**

建立 `src/content/seek-controller.js`：

```js
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
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npm test -- seek-controller`
Expected: PASS，21 個測試全綠

- [ ] **Step 5: 執行全部測試**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/content/seek-controller.js test/seek-controller.test.js
git commit -m "feat: 加入指標拖曳與跳轉控制

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: `main.js` 生命週期與渲染迴圈

**Files:**
- Create: `src/content/main.js`
- Test: `test/main.test.js`

**Interfaces:**
- Consumes: `VideoTracker`、`ProgressBar`、`SeekController`、`media-state.bufferedEndFor`、`media-state.isStalled`、`config.STALL_THRESHOLD_MS`
- Produces:
  - `init(options?: { doc?: Document, win?: Window }): { teardown(): void } | null` — 已注入過會回傳 `null`
  - `buildRenderState(video, seek, now): object` — 匯出供測試；產生 `ProgressBar.render` 需要的 state

**渲染迴圈的職責：** 每個 animation frame 做三件事——把浮層對齊到影片、組出 render state、交給 `ProgressBar` 畫。分頁隱藏時停掉迴圈。

- [ ] **Step 1: 寫失敗的測試**

建立 `test/main.test.js`：

```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { init, buildRenderState } from '../src/content/main.js';

function fakeTimeRanges(ranges) {
  return {
    length: ranges.length,
    start: (i) => ranges[i][0],
    end: (i) => ranges[i][1],
  };
}

function makeVideo(overrides = {}) {
  return {
    currentTime: 10,
    duration: 40,
    paused: false,
    readyState: 4,
    buffered: fakeTimeRanges([[0, 20]]),
    ...overrides,
  };
}

function makeSeek(overrides = {}) {
  return {
    hovering: false,
    dragging: false,
    hoverTime: 0,
    dragTime: 0,
    lastSeekAt: 0,
    clearSeekMark: vi.fn(),
    ...overrides,
  };
}

describe('buildRenderState', () => {
  it('閒置時 playedTime 與 labelTime 都是真實播放位置', () => {
    const state = buildRenderState(makeVideo(), makeSeek(), 1000);
    expect(state.playedTime).toBe(10);
    expect(state.labelTime).toBe(10);
    expect(state.active).toBe(false);
    expect(state.dragging).toBe(false);
  });

  it('hover 時進度條停在真實位置，只有標籤跟著指標走', () => {
    const seek = makeSeek({ hovering: true, hoverTime: 33 });
    const state = buildRenderState(makeVideo(), seek, 1000);
    expect(state.playedTime).toBe(10);
    expect(state.labelTime).toBe(33);
    expect(state.active).toBe(true);
  });

  it('拖曳時進度條與標籤都用拖曳暫存值', () => {
    const seek = makeSeek({ hovering: true, dragging: true, dragTime: 25 });
    const state = buildRenderState(makeVideo(), seek, 1000);
    expect(state.playedTime).toBe(25);
    expect(state.labelTime).toBe(25);
    expect(state.active).toBe(true);
    expect(state.dragging).toBe(true);
  });

  it('帶出影片長度與緩衝終點', () => {
    const state = buildRenderState(makeVideo(), makeSeek(), 1000);
    expect(state.duration).toBe(40);
    expect(state.bufferedEnd).toBe(20);
  });

  it('seek 後資料不足超過門檻時標記卡頓', () => {
    const video = makeVideo({ readyState: 1 });
    const seek = makeSeek({ lastSeekAt: 1000 });
    const state = buildRenderState(video, seek, 3000);
    expect(state.stalled).toBe(true);
  });

  it('資料補齊後不再標記卡頓，並清掉 seek 時間戳', () => {
    const video = makeVideo({ readyState: 4 });
    const seek = makeSeek({ lastSeekAt: 1000 });
    const state = buildRenderState(video, seek, 9000);
    expect(state.stalled).toBe(false);
    expect(seek.clearSeekMark).toHaveBeenCalled();
  });
});

describe('init', () => {
  let win;
  let rafCallbacks;

  beforeEach(() => {
    document.body.innerHTML = '';
    rafCallbacks = [];
    win = {
      innerWidth: 1000,
      innerHeight: 800,
      requestAnimationFrame: (fn) => { rafCallbacks.push(fn); return rafCallbacks.length; },
      cancelAnimationFrame: () => {},
      setInterval: () => 1,
      clearInterval: () => {},
      setTimeout: () => 1,
      clearTimeout: () => {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('會在文件裡建立浮層', () => {
    const app = init({ doc: document, win });
    expect(document.querySelector('[data-igrc="host"]')).not.toBe(null);
    app.teardown();
  });

  it('重複 init 不會建立第二個浮層，第二次回傳 null', () => {
    const app = init({ doc: document, win });
    const second = init({ doc: document, win });
    expect(second).toBe(null);
    expect(document.querySelectorAll('[data-igrc="host"]').length).toBe(1);
    app.teardown();
  });

  it('teardown 會把浮層移除', () => {
    const app = init({ doc: document, win });
    app.teardown();
    expect(document.querySelector('[data-igrc="host"]')).toBe(null);
  });

  it('teardown 之後可以重新 init', () => {
    init({ doc: document, win }).teardown();
    const app = init({ doc: document, win });
    expect(app).not.toBe(null);
    app.teardown();
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npm test -- main`
Expected: FAIL，找不到 `../src/content/main.js`

- [ ] **Step 3: 寫實作**

建立 `src/content/main.js`：

```js
import { VideoTracker } from './video-tracker.js';
import { ProgressBar } from './progress-bar.js';
import { SeekController } from './seek-controller.js';
import { bufferedEndFor, isStalled } from './media-state.js';
import { STALL_THRESHOLD_MS } from './config.js';

const HOST_SELECTOR = '[data-igrc="host"]';

/**
 * 組出 ProgressBar.render 需要的狀態。
 *
 * playedTime 與 labelTime 刻意分開：只是 hover 還沒按下去時，
 * 進度條要停在真實播放位置，只有標籤跟著指標走預告目的地。
 */
export function buildRenderState(video, seek, now) {
  const playedTime = seek.dragging ? seek.dragTime : video.currentTime;

  let labelTime = video.currentTime;
  if (seek.dragging) labelTime = seek.dragTime;
  else if (seek.hovering) labelTime = seek.hoverTime;

  const stalled = isStalled(video, seek.lastSeekAt, now, STALL_THRESHOLD_MS);
  if (!stalled && seek.lastSeekAt && video.readyState >= 3) {
    seek.clearSeekMark();
  }

  return {
    duration: video.duration,
    playedTime,
    labelTime,
    bufferedEnd: bufferedEndFor(video),
    active: seek.hovering || seek.dragging,
    dragging: seek.dragging,
    stalled,
  };
}

/**
 * 啟動整個功能。回傳 teardown 供測試與熱重載使用。
 * 已經注入過就回傳 null，避免 Instagram 的 SPA 導航造成重複注入。
 */
export function init({ doc = document, win = window } = {}) {
  if (doc.querySelector(HOST_SELECTOR)) return null;

  const bar = new ProgressBar(doc);
  bar.mount(doc.body);

  const seek = new SeekController({ win });

  const tracker = new VideoTracker((video) => {
    seek.detach();
    if (!video) {
      bar.hide();
      return;
    }
    seek.attach(video, { hit: bar.hitElement, track: bar.trackElement });
  }, { doc, win });

  let rafId = 0;
  let running = false;

  function frame() {
    if (!running) return;
    rafId = win.requestAnimationFrame(frame);

    const video = tracker.current;
    if (!video || video.isConnected === false) {
      bar.hide();
      return;
    }

    const rect = video.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      bar.hide();
      return;
    }

    bar.syncTo(rect);
    bar.render(buildRenderState(video, seek, Date.now()));
  }

  function startLoop() {
    if (running) return;
    running = true;
    rafId = win.requestAnimationFrame(frame);
  }

  function stopLoop() {
    running = false;
    if (rafId) win.cancelAnimationFrame(rafId);
    rafId = 0;
  }

  const onVisibilityChange = () => {
    if (doc.hidden) stopLoop();
    else startLoop();
  };

  // 進入全螢幕後，掛在 body 底下的元素會被蓋住，必須改掛到全螢幕元素裡
  const onFullscreenChange = () => {
    bar.mount(doc.fullscreenElement || doc.body);
  };

  doc.addEventListener('visibilitychange', onVisibilityChange);
  doc.addEventListener('fullscreenchange', onFullscreenChange);

  tracker.start();
  startLoop();

  return {
    teardown() {
      stopLoop();
      doc.removeEventListener('visibilitychange', onVisibilityChange);
      doc.removeEventListener('fullscreenchange', onFullscreenChange);
      tracker.stop();
      seek.detach();
      bar.destroy();
    },
  };
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npm test -- main`
Expected: PASS，10 個測試全綠

- [ ] **Step 5: 執行全部測試**

Run: `npm test`
Expected: PASS，全部 5 個測試檔案綠燈

- [ ] **Step 6: Commit**

```bash
git add src/content/main.js test/main.test.js
git commit -m "feat: 接上生命週期與渲染迴圈

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: 擴充功能外殼（manifest、loader、圖示）

**Files:**
- Create: `manifest.json`
- Create: `src/content/loader.js`
- Create: `tools/make-icons.mjs`
- Create: `icons/icon16.png`、`icons/icon48.png`、`icons/icon128.png`（由腳本產生）

**Interfaces:**
- Consumes: `main.init()`
- Produces: 可安裝的 Chrome 擴充功能

**為什麼需要 loader：** MV3 的 content script 是 classic script，不能直接寫 `import`。所以 manifest 只載入 `loader.js`，由它用動態 `import()` 把真正的 ES module 拉進來。被動態載入的檔案必須列在 `web_accessible_resources`，否則會被擋。

- [ ] **Step 1: 建立 loader.js**

建立 `src/content/loader.js`：

```js
// MV3 的 content script 是 classic script，不支援靜態 import。
// 這裡用動態 import 把真正的 ES module 拉進來，換取「零建置步驟」。
// main.js 等檔案必須列在 manifest 的 web_accessible_resources 才載得到。
(async () => {
  try {
    const url = chrome.runtime.getURL('src/content/main.js');
    const module = await import(url);
    module.init();
  } catch (error) {
    console.error('[Instagram Reels 進度條] 載入失敗', error);
  }
})();
```

- [ ] **Step 2: 建立 manifest.json**

建立 `manifest.json`：

```json
{
  "manifest_version": 3,
  "name": "Instagram Reels 進度條",
  "version": "1.0.0",
  "description": "為 Instagram 的 Reels 與影片加上可拖曳的進度條，可以跳到影片的任意位置。",
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "content_scripts": [
    {
      "matches": [
        "https://www.instagram.com/*",
        "https://instagram.com/*"
      ],
      "js": ["src/content/loader.js"],
      "run_at": "document_idle",
      "all_frames": false
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["src/content/*.js"],
      "matches": [
        "https://www.instagram.com/*",
        "https://instagram.com/*"
      ]
    }
  ]
}
```

- [ ] **Step 3: 建立圖示產生腳本**

建立 `tools/make-icons.mjs`。這個腳本只用 Node 內建的 `zlib` 與 `fs` 手寫 PNG，不引入任何第三方套件（符合零依賴限制）：

```js
// 產生擴充功能圖示。只用 Node 內建模組手寫 PNG，不引入第三方套件。
// 執行：node tools/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

/** pixels 是 RGBA 的 Uint8Array，長度為 size * size * 4。 */
function encodePng(size, pixels) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type: RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  // 每一列前面要加一個 filter type byte，這裡一律用 0（None）
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size * 4; x += 1) {
      raw[y * (size * 4 + 1) + 1 + x] = pixels[y * size * 4 + x];
    }
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * 圖示設計：Instagram 風格的紫橘漸層圓角方塊，
 * 底部一條白色進度條加一個白色圓點。
 */
function drawIcon(size) {
  const pixels = new Uint8Array(size * size * 4);
  const radius = size * 0.22;

  const barY = Math.round(size * 0.72);
  const barHeight = Math.max(1, Math.round(size * 0.07));
  const barLeft = Math.round(size * 0.14);
  const barRight = Math.round(size * 0.86);
  const dotX = Math.round(size * 0.55);
  const dotR = Math.max(1.5, size * 0.11);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;

      if (!insideRoundedSquare(x, y, size, radius)) {
        pixels[i + 3] = 0;
        continue;
      }

      // 左上偏紫、右下偏橘的對角漸層
      const t = (x / size + y / size) / 2;
      pixels[i] = Math.round(lerp(131, 245, t));
      pixels[i + 1] = Math.round(lerp(58, 133, t));
      pixels[i + 2] = Math.round(lerp(180, 41, t));
      pixels[i + 3] = 255;

      // 進度條軌道（半透明白）與已播放段（實白）
      const onBarRow = y >= barY && y < barY + barHeight;
      if (onBarRow && x >= barLeft && x <= barRight) {
        const played = x <= dotX;
        blend(pixels, i, 255, 255, 255, played ? 1 : 0.45);
      }

      // 拖曳圓點
      const dy = y - (barY + barHeight / 2);
      const dx = x - dotX;
      if (dx * dx + dy * dy <= dotR * dotR) {
        blend(pixels, i, 255, 255, 255, 1);
      }
    }
  }

  return pixels;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function blend(pixels, i, r, g, b, alpha) {
  pixels[i] = Math.round(lerp(pixels[i], r, alpha));
  pixels[i + 1] = Math.round(lerp(pixels[i + 1], g, alpha));
  pixels[i + 2] = Math.round(lerp(pixels[i + 2], b, alpha));
}

function insideRoundedSquare(x, y, size, radius) {
  const nx = Math.min(x, size - 1 - x);
  const ny = Math.min(y, size - 1 - y);
  if (nx >= radius || ny >= radius) return true;
  const dx = radius - nx;
  const dy = radius - ny;
  return dx * dx + dy * dy <= radius * radius;
}

mkdirSync('icons', { recursive: true });
for (const size of [16, 48, 128]) {
  writeFileSync(`icons/icon${size}.png`, encodePng(size, drawIcon(size)));
  console.log(`icons/icon${size}.png 已產生`);
}
```

- [ ] **Step 4: 執行腳本產生圖示**

Run:
```bash
node tools/make-icons.mjs
```
Expected: 印出三行「已產生」，且 `icons/` 底下出現三個 PNG 檔。

- [ ] **Step 5: 驗證 PNG 檔案有效**

Run:
```bash
node -e "const fs=require('fs');for(const s of [16,48,128]){const b=fs.readFileSync('icons/icon'+s+'.png');const sig=b.subarray(0,8).toString('hex');const w=b.readUInt32BE(16);const h=b.readUInt32BE(20);console.log(s, sig==='89504e470d0a1a0a'?'簽章正確':'簽章錯誤', w+'x'+h, b.length+' bytes');}"
```
Expected: 三行輸出，簽章都正確，尺寸分別是 16x16、48x48、128x128。

- [ ] **Step 6: 驗證 manifest.json 是合法 JSON 且欄位齊全**

Run:
```bash
node -e "const m=require('./manifest.json');const need=['manifest_version','name','version','content_scripts','web_accessible_resources','icons'];const miss=need.filter(k=>!(k in m));console.log(miss.length?'缺少欄位: '+miss.join(','):'manifest 欄位齊全');console.log('MV'+m.manifest_version, m.content_scripts[0].js.join(','));"
```
Expected: `manifest 欄位齊全` 與 `MV3 src/content/loader.js`

- [ ] **Step 7: 執行全部測試**

Run: `npm test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add manifest.json src/content/loader.js tools/make-icons.mjs icons/
git commit -m "feat: 加入 MV3 manifest、動態載入器與圖示

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: 模擬版面驗證頁與真實瀏覽器驗證

**Files:**
- Create: `test/fixtures/mock-instagram.html`
- Create: `test/fixtures/bootstrap.js`
- Create: `tools/serve.mjs`

**Interfaces:**
- Consumes: `main.init()`
- Produces: 一個可以在真實瀏覽器裡跑的驗證頁，涵蓋三種 Instagram 版面

**為什麼需要這一步：** jsdom 測不出真實的版面計算、CSS 轉場、以及 `getBoundingClientRect` 的實際值。這個頁面用真實的 `<video>` 元素，但以 `Object.defineProperty` 覆寫 `duration`、`currentTime`、`buffered`、`paused`，讓行為完全確定、不依賴任何影片檔案。這樣就能驗證定位、hover、拖曳與影片切換，而不需要登入 Instagram。

**這一步驗證不到的：** Instagram 真實的 DOM 結構，以及它的 MSE player 對 `currentTime` 寫入的反應。這部分留給使用者在真實 Instagram 上驗收。

- [ ] **Step 1: 建立靜態伺服器**

ES module 無法從 `file://` 載入（瀏覽器會擋），所以需要一個本機 HTTP 伺服器。建立 `tools/serve.mjs`：

```js
// 驗證頁用的靜態伺服器。只用 Node 內建模組。
// 執行：node tools/serve.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORT = 8123;
const ROOT = process.cwd();

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};

createServer(async (req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const safePath = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = join(ROOT, safePath);

  try {
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': TYPES[extname(filePath)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404');
  }
}).listen(PORT, () => {
  console.log(`http://localhost:${PORT}/test/fixtures/mock-instagram.html`);
});
```

- [ ] **Step 2: 建立驗證頁的啟動腳本**

建立 `test/fixtures/bootstrap.js`。它取代 `loader.js` 的角色，並把真實 `<video>` 的媒體屬性換成可控的假值：

```js
import { init } from '../../src/content/main.js';

/** 做一個假的 TimeRanges。 */
function fakeTimeRanges(ranges) {
  return {
    length: ranges.length,
    start: (i) => ranges[i][0],
    end: (i) => ranges[i][1],
  };
}

/**
 * 把一個真的 <video> 元素的媒體屬性換成可控的假值。
 * 保留真實元素是為了讓版面、getBoundingClientRect 與指標事件都是真的，
 * 只有媒體行為是模擬的，這樣驗證結果才確定。
 */
function stubVideo(el, { duration, currentTime = 0, bufferedEnd = duration * 0.6 }) {
  let time = currentTime;
  Object.defineProperty(el, 'duration', { get: () => duration, configurable: true });
  Object.defineProperty(el, 'currentTime', {
    get: () => time,
    set: (value) => {
      time = Math.min(duration, Math.max(0, value));
      el.dataset.seekLog = String(Math.round(time * 100) / 100);
    },
    configurable: true,
  });
  Object.defineProperty(el, 'buffered', {
    get: () => fakeTimeRanges([[0, bufferedEnd]]),
    configurable: true,
  });
  Object.defineProperty(el, 'paused', { get: () => false, configurable: true });
  Object.defineProperty(el, 'readyState', { get: () => 4, configurable: true });

  // 讓時間自己前進，看得出進度條會動
  setInterval(() => {
    time = time + 0.1 >= duration ? 0 : time + 0.1;
  }, 100);
}

document.querySelectorAll('video[data-duration]').forEach((el) => {
  stubVideo(el, {
    duration: Number(el.dataset.duration),
    currentTime: Number(el.dataset.start || 0),
  });
});

init();
window.__igrcReady = true;
```

- [ ] **Step 3: 建立驗證頁**

建立 `test/fixtures/mock-instagram.html`：

```html
<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<title>Instagram 版面模擬 — 進度條驗證</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #000;
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .section { padding: 24px; border-bottom: 1px solid #262626; }
  .section h2 { font-size: 14px; font-weight: 600; color: #a8a8a8; margin: 0 0 16px; }

  /* 版面 A：全螢幕直式 Reels */
  .reels { display: flex; justify-content: center; }
  .reels video {
    width: 380px;
    height: 675px;
    background: linear-gradient(160deg, #3a1c71, #d76d77, #ffaf7b);
    object-fit: cover;
  }

  /* 版面 B：首頁 feed，多支影片可捲動 */
  .feed { max-width: 470px; margin: 0 auto; }
  .post { margin-bottom: 32px; }
  .post-header { display: flex; align-items: center; gap: 10px; padding: 10px 4px; font-size: 13px; }
  .avatar { width: 30px; height: 30px; border-radius: 50%; background: #444; }
  .feed video {
    width: 100%;
    height: 585px;
    display: block;
    background: linear-gradient(200deg, #0f2027, #203a43, #2c5364);
    object-fit: cover;
  }
  .post-actions { padding: 10px 4px; font-size: 13px; color: #a8a8a8; }

  /* 版面 C：貼文燈箱 */
  .lightbox {
    background: #1a1a1a;
    max-width: 900px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr 340px;
    border-radius: 4px;
    overflow: hidden;
  }
  .lightbox video {
    width: 100%;
    height: 500px;
    display: block;
    background: linear-gradient(140deg, #232526, #414345);
    object-fit: cover;
  }
  .lightbox aside { padding: 16px; font-size: 13px; color: #a8a8a8; }

  /* 小縮圖，用來確認 80px 的門檻有生效，不應該長出進度條 */
  .thumbs { display: flex; gap: 8px; }
  .thumbs video { width: 60px; height: 60px; background: #555; }
</style>
</head>
<body>

<div class="section">
  <h2>版面 A — Reels 專頁（全螢幕直式）</h2>
  <div class="reels">
    <video id="reel-1" data-duration="32" data-start="7" muted playsinline></video>
  </div>
</div>

<div class="section">
  <h2>版面 B — 首頁 feed（捲動時進度條應跟著畫面中央的影片走）</h2>
  <div class="feed">
    <div class="post">
      <div class="post-header"><div class="avatar"></div><span>user_one</span></div>
      <video id="feed-1" data-duration="18" data-start="2" muted playsinline></video>
      <div class="post-actions">1,204 個讚</div>
    </div>
    <div class="post">
      <div class="post-header"><div class="avatar"></div><span>user_two</span></div>
      <video id="feed-2" data-duration="45" data-start="30" muted playsinline></video>
      <div class="post-actions">88 個讚</div>
    </div>
    <div class="post">
      <div class="post-header"><div class="avatar"></div><span>user_three</span></div>
      <video id="feed-3" data-duration="120" data-start="15" muted playsinline></video>
      <div class="post-actions">9,331 個讚</div>
    </div>
  </div>
</div>

<div class="section">
  <h2>版面 C — 貼文燈箱 /p/</h2>
  <div class="lightbox">
    <video id="lightbox-1" data-duration="26" data-start="4" muted playsinline></video>
    <aside>留言區</aside>
  </div>
</div>

<div class="section">
  <h2>小縮圖 — 這裡不應該出現進度條（低於 80px 門檻）</h2>
  <div class="thumbs">
    <video id="thumb-1" data-duration="10" muted playsinline></video>
    <video id="thumb-2" data-duration="10" muted playsinline></video>
  </div>
</div>

<script type="module" src="./bootstrap.js"></script>
</body>
</html>
```

- [ ] **Step 4: 啟動伺服器**

Run（背景執行）:
```bash
node tools/serve.mjs
```
Expected: 印出 `http://localhost:8123/test/fixtures/mock-instagram.html`

- [ ] **Step 5: 用瀏覽器開啟驗證頁並確認浮層存在**

用 chrome-devtools MCP 導覽到 `http://localhost:8123/test/fixtures/mock-instagram.html`，然後執行：

```js
() => {
  const host = document.querySelector('[data-igrc="host"]');
  return {
    ready: window.__igrcReady === true,
    hostExists: host !== null,
    display: host && host.style.display,
    width: host && host.style.width,
    top: host && host.style.top,
  };
}
```
Expected: `ready: true`、`hostExists: true`、`display: "block"`、`width` 為 `380px`（Reels 影片寬度）

- [ ] **Step 6: 確認選中的是最大的那支影片**

執行：

```js
() => {
  const host = document.querySelector('[data-igrc="host"]');
  const reel = document.getElementById('reel-1').getBoundingClientRect();
  return {
    hostLeft: host.style.left,
    hostWidth: host.style.width,
    reelLeft: Math.round(reel.left) + 'px',
    reelWidth: Math.round(reel.width) + 'px',
  };
}
```
Expected: `hostLeft` 與 `reelLeft` 相同、`hostWidth` 與 `reelWidth` 相同 —— 代表浮層貼在 Reels 影片上，而不是縮圖或其他影片上。

- [ ] **Step 7: 模擬 hover 並確認長高與標籤出現**

執行：

```js
() => {
  const host = document.querySelector('[data-igrc="host"]');
  const shadow = host.shadowRoot;
  const hit = shadow.querySelector('.hit');
  const rect = hit.getBoundingClientRect();
  hit.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true, clientX: rect.left + 100 }));
  hit.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: rect.left + rect.width / 2 }));
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const root = shadow.querySelector('.root');
      resolve({
        isActive: root.classList.contains('is-active'),
        label: shadow.querySelector('.label').textContent,
        trackHeight: getComputedStyle(shadow.querySelector('.track')).height,
      });
    }));
  });
}
```
Expected: `isActive: true`、`label` 顯示約 `0:16 / 0:32`（指標在中央）、`trackHeight` 往 `6px` 變化中或已達 `6px`

- [ ] **Step 8: 模擬完整拖曳並確認影片跳轉**

執行：

```js
() => {
  const shadow = document.querySelector('[data-igrc="host"]').shadowRoot;
  const hit = shadow.querySelector('.hit');
  const rect = hit.getBoundingClientRect();
  const y = rect.top + rect.height / 2;
  const at = (ratio) => rect.left + rect.width * ratio;

  hit.setPointerCapture = () => {};
  hit.releasePointerCapture = () => {};

  hit.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: at(0.25), clientY: y, pointerId: 1 }));
  hit.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: at(0.5), clientY: y, pointerId: 1 }));
  hit.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: at(0.75), clientY: y, pointerId: 1 }));

  const video = document.getElementById('reel-1');
  return {
    seekedTo: Number(video.dataset.seekLog),
    expected: 32 * 0.75,
  };
}
```
Expected: `seekedTo` 為 `24`（32 秒的 75%），與 `expected` 相同

- [ ] **Step 9: 確認縮圖沒有被選中**

執行：

```js
() => {
  document.getElementById('thumb-1').scrollIntoView({ block: 'center' });
  return new Promise((resolve) => {
    setTimeout(() => {
      const host = document.querySelector('[data-igrc="host"]');
      const thumb = document.getElementById('thumb-1').getBoundingClientRect();
      resolve({
        hostWidth: host.style.width,
        thumbWidth: Math.round(thumb.width) + 'px',
        matchesThumb: host.style.width === Math.round(thumb.width) + 'px',
      });
    }, 400);
  });
}
```
Expected: `matchesThumb: false` —— 60px 的縮圖低於 80px 門檻，浮層不會貼上去

- [ ] **Step 10: 捲動到 feed 並確認進度條跟著換影片**

執行：

```js
() => {
  document.getElementById('feed-2').scrollIntoView({ block: 'center' });
  return new Promise((resolve) => {
    setTimeout(() => {
      const host = document.querySelector('[data-igrc="host"]');
      const target = document.getElementById('feed-2').getBoundingClientRect();
      resolve({
        hostTop: host.style.top,
        expectedTop: Math.round(target.bottom - 48) + 'px',
        hostWidth: host.style.width,
        expectedWidth: Math.round(target.width) + 'px',
      });
    }, 400);
  });
}
```
Expected: `hostTop` 與 `expectedTop` 相同（誤差 1px 內可接受）、`hostWidth` 與 `expectedWidth` 相同

- [ ] **Step 11: 截圖存證**

用 chrome-devtools MCP 截圖，確認進度條在視覺上確實出現在影片底部、樣式符合設計（白色細條、hover 時有圓點與時間標籤）。

- [ ] **Step 12: 關掉伺服器並 commit**

```bash
git add tools/serve.mjs test/fixtures/
git commit -m "test: 加入模擬 Instagram 版面的瀏覽器驗證頁

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: README 與最終驗證

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: 全部
- Produces: 使用者可據以安裝與驗收的文件

- [ ] **Step 1: 撰寫 README**

建立 `README.md`：

````markdown
# Instagram Reels 進度條

為 Instagram 網頁版的 Reels 與影片加上一條可以拖曳的進度條。Instagram 原本沒有進度條，只能從頭看到尾；裝上之後可以直接跳到想看的位置。


## 功能

- 影片底部的進度條，可拖曳、可點擊跳轉
- Hover 時長高、出現拖曳圓點與時間標籤 `0:07 / 0:32`
- 拖曳時標籤即時顯示「放開會跳到哪」
- 顯示已緩衝範圍，一眼看出拖到哪裡是安全的
- 生效頁面：Reels 專頁 `/reels/`、首頁 feed、貼文燈箱 `/p/`、探索頁 `/explore/`

## 安裝

1. Chrome 網址列輸入 `chrome://extensions`
2. 右上角開啟「開發人員模式」
3. 點「載入未封裝項目」
4. 選擇這個專案的根目錄（含 `manifest.json` 的那一層）

不需要 `npm install`，不需要建置。修改程式碼後回到 `chrome://extensions` 按重新整理即可。

## 驗收清單

- [ ] 開 `instagram.com/reels/`，滑鼠移到影片底部，進度條長高並出現圓點與時間
- [ ] 拖曳圓點，影片跳到對應位置
- [ ] 直接點進度條上任一點，影片跳到那裡
- [ ] 上下滑切換 Reels，進度條跟著切到新影片
- [ ] 回首頁捲動 feed，進度條跟著畫面中央的影片走
- [ ] 點開任一貼文燈箱（`/p/...`），進度條正常出現
- [ ] 探索頁點開影片，進度條正常出現
- [ ] 小縮圖上不會出現進度條

## 自訂外觀

所有可調數值都在 `src/content/config.js`，改完重新載入擴充功能即可生效。

| 常數 | 預設 | 說明 |
|---|---|---|
| `COLOR_PLAYED` | `#ffffff` | 已播放的顏色。想換 YouTube 紅改 `#ff0033`，想換 Instagram 藍改 `#0095F6` |
| `HIT_ZONE_HEIGHT` | `16` | 影片底部感應區高度。這是唯一會攔截 Instagram 原生點擊的區域，覺得太容易誤觸就調小 |
| `BAR_HEIGHT_IDLE` | `3` | 閒置時的進度條高度 |
| `BAR_HEIGHT_HOVER` | `6` | Hover 時的進度條高度 |
| `HANDLE_SIZE` | `12` | 拖曳圓點直徑 |
| `MIN_VISIBLE_RATIO` | `0.5` | 影片露出多少比例才會被選為作用中 |

## 已知限制

- **影片底部 16px 由進度條接管**，該區域的 Instagram 原生點擊會被攔截。這是加入 scrubber 無法避免的代價，YouTube 也是如此。嫌礙事可以把 `HIT_ZONE_HEIGHT` 調小。
- **拖到尚未緩衝的位置可能會卡住。** Instagram 用 MSE 串流播放，能不能跳過去取決於它自己的播放器會不會去抓那段資料。進度條把已緩衝範圍畫成較亮的顏色，事先就看得出安全範圍；真的卡住時圓點會轉圈。
- **直播不顯示進度條。** 直播的 `duration` 是 `Infinity`，沒有進度可言。

## 開發

```bash
npm install      # 只裝測試工具，擴充功能本身零依賴
npm test         # 執行單元測試
npm run test:watch
```

版面驗證頁（不需要登入 Instagram 就能測拖曳與定位）：

```bash
node tools/serve.mjs
# 開 http://localhost:8123/test/fixtures/mock-instagram.html
```

重新產生圖示：

```bash
node tools/make-icons.mjs
```

## 架構

不修改 Instagram 的 DOM。在 `document.body` 掛一個 Shadow DOM 浮層，用 `position: fixed` 疊在「當前作用中的那支 `<video>`」上，逐幀依 `getBoundingClientRect()` 對齊。

唯一的 DOM 錨點是 `<video>` 標準元素。Instagram 的 CSS class 是編譯產生的雜湊字串且會隨版本改變，任何綁定它們的做法都會很快失效。

| 檔案 | 職責 |
|---|---|
| `src/content/loader.js` | manifest 載入的 classic script，動態 import `main.js` |
| `src/content/main.js` | 生命週期接線與 rAF 渲染迴圈 |
| `src/content/config.js` | 所有可調常數 |
| `src/content/geometry.js` | 純幾何：可視面積、指標位置換算 |
| `src/content/time-format.js` | 秒數格式化 |
| `src/content/media-state.js` | 緩衝終點、卡頓判定 |
| `src/content/video-tracker.js` | 選出當前作用中的影片 |
| `src/content/progress-bar.js` | Shadow DOM UI |
| `src/content/styles.js` | Shadow root 的 CSS |
| `src/content/seek-controller.js` | 指標事件 → 跳轉 |

設計文件在 `docs/superpowers/specs/`，實作計畫在 `docs/superpowers/plans/`。
````

- [ ] **Step 2: 執行完整測試套件**

Run: `npm test`
Expected: PASS，六個測試檔案（time-format、geometry、media-state、video-tracker、progress-bar、seek-controller、main）全綠

- [ ] **Step 3: 確認擴充功能檔案齊全**

Run:
```bash
node -e "
const fs = require('fs');
const required = [
  'manifest.json',
  'src/content/loader.js',
  'src/content/main.js',
  'src/content/config.js',
  'src/content/geometry.js',
  'src/content/time-format.js',
  'src/content/media-state.js',
  'src/content/video-tracker.js',
  'src/content/progress-bar.js',
  'src/content/styles.js',
  'src/content/seek-controller.js',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png',
  'README.md',
];
const missing = required.filter(f => !fs.existsSync(f));
console.log(missing.length ? '缺少: ' + missing.join(', ') : '全部檔案齊全');
"
```
Expected: `全部檔案齊全`

- [ ] **Step 4: 確認執行期程式碼沒有引入第三方套件**

Run:
```bash
node -e "
const fs = require('fs'), path = require('path');
const dir = 'src/content';
let bad = [];
for (const f of fs.readdirSync(dir)) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  const imports = [...src.matchAll(/from\s+['\"]([^'\"]+)['\"]/g)].map(m => m[1]);
  for (const i of imports) if (!i.startsWith('.')) bad.push(f + ' -> ' + i);
}
console.log(bad.length ? '發現第三方 import: ' + bad.join(', ') : '執行期零依賴確認');
"
```
Expected: `執行期零依賴確認`

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: 加入安裝、驗收與自訂說明

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage**

| Spec 章節 | 對應 Task |
|---|---|
| 範圍—要做的四項 | Task 5（UI 與時間顯示、緩衝顯示）、Task 6（拖曳跳轉）、Task 8（manifest 的四種頁面 matches） |
| 範圍—不做的項目 | 全計畫皆未實作，Global Constraints 明列 |
| 核心決策 B（Shadow DOM 浮層） | Task 5 `ProgressBar.mount` |
| 浮層兩層尺寸（host 48px / 感應區 16px） | Task 1 `config.js`、Task 5 `styles.js` |
| 架構表六個模組 | Task 1–7，另增 `media-state.js`（Task 3）以利測試 |
| 作用中影片判定六條規則 | Task 4 `pickActiveVideo` + 11 個測試 |
| 資料流—選取迴圈 | Task 4 `VideoTracker.start` |
| 資料流—渲染迴圈 | Task 7 `init` 的 `frame` |
| 視覺規格—閒置／hover／拖曳 | Task 5 `styles.js` 的 `.is-active` / `.is-dragging` |
| 視覺規格—時間標籤單一化 | Task 5 `labelTime` 與 `playedTime` 分離 + 對應測試 |
| 座標與時間換算公式 | Task 2 `geometry.js` |
| 指標互動六種事件 | Task 6 `SeekController` |
| 錯誤處理—duration 無效 | Task 5 三個隱藏測試 |
| 錯誤處理—影片移除 | Task 4「影片被移除後回報 null」測試 |
| 錯誤處理—SPA 換頁 | Task 4 MutationObserver |
| 錯誤處理—seek 卡頓 | Task 3 `isStalled` + Task 5 `is-stalled` + Task 7 state |
| 錯誤處理—全螢幕 | Task 7 `onFullscreenChange` |
| 技術形式—MV3 零建置 | Task 8 `loader.js` + `web_accessible_resources` |
| 測試策略—單元測試五類 | Task 1–7 |
| 測試策略—版面驗證 | Task 9 |
| 驗收清單 | Task 10 README |

無缺漏。

**2. Placeholder scan**

無 TBD、TODO、「類似 Task N」、「加上適當的錯誤處理」等字樣。每個程式碼步驟都有完整可貼上的內容。Task 9 的瀏覽器驗證步驟都附了完整的 evaluate script 與預期值。

**3. Type consistency**

- `formatTime(seconds)` — Task 1 定義，Task 5 `progress-bar.js` 使用。一致。
- `visibleArea(rect, viewport)` — Task 2 定義，Task 4 使用。一致。
- `ratioFromPointerX` / `timeFromRatio` — Task 2 定義，Task 6 使用。一致。
- `bufferedEndFor(video)` / `isStalled(video, lastSeekAt, now, thresholdMs)` — Task 3 定義，Task 7 使用。參數順序一致。
- `ProgressBar.hitElement` / `trackElement` — Task 5 定義，Task 7 傳給 `SeekController.attach(video, { hit, track })`。Task 6 的 `attach` 簽章解構 `{ hit, track }`。一致。
- `SeekController` 的 `hovering` / `dragging` / `hoverTime` / `dragTime` / `lastSeekAt` / `clearSeekMark()` — Task 6 定義，Task 7 `buildRenderState` 全數使用。一致。
- `render(state)` 的七個欄位 — Task 5 定義，Task 7 `buildRenderState` 回傳完全相同的七個欄位。一致。
- `VideoTracker(onChange, { doc, win })` — Task 4 定義，Task 7 以相同形式呼叫。一致。
- `HOST_HEIGHT` 用於 Task 5 `syncTo` 與 Task 9 Step 10 的預期值（48）。一致。

---

## 實作期變更紀錄

**Task 8 的載入方式改了。** 計畫原本是 `loader.js` 用 `import(chrome.runtime.getURL('src/content/main.js'))` 動態載入 ES module，manifest 搭配 `web_accessible_resources`，換取零建置步驟。

實作時試圖驗證這條路，發現這台機器上的 Chrome 151 已移除 `--load-extension` 命令列開關（`--disable-features=DisableLoadExtensionCommandLineSwitch` 這個逃生口也一併拿掉了），`chrome://extensions` 完全空白，無法用自動化方式把擴充功能載進瀏覽器實測。也就是說「動態 import 會不會被 Instagram 的嚴格 CSP 擋掉」只能靠推論，而這個環節一旦失敗，使用者只會看到「裝了但沒反應」。

改為新增 `tools/build.mjs`（只用 Node 內建模組，無 bundler 依賴），把 `src/content/` 攤平成單一 classic script `dist/content.js`，manifest 直接載入它。沒有動態載入環節，也不需要 `web_accessible_resources`，該失敗模式消失；而且攤平後的產出可以當成一般 `<script>` 載入來實測，已在真實 Chrome 的嚴格 CSP 頁面（`test/fixtures/mock-instagram-bundle.html`）驗證通過。

代價是多一個建置步驟，但 `dist/content.js` 進版控，使用者安裝時不需要跑任何指令，只有改動 `src/` 之後才需要重新產生。

連帶變更：
- 刪除 `src/content/loader.js`
- manifest 移除 `web_accessible_resources`，`content_scripts.js` 改為 `["dist/content.js"]`
- 新增 `tools/build.mjs`、`test/fixtures/mock-instagram-bundle.html`、`test/fixtures/stub-videos.js`
- `package.json` 新增 `build` 與 `icons` script
- Spec 的「技術形式」章節已同步更新
