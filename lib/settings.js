// 使用者可調的外觀設定，轉成掛在 Shadow host 上的 CSS 自訂屬性。
// 自訂屬性會穿透 shadow 邊界繼承，所以改變數就夠了，不用重建 UI。

export const STORAGE_KEY = 'igrc:settings';

/** 太小難點到，太大會擋住 Instagram 自己的按鈕。 */
export const HIT_ZONE_MIN = 8;
export const HIT_ZONE_MAX = 32;

/** 上限保守，太粗會蓋到影片內容。 */
export const THICKNESS_MIN = 2;
export const THICKNESS_MAX = 8;

export const HANDLE_MIN = 8;
export const HANDLE_MAX = 20;

export const DEFAULTS = Object.freeze({
  hitZoneHeight: 16,
  showLabel: true,
  barThickness: 3,
  handleSize: 12,
});

/** 不另開設定：使用者要的是「明不明顯」一件事，拆兩個滑桿只是多一個決定。 */
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

/** storage 的內容可能來自舊版或被改壞，一律不信任。 */
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

/** 包一層 storage area，讓 lib/ 不相依 chrome API。area 為 null 時退化成永遠回傳預設值。 */
export function createSettingsStore(area) {
  return {
    async load() {
      if (!area) return { ...DEFAULTS };
      try {
        const got = await area.get(STORAGE_KEY);
        return normalizeSettings(got ? got[STORAGE_KEY] : null);
      } catch {
        // 讀不到不該讓進度條整個不能用
        return { ...DEFAULTS };
      }
    },

    async save(settings) {
      const next = normalizeSettings(settings);
      if (!area) return next;
      try {
        await area.set({ [STORAGE_KEY]: next });
      } catch {
        // 寫入失敗就算了，下次開啟回到上次成功儲存的值
      }
      return next;
    },

    /** 回傳解除監聽的函式。 */
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
