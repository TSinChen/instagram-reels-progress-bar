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
