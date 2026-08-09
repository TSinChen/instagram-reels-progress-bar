# Instagram Reels Scrubber — 設計文件

日期：2026-08-09
狀態：已核可，待實作

## 問題

Instagram 網頁版的 Reels 與影片貼文沒有進度條。使用者無法跳到影片的任意位置，只能從頭看到尾，或重新載入。

## 目標

做一個 Chrome 擴充功能，在 Instagram 的影片底部加上一條可以拖曳的進度條，讓使用者跳到想看的地方。

## 範圍

### 要做

- 影片底部的進度條，可拖曳、可點擊跳轉
- 顯示目前時間與總長度（`0:07 / 0:32`）
- 顯示已緩衝範圍
- 生效頁面：Reels 專頁 `/reels/*`、首頁 feed、貼文燈箱 `/p/*`、探索頁 `/explore/*`

### 不做（YAGNI）

- 鍵盤快捷鍵。左右方向鍵在 Reels 上是切換貼文，覆寫會破壞原生操作。
- 點擊暫停／播放。Instagram 桌面版本來就有。
- 播放速度控制、音量記憶、設定頁、popup。使用者沒有要求。
- Firefox / Edge 相容。只針對 Chrome。

## 核心決策：進度條掛在哪

Instagram 的 CSS class 是編譯產生的雜湊字串（`x1n2onr6` 這類），且隨版本改變。任何綁定 class 名稱或 DOM 階層的做法都會在數週內失效。

評估過三個方案：

**A. 插入 Instagram 的 DOM 樹**
把進度條 `appendChild` 到影片的容器裡。最直覺，但 Instagram 是 React 應用，重新 render 時會移除我們插入的節點；影片容器普遍帶 `overflow: hidden`，會裁掉超出邊界的 UI；還得跟 Instagram 的 z-index 打架。**不採用。**

**B. 獨立浮層 + 追蹤當前作用中的影片**（採用）
在 `document.body` 下掛一個 Shadow DOM host，用 `position: fixed` 疊在目前正在觀看的那支 `<video>` 上，逐幀依 `getBoundingClientRect()` 對齊。完全不修改 Instagram 的 DOM，React 重繪影響不到我們。Shadow DOM 隔絕雙向的 CSS 污染。唯一的錨點是 `<video>` 這個 HTML 標準元素——這是 Instagram 改版時唯一不會變的東西。

### 浮層的兩層尺寸

Shadow host 高 48px（`HOST_HEIGHT`），下緣對齊影片元素下緣，`pointer-events: none`，只是個定位容器與繪圖畫布，時間標籤畫在它的上半部。

真正接收指標事件的只有 host 內部貼齊底部的 16px 條帶（`HIT_ZONE_HEIGHT`），這一層才是 `pointer-events: auto`。

這樣時間標籤有足夠空間顯示而不被裁切，同時被我們攔截掉的 Instagram 原生可點擊區域仍然只有底部 16px。

**C. 每支影片各配一條進度條**
首頁 feed 可能同時有十幾支影片，就得維護十幾條進度條與十幾個 rAF 更新，效能與視覺都差。**不採用**，改為同一時間只顯示一條。

## 架構

六個模組，各自職責單一、可獨立測試。

| 模組 | 職責 | 對外介面 | 依賴 |
|---|---|---|---|
| `config.js` | 可調常數（顏色、高度、節流間隔） | 具名匯出常數 | 無 |
| `time-format.js` | 秒數轉 `M:SS` | `formatTime(seconds)` | 無 |
| `geometry.js` | 純幾何計算 | `visibleArea`, `ratioFromPointerX`, `timeFromRatio` | 無 |
| `video-tracker.js` | 選出當前作用中的影片並回報變更 | `pickActiveVideo(videos, viewport)`（純函式）、`VideoTracker` 類別 | `geometry` |
| `progress-bar.js` | Shadow DOM UI，只負責畫 | `mount()`, `syncTo(rect)`, `render(state)`, `destroy()` | `config`, `time-format` |
| `seek-controller.js` | 指標事件 → 時間換算 → 寫入 `currentTime` | `attach(video, barElement)`, `detach()` | `geometry`, `config` |
| `main.js` | 生命週期接線 | `init()`, `teardown()` | 以上全部 |

`loader.js` 是 manifest 指定的 classic script，只有一行：動態 import `main.js` 並呼叫 `init()`。

每個模組的判斷標準：不讀 `progress-bar.js` 的內部實作，就能知道怎麼用它；改它的內部畫法不會影響任何呼叫端。`geometry` 與 `time-format` 是純函式，不碰 DOM。

## 當前作用中的影片如何判定

一條規則同時涵蓋所有頁面，不為個別頁面寫特例：

1. 取 `document.querySelectorAll('video')`。
2. 排除 `getBoundingClientRect()` 寬或高小於 80px 的（縮圖、隱藏的預載元素）。
3. 計算每支影片與視窗的交集面積，以及交集面積佔自身面積的比例。
4. 只保留比例 ≥ 0.5 的候選。
5. 取交集面積最大者。若最大值與次大值差距在 5% 以內，優先取 `paused === false` 的那支。
6. 沒有候選則回傳 `null`，浮層隱藏。

這條規則自然處理了 Reels 專頁的上下滑（新影片滑入即接手）、首頁 feed 的捲動（畫面中央的影片勝出）、以及燈箱開啟（燈箱影片面積最大）。

## 資料流

兩個不同頻率的迴圈：

**選取迴圈（低頻，最多每 200ms 一次）**
觸發來源：`setInterval` 200ms、`scroll`（rAF 節流）、`MutationObserver` 對 `document.body` 的 `childList`/`subtree` 變動（debounce 150ms）。
執行 `pickActiveVideo()`。結果與上次不同時，切換 `seek-controller` 綁定的影片。

**渲染迴圈（每幀，僅在有作用中影片時執行）**
`requestAnimationFrame` 迴圈：
1. 讀 `video.getBoundingClientRect()` → `progressBar.syncTo(rect)` 對齊位置。
2. 讀 `video.currentTime`、`video.duration`、`video.buffered` → 組成 state。
3. 若 `seek-controller` 正在拖曳，state 的 `displayTime` 改用拖曳暫存值，讓 UI 不受非同步 seek 延遲影響。
4. `progressBar.render(state)`。

分頁隱藏（`visibilitychange`）時停掉渲染迴圈，回來再啟動。

## 視覺規格

風格參照 `examples/youtube.png`（YouTube Shorts）。

**閒置狀態**
- 進度條高 3px，貼齊影片元素底緣，滿版寬度。
- 軌道底色 `rgba(255,255,255,0.25)`。
- 已緩衝 `rgba(255,255,255,0.45)`。
- 已播放 `#ffffff`。
- 拖曳圓點 `scale(0)`，不可見。
- 時間標籤 `opacity: 0`。

**Hover 狀態**（指標進入影片底部 16px 感應區）
- 進度條長高到 6px，120ms `ease-out` 轉場。
- 拖曳圓點 `scale(1)`，直徑 12px，白色實心，圓心對齊已播放進度末端。
- 時間標籤淡入。

**拖曳狀態**
- 維持 hover 的所有樣式，圓點 `scale(1.15)`。
- 指標離開影片範圍仍持續追蹤（`setPointerCapture`）。

**時間標籤**
單一標籤，畫在 48px 高的 host 上半部、進度條正上方靠左，`left: 8px; bottom: 12px`。
- 平時顯示 `目前時間 / 總長度`，例如 `0:07 / 0:32`。
- Hover 或拖曳時，左半改顯示指標所指的目標時間，例如 `0:19 / 0:32`。使用者能直接看到放開後會跳到哪。
- 字級 11px、白色、`font-variant-numeric: tabular-nums`、`text-shadow: 0 1px 2px rgba(0,0,0,0.8)` 確保在亮色影片上也讀得到。

只用一個標籤，不做跟隨游標的浮動提示。跟隨游標的提示會在靠近左端時與固定標籤重疊，而單一標籤已經完整回答「現在在哪、會跳到哪、總共多長」。

**顏色**
已播放部分用白色，不用 YouTube 的紅色，理由是白色貼合 Instagram 的視覺調性。所有顏色集中在 `config.js`，改一行即可換成紅色或 Instagram 藍 `#0095F6`。

**已知取捨**
影片底部 16px 由感應區接管，該區域的 Instagram 原生點擊會被攔截。這是加入 scrubber 無法避免的代價，YouTube 也是如此。感應區高度定義為 `config.js` 的 `HIT_ZONE_HEIGHT`，方便調整。浮層其餘 32px 是 `pointer-events: none`，不影響該區域的 Instagram 原生互動。

## 座標與時間換算

浮層定位（`syncTo`）：

```
host.left   = videoRect.left
host.width  = videoRect.width
host.top    = videoRect.bottom - HOST_HEIGHT
```

指標位置換算成時間，`barRect` 取進度條軌道的 `getBoundingClientRect()`，其寬度等於影片寬度：

```
ratio = clamp((pointerX - barRect.left) / barRect.width, 0, 1)
targetTime = ratio * duration
```

`barRect.width` 為 0 時回傳 ratio 0，避免除以零。`duration` 無效時 `targetTime` 回傳 0。

## 指標互動

- `pointerdown`：`setPointerCapture`、`preventDefault()`、`stopPropagation()`（阻止 Instagram 的播放／暫停切換）、標記拖曳中、立即 seek。
- `pointermove`（拖曳中）：更新拖曳暫存時間，實際寫入 `video.currentTime` 節流到每幀最多一次。
- `pointermove`（未拖曳）：更新標籤的目標時間。
- `pointerup` / `pointercancel`：最後寫入一次 `currentTime`、釋放 capture、結束拖曳。
- `click`：`stopPropagation()`，避免點擊冒泡到 Instagram。

單純點擊（按下與放開在同一點）走的是同一條路徑，自然就是「點哪跳哪」。

## 錯誤處理

| 情況 | 處理 |
|---|---|
| `duration` 為 `NaN`、`0` 或 `Infinity`（中繼資料未載入、直播） | 隱藏進度條，監聽 `loadedmetadata` 與 `durationchange` |
| 影片元素從 DOM 移除 | 選取迴圈下次執行時偵測到，解除綁定並隱藏浮層 |
| SPA 換頁 | `MutationObserver` + 選取迴圈自然涵蓋，無需監聽路由 |
| seek 到未緩衝區段導致卡住 | 已緩衝範圍以不同顏色畫出，使用者事先看得到安全範圍。若 seek 後 `readyState < 3` 持續超過 1500ms，圓點顯示轉圈指示。不自動修正使用者的目標位置。 |
| 進入全螢幕 | `fullscreenchange` 時把 Shadow host 改掛到 `document.fullscreenElement` 底下，否則會被全螢幕元素蓋住 |
| 同時存在多支播放中的影片 | 選取規則保證只有一支勝出，只有一條進度條 |

Instagram 使用 MSE 串流播放，seek 到尚未下載的區段是否成功取決於 Instagram 自己的 player 是否補抓片段。我們不繞過也不猜測它的行為，只誠實把緩衝狀態呈現給使用者。

## 技術形式

- Manifest V3。
- **零建置步驟**。`loader.js` 用 `import(chrome.runtime.getURL('src/content/main.js'))` 動態載入 ES module，模組檔案放進 `web_accessible_resources`。這樣既保有真正的模組邊界與 `import`/`export` 語法，使用者也能直接「載入未封裝項目」指向專案資料夾就跑，修改後重新載入擴充功能即可，不需要 npm 或打包。
- 執行期零依賴。`vitest` 與 `jsdom` 僅為 devDependency，不影響擴充功能安裝。

### 檔案結構

```
manifest.json
src/content/loader.js          classic script，動態 import main.js
src/content/main.js            生命週期接線
src/content/config.js          可調常數
src/content/time-format.js
src/content/geometry.js
src/content/video-tracker.js
src/content/progress-bar.js
src/content/styles.js          Shadow root 的 CSS 字串
src/content/seek-controller.js
icons/icon16.png icon48.png icon128.png
test/*.test.js                 vitest 單元測試
test/fixtures/mock-instagram.html   模擬版面的手動／自動驗證頁
README.md                      安裝與驗收步驟
```

## 測試策略

**單元測試（vitest + jsdom）**

- `time-format`：`0 → "0:00"`、`7 → "0:07"`、`67 → "1:07"`、`3599 → "59:59"`、`3600 → "60:00"`、`NaN`／負數 → `"0:00"`。
- `geometry`：ratio 在兩端的夾擠、寬度為 0、`duration` 為 0 或 `NaN`、指標超出左右邊界。
- `video-tracker.pickActiveVideo`：選面積最大者；忽略小於 80px 的元素；近似平手時優先選播放中的；無候選回傳 `null`；部分露出低於 50% 不入選。
- `progress-bar.render`：給定 state 後三段寬度與標籤文字正確；`duration` 無效時整體隱藏。
- `seek-controller`：模擬 `pointerdown` → `pointermove` → `pointerup` 序列，驗證 `currentTime` 的寫入值與寫入次數（節流）。

**版面驗證（真實瀏覽器 + 模擬頁）**

`test/fixtures/mock-instagram.html` 重現三種版面：全螢幕直式 Reels、首頁 feed 三支影片可捲動、燈箱視窗。頁面使用真實的 `<video>` 元素，但以 `Object.defineProperty` 覆寫 `duration`、`currentTime`、`buffered`、`paused`，讓行為完全確定、不依賴任何影片檔案。這驗證了真實 DOM 下的定位、hover 轉場、拖曳互動與作用中影片切換。

**明確的驗證邊界**

模擬頁無法驗證的只有一件事：Instagram 真實 DOM 結構與其 MSE player 對 `currentTime` 寫入的反應。這部分由使用者在真實 Instagram 上驗收。README 會列出逐步驗收清單。

## 驗收清單（給使用者）

1. Chrome 開 `chrome://extensions`，開啟「開發人員模式」，「載入未封裝項目」選擇專案資料夾。
2. 開 `instagram.com/reels/`，滑鼠移到影片底部，進度條應該長高並出現圓點與時間。
3. 拖曳圓點，影片應跳到對應位置。
4. 上下滑切換 Reels，進度條應跟著切到新影片。
5. 回首頁捲動 feed，進度條應跟著畫面中央的影片走。
6. 點開任一貼文燈箱與探索頁影片，同樣可用。
