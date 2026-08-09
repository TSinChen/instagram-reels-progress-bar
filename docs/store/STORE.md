# Chrome 線上應用程式商店 — 送審素材

這份文件裡的每一段都可以直接複製貼上到開發人員資訊主頁的對應欄位。
只剩一個 **[待填]**：隱私權政策的網址（第 6 節有步驟）。其餘欄位都已定案。

---

## 0. 上架前你必須自己做的事

| 項目 | 說明 |
|---|---|
| 開發人員帳號 | 到 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) 註冊，一次性費用 5 美元，需要 Google 帳號。 |
| 隱私權政策網址 | 把 `docs/store/PRIVACY.md` 貼成公開的 GitHub Gist，網址填進第 6 節。步驟見那一節。 |

名稱、類別、顯示設定都已定案，其餘欄位照抄本文件即可。

打包指令（產出 `.output/instagram-reels-progress-bar-1.0.0-chrome.zip`）：

```bash
npm run zip
```

---

## 1. 名稱

**Instagram Reels Progress Bar**（已定案）

名稱帶 Instagram 字樣，可搜尋性好，代價是屬於事後可能被 Meta 提出商標申訴而下架的類型。這是已知且接受的取捨。

真的收到通知需要改名時，改名是一個指令，不用手動翻檔案：

```bash
node tools/rename.mjs "新名稱"
npm run build
```

---

## 2. 商店基本資料

| 欄位 | 填什麼 |
|---|---|
| 類別 | Functionality & UI |
| 語言 | English（主要）、中文（繁體） |
| 版本 | 1.0.0 |
| 顯示設定 | 公開（Public） |

---

## 3. 簡短說明（上限 132 字元）

**English**

```
Adds a draggable seek bar to Reels and videos on instagram.com, so you can jump to any point.
```
（93 字元）

**中文（繁體）**

```
為 instagram.com 的 Reels 與影片加上可拖曳的進度條，讓你跳到影片的任意位置。
```

這兩段與 `_locales` 裡的 `extDescription` 一致，改的話兩邊要一起改。

---

## 4. 詳細說明

**English**

```
Instagram's web player has no seek bar. You can't skip ahead, you can't go back to
the part you missed, and you can't tell how long a video is. This extension adds
the bar that should have been there.

WHAT YOU GET

• Drag or click anywhere on the bar to jump to that point
• Current time and total length, shown while you're using the bar
• The buffered range is drawn in a lighter shade, so you can see how far ahead is
  safe to jump to
• Works on the Reels page, the home feed, post lightboxes and Explore

SETTINGS

Click the toolbar icon to adjust the bar thickness, the handle size, how tall the
hover area is, or to turn the time label off. Changes apply immediately to every
Instagram tab you have open.

HOW IT WORKS

The bar is drawn in its own isolated layer on top of the video. The extension never
modifies Instagram's page, and it finds videos by looking for standard HTML video
elements rather than Instagram's own markup, which is why it keeps working when
Instagram changes its layout.

PRIVACY

No data collection of any kind. No analytics, no telemetry, no servers, no network
requests. The only thing stored is your four appearance settings, kept in your own
browser profile.

GOOD TO KNOW

• The bottom 16 pixels of the video become the bar's hover area, so clicks
  there go to the bar instead of Instagram. You can shrink this in settings.
• Jumping to a part of the video that hasn't downloaded yet may stall, because
  Instagram's own player decides whether to fetch it. The buffered range is drawn
  on the bar so you can see this coming.
• Live videos have no fixed length, so no bar is shown for them.

Not affiliated with, endorsed by, or sponsored by Instagram or Meta.
```

**中文（繁體）**

```
Instagram 網頁版的播放器沒有進度條。你沒辦法快轉、沒辦法回去看漏掉的片段，
也不知道影片到底多長。這個擴充功能把本來就該有的那條進度條補上。

功能

• 拖曳或點擊進度條上任一點，直接跳到那裡
• 使用進度條時會顯示目前時間與影片總長度
• 已緩衝的範圍會用較亮的顏色畫出來，一眼看出拖到哪裡是安全的
• Reels 專頁、首頁動態、貼文燈箱、探索頁都能用

設定

點工具列的圖示即可調整進度條粗細、拖曳圓點大小、感應區高度，
或關掉時間標籤。改完立刻套用到所有開著的 Instagram 分頁。

運作方式

進度條畫在影片上方一層獨立的圖層裡，完全不修改 Instagram 的頁面。
它靠標準的 HTML 影片元素來找影片，而不是靠 Instagram 自己的標記，
所以 Instagram 改版時它仍然能用。

隱私

不蒐集任何資料。沒有分析工具、沒有遙測、沒有伺服器、不發任何網路請求。
唯一儲存的是你的四項外觀設定，存在你自己的瀏覽器設定檔裡。

使用前須知

• 影片底部 16 像素會成為進度條的感應區，該區域的點擊會由進度條接手，
  不會傳給 Instagram。嫌礙事可以在設定裡調小。
• 跳到尚未下載的片段有可能會卡住，因為要不要去抓那段資料是由
  Instagram 自己的播放器決定的。進度條會畫出已緩衝範圍讓你事先看得到。
• 直播沒有固定長度，所以不會顯示進度條。

本擴充功能與 Instagram 及 Meta 無任何隸屬、背書或贊助關係。
```

---

## 5. 圖片素材

| 用途 | 檔案 | 尺寸 |
|---|---|---|
| 商店圖示 | `public/icon/128.png` | 128×128 |
| 螢幕擷取畫面 1（英） | `docs/store/screenshot-1-en.png` | 1280×800 |
| 螢幕擷取畫面 2（英） | `docs/store/screenshot-2-en.png` | 1280×800 |
| 螢幕擷取畫面 1（中） | `docs/store/screenshot-1-zh.png` | 1280×800 |
| 螢幕擷取畫面 2（中） | `docs/store/screenshot-2-zh.png` | 1280×800 |

商店至少要 1 張、最多 5 張截圖。中英文版本各上傳到對應語言的商店資訊即可。

截圖是用 `test/fixtures/store-shot.html` 與 `store-shot-settings.html` 產生的，
畫面裡的 Instagram 版面是自己畫的模擬版面（不是真實的 Instagram 截圖），
避免使用他人的畫面內容。要重新產生：

```bash
node tools/serve.mjs
# 用 1280x800 的視窗開這兩個網址並截圖
#   http://localhost:8123/test/fixtures/store-shot.html?copy=en
#   http://localhost:8123/test/fixtures/store-shot-settings.html?copy=en
```

宣傳大圖（440×280）目前沒做，那是選填欄位，只有要爭取首頁推薦才需要。

---

## 6. 隱私權實務揭露

這是最容易卡關的一段，逐欄照抄。

### 單一用途說明

**English**

```
This extension has one purpose: to add a draggable seek bar to videos on
instagram.com so the user can jump to any point in a video. It does nothing else.
```

**中文**

```
本擴充功能只有一個用途：在 instagram.com 的影片上加入可拖曳的進度條，
讓使用者跳到影片的任意位置。除此之外不做任何事。
```

### 權限用途說明

**`storage`**

```
Stores four appearance preferences chosen by the user: the thickness of the bar,
the size of the drag handle, the height of the hover area, and whether the time
label is shown. No user content, browsing data, or personal information is stored.
```

**主機權限 `https://*.instagram.com/*`**

```
The extension draws a seek bar on top of videos on instagram.com. To do that it
must run a content script on that domain to locate the page's video element, read
its duration and playback position, and set a new position when the user drags the
bar. instagram.com is the only site the extension runs on, because it is the only
site the feature applies to.
```

### 遠端程式碼

選「否，我沒有使用遠端程式碼」。所有程式碼都打包在套件裡，沒有 `eval`，也不從外部載入任何腳本。

### 資料用途

以下每一項都**不要勾選**：

- 個人身分識別資訊
- 健康資訊
- 財務與付款資訊
- 驗證資訊
- 個人通訊內容
- 位置資訊
- 網路瀏覽活動
- 使用者活動
- 網站內容

三項聲明全部勾選：

- 不會將使用者資料販售給第三方
- 不會將使用者資料用於或轉移至與項目單一用途無關的用途
- 不會將使用者資料用於或轉移至判斷信用度或放貸用途

### 隱私權政策網址

**[待填]** — 用公開的 GitHub Gist：

1. 到 [gist.github.com](https://gist.github.com) 新增一個 Gist
2. 檔名填 `PRIVACY.md`，內容整份貼上 `docs/store/PRIVACY.md`
3. 按 **Create public gist**（不能選 secret，商店要能公開存取）
4. 複製網址列的網址填進這一欄

Gist 的網址長這樣：`https://gist.github.com/<你的帳號>/<一串英數>`

---

## 7. 送審後

首次審查通常幾個小時到幾個工作天。含主機權限的擴充功能有時會被額外人工審查，會久一點。

被退件的話，信裡會寫明違反的條款。最常見的兩種是名稱商標問題，以及主機權限的用途說明寫得不夠具體 —— 上面第 6 節的版本已經盡量寫得明確。

---

## 8. 改名字

名稱無可避免會出現在給人看的文字裡（README 標題、商店文案、隱私權政策），
不可能只存在一個地方。所以改名是一個指令：

```bash
node tools/rename.mjs --check          # 先看目前名稱出現在哪 14 處
node tools/rename.mjs "你的新名稱"      # 一次全部改掉，含 package.json 的 slug
npm run build
```

`package.json` 的 `name` 會跟著變成 slug，zip 檔名也會跟著變。
