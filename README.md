# Instagram Reels Progress Bar

為 Instagram 網頁版的 Reels 與影片加上一條可以拖曳的進度條。Instagram 原本沒有進度條，只能從頭看到尾；裝上之後可以直接跳到想看的位置。

![進度條停在影片底部，顯示已播放時間與拖曳圓點](docs/assets/hero.png)

## 功能

- 影片底部的進度條，可拖曳、可點擊跳轉
- Hover 時長高、出現拖曳圓點與時間標籤 `0:07 / 0:32`
- 拖曳時標籤即時顯示「放開會跳到哪」
- 顯示已緩衝範圍，一眼看出拖到哪裡是安全的
- 生效頁面：Reels 專頁 `/reels/`、首頁 feed、貼文燈箱 `/p/`、探索頁 `/explore/`
- popup 設定頁：進度條粗細、圓點大小、感應區高度、時間標籤開關，改完立刻套用到所有開著的分頁
- 中英雙語

## 安裝

### 從原始碼安裝

```bash
npm install
npm run build
```

1. Chrome 網址列輸入 `chrome://extensions`
2. 右上角開啟「開發人員模式」
3. 點「載入未封裝項目」
4. 選擇 **`.output/chrome-mv3`**（不是專案根目錄）

開發時用 `npm run dev`，WXT 會自己開一個裝好擴充功能的 Chrome，而且改 `lib/` 底下的程式碼會自動重載。

### 打包上架

```bash
npm run zip     # 產出 .output/instagram-reels-progress-bar-1.0.0-chrome.zip
```

上架所需的全部素材與逐欄填寫說明在 `docs/store/STORE.md`。

## 驗收清單

- [ ] 開 `instagram.com/reels/`，滑鼠移到影片底部，進度條長高並出現圓點與時間
- [ ] 拖曳圓點，影片跳到對應位置
- [ ] 直接點進度條上任一點，影片跳到那裡
- [ ] 上下滑切換 Reels，進度條跟著切到新影片
- [ ] 回首頁捲動 feed，進度條跟著畫面中央的影片走
- [ ] 點開任一貼文燈箱（`/p/...`），進度條正常出現
- [ ] 探索頁點開影片，進度條正常出現
- [ ] 小縮圖上不會出現進度條
- [ ] 點工具列圖示開設定，拉粗進度條後 Instagram 分頁立刻跟著變

## 設定

點工具列圖示即可調整，不需要改程式碼：

| 設定 | 預設 | 範圍 | 說明 |
|---|---|---|---|
| 進度條粗細 | 3px | 2–8px | 閒置時的高度。hover 時自動變成兩倍 |
| 拖曳圓點大小 | 12px | 8–20px | 圓點直徑 |
| 感應區高度 | 16px | 8–32px | 影片底部由進度條接管的範圍。會擋到 Instagram 按鈕就調小 |
| 顯示時間標籤 | 開 | — | 關掉就只剩進度條本身 |

進度條變粗時，時間標籤會自動往上讓位，不會被壓到。

顏色固定白色，不開放調整 —— 深色系在深色影片上會完全看不見，開放選色只會製造「裝了但看不到」的客訴。想換色改 `lib/config.js` 的 `COLOR_PLAYED`，改完 `npm run build`。

## 已知限制

- **影片底部 16px 由進度條接管**，該區域的 Instagram 原生點擊會被攔截。這是加入 scrubber 無法避免的代價，YouTube 也是如此。可以在設定裡調小到 8px。
- **拖到尚未緩衝的位置可能會卡住。** Instagram 用 MSE 串流播放，能不能跳過去取決於它自己的播放器會不會去抓那段資料。進度條把已緩衝範圍畫成較亮的顏色，事先就看得出安全範圍；真的卡住時圓點會轉圈。
- **直播不顯示進度條。** 直播的 `duration` 是 `Infinity`，沒有進度可言。

## 開發

```bash
npm install
npm test           # 151 個單元測試
npm run test:watch
npm run dev        # WXT 開發模式，含 HMR
npm run build
npm run zip
npm run icons      # 重新產生程式生成的備用圖示
npm run shots      # 重新產生四張 1280x800 商店截圖（含正確性檢查）
```

不需要登入 Instagram 就能驗證的頁面：

```bash
node tools/serve.mjs
```

| 網址 | 用途 |
|---|---|
| `/test/fixtures/mock-instagram.html` | 三種版面（Reels、feed、燈箱）加小縮圖，載入 `lib/` 模組 |
| `/test/fixtures/mock-instagram-bundle.html` | 同上但載入建置產物，並套用嚴格 CSP |
| `/test/fixtures/popup-preview.html?locale=zh_TW` | popup 設定頁，chrome API 用記憶體版本頂替 |
| `/test/fixtures/store-shot.html?copy=en` | 1280×800 商店截圖版面 |
| `/test/fixtures/store-shot-settings.html?copy=en` | 同上，設定頁那張 |

商店截圖不用手動截，跑 `npm run shots`。它會自己開伺服器與 headless Chrome，
並在截圖前斷言 hover 狀態、浮層對齊、popup 沒有溢出、輸出尺寸；
有任何一項不過就中止，不覆蓋既有檔案。手動截圖在這個專案已經漏掉過三次。

這些頁面的 `<video>` 都是真實元素，只有媒體屬性（`duration` / `currentTime` / `buffered`）換成可控的假值，所以不需要任何影片檔案，結果完全確定。

## 架構

不修改 Instagram 的 DOM。在 `document.body` 掛一個 Shadow DOM 浮層，用 `position: fixed` 疊在「當前作用中的那支 `<video>`」上，逐幀依 `getBoundingClientRect()` 對齊。

唯一的 DOM 錨點是 `<video>` 標準元素。Instagram 的 CSS class 是編譯產生的雜湊字串且會隨版本改變，任何綁定它們的做法都會很快失效。

浮層分兩層：外層 host 高 48px、`pointer-events: none`，只是定位容器與時間標籤的畫布；內層貼齊底部的感應條帶才是 `pointer-events: auto`。所以標籤有空間顯示，被攔截的原生點擊區域仍然只有底部那一條。

使用者可調的項目走 CSS 自訂屬性，由 `chrome.storage.sync` 驅動。設定一改只是改 host 上的變數，不重建 DOM，所以拖曳到一半改設定也不會中斷。

| 檔案 | 職責 |
|---|---|
| `entrypoints/content.js` | WXT 的 content script entrypoint |
| `entrypoints/popup/` | 設定頁。預覽區掛的是真正的 `ProgressBar`，可以實際拖曳 |
| `lib/main.js` | 生命週期接線與 rAF 渲染迴圈 |
| `lib/config.js` | 不開放給使用者調的常數 |
| `lib/settings.js` | 設定的正規化、CSS 變數轉換、storage 包裝 |
| `lib/geometry.js` | 純幾何：可視面積、指標位置換算 |
| `lib/time-format.js` | 秒數格式化 |
| `lib/media-state.js` | 緩衝終點、卡頓判定 |
| `lib/video-tracker.js` | 選出當前作用中的影片 |
| `lib/progress-bar.js` | Shadow DOM UI |
| `lib/styles.js` | Shadow root 的 CSS |
| `lib/seek-controller.js` | 指標事件 → 跳轉 |

`lib/` 完全不相依 chrome API —— storage area 由 entrypoint 注入。所以整層邏輯在 vitest 裡直接測得到。

設計文件在 `docs/superpowers/specs/`，實作計畫在 `docs/superpowers/plans/`，上架素材在 `docs/store/`。
