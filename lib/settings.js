// 使用者可調的外觀設定。
//
// 上架之後使用者改不了程式碼，所以尺寸不能再是編譯進 CSS 的常數。
// 這裡把設定轉成 CSS custom properties，套在 Shadow host 上；
// 自訂屬性會穿透 shadow 邊界繼承下去，所以改一個變數整條進度條就跟著變，
// 不需要重建 UI，也不需要重新整理頁面。

export const STORAGE_KEY = 'igrc:settings';

/** 感應區高度。太小會很難點到，太大會擋住 Instagram 自己的按鈕。 */
export const HIT_ZONE_MIN = 8;
export const HIT_ZONE_MAX = 32;

/** 閒置時的進度條高度。上限刻意保守，太粗會蓋到影片內容。 */
export const THICKNESS_MIN = 2;
export const THICKNESS_MAX = 8;

/** 拖曳圓點直徑。 */
export const HANDLE_MIN = 8;
export const HANDLE_MAX = 20;

export const DEFAULTS = Object.freeze({
  hitZoneHeight: 16,
  showLabel: true,
  barThickness: 3,
  handleSize: 12,
});

/**
 * hover 時的進度條高度是閒置高度的兩倍。
 * 不另外開一個設定，是因為使用者要的是「進度條明不明顯」這件事，
 * 拆成兩個滑桿只是把一個決定變成兩個。兩倍剛好是原本 3px → 6px 的比例。
 */
export function hoverThicknessFor(barThickness) {
  return barThickness * 2;
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.round(n);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

/**
 * 把任何來源的資料整理成一份合法設定。
 * storage 裡的內容可能來自舊版、被手動改壞、或根本不存在，一律不信任。
 */
export function normalizeSettings(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  return {
    hitZoneHeight: clampInt(input.hitZoneHeight, HIT_ZONE_MIN, HIT_ZONE_MAX, DEFAULTS.hitZoneHeight),
    showLabel: typeof input.showLabel === 'boolean' ? input.showLabel : DEFAULTS.showLabel,
    barThickness: clampInt(input.barThickness, THICKNESS_MIN, THICKNESS_MAX, DEFAULTS.barThickness),
    handleSize: clampInt(input.handleSize, HANDLE_MIN, HANDLE_MAX, DEFAULTS.handleSize),
  };
}

/** 設定轉成要掛在 Shadow host 上的 CSS 自訂屬性。 */
export function cssVarsFor(settings) {
  const safe = normalizeSettings(settings);
  return {
    '--igrc-hit-zone': `${safe.hitZoneHeight}px`,
    '--igrc-label-display': safe.showLabel ? 'block' : 'none',
    '--igrc-bar-idle': `${safe.barThickness}px`,
    '--igrc-bar-hover': `${hoverThicknessFor(safe.barThickness)}px`,
    '--igrc-handle': `${safe.handleSize}px`,
  };
}

/**
 * 包一層 storage area，讓 lib/ 不用直接相依 chrome API。
 * 呼叫端傳入 chrome.storage.sync，測試傳入假的即可。
 * area 為 null 時整個 store 退化成「永遠回傳預設值」，不會拋錯。
 */
export function createSettingsStore(area) {
  return {
    async load() {
      if (!area) return { ...DEFAULTS };
      try {
        const got = await area.get(STORAGE_KEY);
        return normalizeSettings(got ? got[STORAGE_KEY] : null);
      } catch {
        // storage 讀不到不該讓進度條整個不能用，退回預設值
        return { ...DEFAULTS };
      }
    },

    async save(settings) {
      const next = normalizeSettings(settings);
      if (!area) return next;
      try {
        await area.set({ [STORAGE_KEY]: next });
      } catch {
        // 寫入失敗就算了，下次開啟會回到上一次成功儲存的值
      }
      return next;
    },

    /** 回傳解除監聽的函式。設定一改，所有開著的分頁都會即時套用。 */
    watch(callback) {
      if (!area || !area.onChanged || typeof area.onChanged.addListener !== 'function') {
        return () => {};
      }
      const listener = (changes) => {
        if (!changes || !(STORAGE_KEY in changes)) return;
        callback(normalizeSettings(changes[STORAGE_KEY].newValue));
      };
      area.onChanged.addListener(listener);
      return () => area.onChanged.removeListener(listener);
    },
  };
}
