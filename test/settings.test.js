import { describe, it, expect, vi } from 'vitest';
import {
  DEFAULTS,
  COLOR_PRESETS,
  STORAGE_KEY,
  HIT_ZONE_MIN,
  HIT_ZONE_MAX,
  normalizeSettings,
  cssVarsFor,
  createSettingsStore,
} from '../lib/settings.js';

/** 做一個假的 storage area，行為比照 chrome.storage.sync。 */
function fakeArea(initial = {}) {
  let data = { ...initial };
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

describe('normalizeSettings', () => {
  it('沒有輸入時回傳預設值', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULTS);
  });

  it('null 也回傳預設值', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULTS);
  });

  it('不是物件的輸入回傳預設值', () => {
    expect(normalizeSettings('壞掉的資料')).toEqual(DEFAULTS);
  });

  it('保留合法的顏色', () => {
    expect(normalizeSettings({ color: 'red' }).color).toBe('red');
  });

  it('不認識的顏色退回預設', () => {
    expect(normalizeSettings({ color: 'chartreuse' }).color).toBe(DEFAULTS.color);
  });

  it('不會把 Object.prototype 上的名稱當成合法顏色', () => {
    expect(normalizeSettings({ color: 'toString' }).color).toBe(DEFAULTS.color);
  });

  it('感應區高度低於下限會夾住', () => {
    expect(normalizeSettings({ hitZoneHeight: 1 }).hitZoneHeight).toBe(HIT_ZONE_MIN);
  });

  it('感應區高度高於上限會夾住', () => {
    expect(normalizeSettings({ hitZoneHeight: 999 }).hitZoneHeight).toBe(HIT_ZONE_MAX);
  });

  it('感應區高度取整數', () => {
    expect(normalizeSettings({ hitZoneHeight: 16.7 }).hitZoneHeight).toBe(17);
  });

  it('感應區高度是字串數字也接受', () => {
    expect(normalizeSettings({ hitZoneHeight: '20' }).hitZoneHeight).toBe(20);
  });

  it('感應區高度是 NaN 時退回預設', () => {
    expect(normalizeSettings({ hitZoneHeight: 'abc' }).hitZoneHeight).toBe(DEFAULTS.hitZoneHeight);
  });

  it('showLabel 只接受布林值', () => {
    expect(normalizeSettings({ showLabel: false }).showLabel).toBe(false);
    expect(normalizeSettings({ showLabel: 'false' }).showLabel).toBe(DEFAULTS.showLabel);
  });

  it('多餘的欄位會被丟掉', () => {
    expect(normalizeSettings({ color: 'blue', 惡意欄位: 1 })).toEqual({
      color: 'blue',
      hitZoneHeight: DEFAULTS.hitZoneHeight,
      showLabel: DEFAULTS.showLabel,
    });
  });
});

describe('cssVarsFor', () => {
  it('依顏色設定產生對應色票', () => {
    const vars = cssVarsFor({ color: 'red' });
    expect(vars['--igrc-color-played']).toBe(COLOR_PRESETS.red.played);
    expect(vars['--igrc-color-handle']).toBe(COLOR_PRESETS.red.handle);
  });

  it('感應區高度帶上 px 單位', () => {
    expect(cssVarsFor({ hitZoneHeight: 24 })['--igrc-hit-zone']).toBe('24px');
  });

  it('關掉時間標籤時對應到 display none', () => {
    expect(cssVarsFor({ showLabel: false })['--igrc-label-display']).toBe('none');
  });

  it('開啟時間標籤時對應到 display block', () => {
    expect(cssVarsFor({ showLabel: true })['--igrc-label-display']).toBe('block');
  });

  it('輸入不合法時仍產生一組完整且合法的變數', () => {
    const vars = cssVarsFor({ color: '???', hitZoneHeight: -5 });
    expect(vars['--igrc-color-played']).toBe(COLOR_PRESETS.white.played);
    expect(vars['--igrc-hit-zone']).toBe(`${HIT_ZONE_MIN}px`);
  });
});

describe('createSettingsStore', () => {
  it('storage 是空的時候載入預設值', async () => {
    const store = createSettingsStore(fakeArea());
    expect(await store.load()).toEqual(DEFAULTS);
  });

  it('載入已儲存的設定', async () => {
    const area = fakeArea({ [STORAGE_KEY]: { color: 'blue', hitZoneHeight: 20, showLabel: false } });
    const store = createSettingsStore(area);
    expect(await store.load()).toEqual({ color: 'blue', hitZoneHeight: 20, showLabel: false });
  });

  it('載入時會清理壞掉的資料', async () => {
    const area = fakeArea({ [STORAGE_KEY]: { color: 'nope', hitZoneHeight: 9999 } });
    const store = createSettingsStore(area);
    expect(await store.load()).toEqual({
      color: DEFAULTS.color,
      hitZoneHeight: HIT_ZONE_MAX,
      showLabel: DEFAULTS.showLabel,
    });
  });

  it('storage 讀取拋錯時退回預設值而不是炸掉', async () => {
    const broken = { get: () => Promise.reject(new Error('storage 掛了')) };
    const store = createSettingsStore(broken);
    await expect(store.load()).resolves.toEqual(DEFAULTS);
  });

  it('儲存時會先正規化再寫入', async () => {
    const area = fakeArea();
    const store = createSettingsStore(area);
    const saved = await store.save({ color: 'red', hitZoneHeight: 100, showLabel: false });
    expect(saved).toEqual({ color: 'red', hitZoneHeight: HIT_ZONE_MAX, showLabel: false });
    expect(area._raw()[STORAGE_KEY]).toEqual(saved);
  });

  it('儲存拋錯時不會讓呼叫端炸掉', async () => {
    const broken = { get: async () => ({}), set: () => Promise.reject(new Error('配額用完')) };
    const store = createSettingsStore(broken);
    await expect(store.save({ color: 'red' })).resolves.toMatchObject({ color: 'red' });
  });

  it('設定變更時通知監聽者', async () => {
    const area = fakeArea();
    const store = createSettingsStore(area);
    const seen = vi.fn();
    store.watch(seen);
    await store.save({ color: 'blue' });
    expect(seen).toHaveBeenCalledWith(expect.objectContaining({ color: 'blue' }));
  });

  it('其他鍵的變更不會觸發通知', async () => {
    const area = fakeArea();
    const store = createSettingsStore(area);
    const seen = vi.fn();
    store.watch(seen);
    await area.set({ '其他東西': 1 });
    expect(seen).not.toHaveBeenCalled();
  });

  it('watch 回傳的函式可以解除監聽', async () => {
    const area = fakeArea();
    const store = createSettingsStore(area);
    const seen = vi.fn();
    const unwatch = store.watch(seen);
    expect(area._listenerCount()).toBe(1);
    unwatch();
    expect(area._listenerCount()).toBe(0);
    await store.save({ color: 'red' });
    expect(seen).not.toHaveBeenCalled();
  });

  it('沒有 storage 可用時整個 store 退化成預設值且不拋錯', async () => {
    const store = createSettingsStore(null);
    expect(await store.load()).toEqual(DEFAULTS);
    expect(await store.save({ color: 'red' })).toMatchObject({ color: 'red' });
    expect(() => store.watch(() => {})()).not.toThrow();
  });
});
