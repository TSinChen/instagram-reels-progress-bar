// 使用者可調的外觀設定。
//
// 上架之後使用者改不了程式碼，所以顏色與尺寸不能再是編譯進 CSS 的常數。
// 這裡把設定轉成 CSS custom properties，套在 Shadow host 上；
// 自訂屬性會穿透 shadow 邊界繼承下去，所以改一個變數整條進度條就跟著變，
// 不需要重建 UI，也不需要重新整理頁面。

export const STORAGE_KEY = 'igrc:settings';

/** 感應區高度的允許範圍。太小會很難點到，太大會擋住 Instagram 自己的按鈕。 */
export const HIT_ZONE_MIN = 8;
export const HIT_ZONE_MAX = 32;

export const DEFAULTS = Object.freeze({
  color: 'white',
  hitZoneHeight: 16,
  showLabel: true,
});

/**
 * 只給預設色票而不開放任意色碼，理由有二：
 * 一是使用者選到深色系會在深色影片上完全看不見，二是免去驗證色碼字串的麻煩。
 */
export const COLOR_PRESETS = Object.freeze({
  white: {
    played: '#ffffff',
    handle: '#ffffff',
    buffered: 'rgba(255, 255, 255, 0.45)',
    track: 'rgba(255, 255, 255, 0.25)',
  },
  red: {
    played: '#ff0033',
    handle: '#ff0033',
    buffered: 'rgba(255, 255, 255, 0.40)',
    track: 'rgba(255, 255, 255, 0.25)',
  },
  blue: {
    played: '#0095f6',
    handle: '#0095f6',
    buffered: 'rgba(255, 255, 255, 0.40)',
    track: 'rgba(255, 255, 255, 0.25)',
  },
});

/**
 * 把任何來源的資料整理成一份合法設定。
 * storage 裡的內容可能來自舊版、被手動改壞、或根本不存在，一律不信任。
 */
export function normalizeSettings(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};

  const color = Object.prototype.hasOwnProperty.call(COLOR_PRESETS, input.color)
    ? input.color
    : DEFAULTS.color;

  let hitZoneHeight = Number(input.hitZoneHeight);
  if (!Number.isFinite(hitZoneHeight)) {
    hitZoneHeight = DEFAULTS.hitZoneHeight;
  } else {
    hitZoneHeight = Math.round(hitZoneHeight);
    if (hitZoneHeight < HIT_ZONE_MIN) hitZoneHeight = HIT_ZONE_MIN;
    if (hitZoneHeight > HIT_ZONE_MAX) hitZoneHeight = HIT_ZONE_MAX;
  }

  const showLabel = typeof input.showLabel === 'boolean' ? input.showLabel : DEFAULTS.showLabel;

  return { color, hitZoneHeight, showLabel };
}

/** 設定轉成要掛在 Shadow host 上的 CSS 自訂屬性。 */
export function cssVarsFor(settings) {
  const safe = normalizeSettings(settings);
  const palette = COLOR_PRESETS[safe.color];
  return {
    '--igrc-color-played': palette.played,
    '--igrc-color-handle': palette.handle,
    '--igrc-color-buffered': palette.buffered,
    '--igrc-color-track': palette.track,
    '--igrc-hit-zone': `${safe.hitZoneHeight}px`,
    '--igrc-label-display': safe.showLabel ? 'block' : 'none',
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
