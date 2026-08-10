// User-adjustable appearance, mapped to CSS custom properties on the shadow host.
// Custom properties inherit through the shadow boundary, so setting them is enough
// to repaint the bar without rebuilding any DOM.

export const STORAGE_KEY = 'igrc:settings';

/** Too small is hard to hit; too large covers Instagram own buttons. */
export const HIT_ZONE_MIN = 8;
export const HIT_ZONE_MAX = 32;

/** Kept conservative: a thicker bar starts obscuring the footage. */
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

/** Derived rather than configured: users want one decision about visibility, not two. */
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

/** Stored data may come from an older version or have been edited by hand. Trust none of it. */
export function normalizeSettings(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  return {
    hitZoneHeight: clampInt(input.hitZoneHeight, HIT_ZONE_MIN, HIT_ZONE_MAX, DEFAULTS.hitZoneHeight),
    showLabel: typeof input.showLabel === 'boolean' ? input.showLabel : DEFAULTS.showLabel,
    barThickness: clampInt(input.barThickness, THICKNESS_MIN, THICKNESS_MAX, DEFAULTS.barThickness),
    handleSize: clampInt(input.handleSize, HANDLE_MIN, HANDLE_MAX, DEFAULTS.handleSize),
  };
}

/** Settings as CSS custom properties for the shadow host. */
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

/** Wraps a storage area so lib/ stays free of Chrome APIs. A null area yields defaults. */
export function createSettingsStore(area) {
  return {
    async load() {
      if (!area) return { ...DEFAULTS };
      try {
        const got = await area.get(STORAGE_KEY);
        return normalizeSettings(got ? got[STORAGE_KEY] : null);
      } catch {
        // A storage failure must not take the bar down with it
        return { ...DEFAULTS };
      }
    },

    async save(settings) {
      const next = normalizeSettings(settings);
      if (!area) return next;
      try {
        await area.set({ [STORAGE_KEY]: next });
      } catch {
        // Next open falls back to the last value that was written
      }
      return next;
    },

    /** Returns an unsubscribe function. */
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
