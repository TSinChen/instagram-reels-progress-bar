import { describe, it, expect, vi } from 'vitest';
import {
  DEFAULTS,
  STORAGE_KEY,
  HIT_ZONE_MIN,
  HIT_ZONE_MAX,
  THICKNESS_MIN,
  THICKNESS_MAX,
  HANDLE_MIN,
  HANDLE_MAX,
  hoverThicknessFor,
  normalizeSettings,
  cssVarsFor,
  createSettingsStore,
} from '../lib/settings.js';

/** A stand-in storage area that behaves like chrome.storage.sync. */
function fakeArea(initial = {}) {
  const data = { ...initial };
  const listeners = [];
  return {
    async get(key) {
      return key in data ? { [key]: data[key] } : {};
    },
    async set(patch) {
      const changes = {};
      for (const [k, v] of Object.entries(patch)) {
        changes[k] = { oldValue: data[k], newValue: v };
        data[k] = v;
      }
      listeners.forEach((fn) => fn(changes));
    },
    onChanged: {
      addListener: (fn) => listeners.push(fn),
      removeListener: (fn) => {
        const i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      },
    },
    _listenerCount: () => listeners.length,
    _raw: () => data,
  };
}

describe('hoverThicknessFor', () => {
  it('hover thickness is twice the idle thickness', () => {
    expect(hoverThicknessFor(3)).toBe(6);
    expect(hoverThicknessFor(8)).toBe(16);
  });
});

describe('normalizeSettings', () => {
  it('returns defaults for no input', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULTS);
  });

  it('returns defaults for null', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULTS);
  });

  it('returns defaults for a non-object', () => {
    expect(normalizeSettings('not an object')).toEqual(DEFAULTS);
  });

  it('clamps a hover area height below the minimum', () => {
    expect(normalizeSettings({ hitZoneHeight: 1 }).hitZoneHeight).toBe(HIT_ZONE_MIN);
  });

  it('clamps a hover area height above the maximum', () => {
    expect(normalizeSettings({ hitZoneHeight: 999 }).hitZoneHeight).toBe(HIT_ZONE_MAX);
  });

  it('rounds the hover area height', () => {
    expect(normalizeSettings({ hitZoneHeight: 16.7 }).hitZoneHeight).toBe(17);
  });

  it('accepts a numeric string for the hover area height', () => {
    expect(normalizeSettings({ hitZoneHeight: '20' }).hitZoneHeight).toBe(20);
  });

  it('falls back to the default for a non-numeric hover area height', () => {
    expect(normalizeSettings({ hitZoneHeight: 'abc' }).hitZoneHeight).toBe(DEFAULTS.hitZoneHeight);
  });

  it('clamps bar thickness to its range', () => {
    expect(normalizeSettings({ barThickness: 0 }).barThickness).toBe(THICKNESS_MIN);
    expect(normalizeSettings({ barThickness: 99 }).barThickness).toBe(THICKNESS_MAX);
    expect(normalizeSettings({ barThickness: 5 }).barThickness).toBe(5);
  });

  it('clamps handle size to its range', () => {
    expect(normalizeSettings({ handleSize: 2 }).handleSize).toBe(HANDLE_MIN);
    expect(normalizeSettings({ handleSize: 99 }).handleSize).toBe(HANDLE_MAX);
    expect(normalizeSettings({ handleSize: 14 }).handleSize).toBe(14);
  });

  it('showLabel accepts booleans only', () => {
    expect(normalizeSettings({ showLabel: false }).showLabel).toBe(false);
    expect(normalizeSettings({ showLabel: 'false' }).showLabel).toBe(DEFAULTS.showLabel);
  });

  it('drops unknown fields', () => {
    const result = normalizeSettings({ barThickness: 4, injected: 1, color: 'red' });
    expect(result).toEqual({ ...DEFAULTS, barThickness: 4 });
    expect('color' in result).toBe(false);
  });

  it('a colour field left by an older version is harmless', () => {
    // Colour is no longer a setting, but old installs may still have it stored
    expect(normalizeSettings({ color: 'blue', hitZoneHeight: 20 })).toEqual({
      ...DEFAULTS,
      hitZoneHeight: 20,
    });
  });
});

describe('cssVarsFor', () => {
  it('the hover area height carries px units', () => {
    expect(cssVarsFor({ hitZoneHeight: 24 })['--igrc-hit-zone']).toBe('24px');
  });

  it('hiding the time label maps to display none', () => {
    expect(cssVarsFor({ showLabel: false })['--igrc-label-display']).toBe('none');
  });

  it('showing the time label maps to display block', () => {
    expect(cssVarsFor({ showLabel: true })['--igrc-label-display']).toBe('block');
  });

  it('thickness yields both an idle and a hover value', () => {
    const vars = cssVarsFor({ barThickness: 5 });
    expect(vars['--igrc-bar-idle']).toBe('5px');
    expect(vars['--igrc-bar-hover']).toBe('10px');
  });

  it('the handle size carries px units', () => {
    expect(cssVarsFor({ handleSize: 18 })['--igrc-handle']).toBe('18px');
  });

  it('invalid input still yields a complete, legal set', () => {
    const vars = cssVarsFor({ hitZoneHeight: -5, barThickness: 'x', handleSize: 999 });
    expect(vars['--igrc-hit-zone']).toBe(`${HIT_ZONE_MIN}px`);
    expect(vars['--igrc-bar-idle']).toBe(`${DEFAULTS.barThickness}px`);
    expect(vars['--igrc-handle']).toBe(`${HANDLE_MAX}px`);
  });

  it('every property has a value, so nothing is left unstyled', () => {
    const vars = cssVarsFor({});
    for (const [name, value] of Object.entries(vars)) {
      expect(value, name).toBeTruthy();
    }
    expect(Object.keys(vars).length).toBe(5);
  });
});

describe('createSettingsStore', () => {
  it('loads defaults from empty storage', async () => {
    const store = createSettingsStore(fakeArea());
    expect(await store.load()).toEqual(DEFAULTS);
  });

  it('loads stored settings', async () => {
    const saved = { hitZoneHeight: 20, showLabel: false, barThickness: 6, handleSize: 16 };
    const store = createSettingsStore(fakeArea({ [STORAGE_KEY]: saved }));
    expect(await store.load()).toEqual(saved);
  });

  it('sanitises corrupt data on load', async () => {
    const area = fakeArea({ [STORAGE_KEY]: { hitZoneHeight: 9999, barThickness: -3 } });
    const store = createSettingsStore(area);
    expect(await store.load()).toEqual({
      ...DEFAULTS,
      hitZoneHeight: HIT_ZONE_MAX,
      barThickness: THICKNESS_MIN,
    });
  });

  it('a failing read falls back to defaults instead of throwing', async () => {
    const broken = { get: () => Promise.reject(new Error('storage unavailable')) };
    const store = createSettingsStore(broken);
    await expect(store.load()).resolves.toEqual(DEFAULTS);
  });

  it('normalises before writing', async () => {
    const area = fakeArea();
    const store = createSettingsStore(area);
    const saved = await store.save({ hitZoneHeight: 100, showLabel: false, handleSize: 1 });
    expect(saved).toEqual({
      ...DEFAULTS,
      hitZoneHeight: HIT_ZONE_MAX,
      showLabel: false,
      handleSize: HANDLE_MIN,
    });
    expect(area._raw()[STORAGE_KEY]).toEqual(saved);
  });

  it('a failing write rejects, so the caller can report it', async () => {
    // Swallowing this would let the popup claim it saved when it did not
    const broken = { get: async () => ({}), set: () => Promise.reject(new Error('quota exceeded')) };
    const store = createSettingsStore(broken);
    await expect(store.save({ barThickness: 5 })).rejects.toThrow('quota exceeded');
  });

  it('notifies watchers when settings change', async () => {
    const area = fakeArea();
    const store = createSettingsStore(area);
    const seen = vi.fn();
    store.watch(seen);
    await store.save({ barThickness: 7 });
    expect(seen).toHaveBeenCalledWith(expect.objectContaining({ barThickness: 7 }));
  });

  it('changes to other keys do not notify', async () => {
    const area = fakeArea();
    const store = createSettingsStore(area);
    const seen = vi.fn();
    store.watch(seen);
    await area.set({ somethingElse: 1 });
    expect(seen).not.toHaveBeenCalled();
  });

  it('the function returned by watch unsubscribes', async () => {
    const area = fakeArea();
    const store = createSettingsStore(area);
    const seen = vi.fn();
    const unwatch = store.watch(seen);
    expect(area._listenerCount()).toBe(1);
    unwatch();
    expect(area._listenerCount()).toBe(0);
    await store.save({ barThickness: 4 });
    expect(seen).not.toHaveBeenCalled();
  });

  it('without a storage area the store yields defaults and never throws', async () => {
    const store = createSettingsStore(null);
    expect(await store.load()).toEqual(DEFAULTS);
    await expect(store.save({ barThickness: 5 })).resolves.toMatchObject({ barThickness: 5 });
    expect(() => store.watch(() => {})()).not.toThrow();
  });
});
