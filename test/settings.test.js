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

/** 做一個假的 storage area，行為比照 chrome.storage.sync。 */
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
  it('hover 高度是閒置高度的兩倍', () => {
    expect(hoverThicknessFor(3)).toBe(6);
    expect(hoverThicknessFor(8)).toBe(16);
  });
});

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

  it('感應區高度不是數字時退回預設', () => {
    expect(normalizeSettings({ hitZoneHeight: 'abc' }).hitZoneHeight).toBe(DEFAULTS.hitZoneHeight);
  });

  it('進度條粗細會夾在範圍內', () => {
    expect(normalizeSettings({ barThickness: 0 }).barThickness).toBe(THICKNESS_MIN);
    expect(normalizeSettings({ barThickness: 99 }).barThickness).toBe(THICKNESS_MAX);
    expect(normalizeSettings({ barThickness: 5 }).barThickness).toBe(5);
  });

  it('圓點大小會夾在範圍內', () => {
    expect(normalizeSettings({ handleSize: 2 }).handleSize).toBe(HANDLE_MIN);
    expect(normalizeSettings({ handleSize: 99 }).handleSize).toBe(HANDLE_MAX);
    expect(normalizeSettings({ handleSize: 14 }).handleSize).toBe(14);
  });

  it('showLabel 只接受布林值', () => {
    expect(normalizeSettings({ showLabel: false }).showLabel).toBe(false);
    expect(normalizeSettings({ showLabel: 'false' }).showLabel).toBe(DEFAULTS.showLabel);
  });

  it('多餘的欄位會被丟掉', () => {
    const result = normalizeSettings({ barThickness: 4, 惡意欄位: 1, color: 'red' });
    expect(result).toEqual({ ...DEFAULTS, barThickness: 4 });
    expect('color' in result).toBe(false);
  });

  it('舊版存下來的 color 欄位不會造成問題', () => {
    // 顏色設定已經拿掉，storage 裡可能還留著舊值
    expect(normalizeSettings({ color: 'blue', hitZoneHeight: 20 })).toEqual({
      ...DEFAULTS,
      hitZoneHeight: 20,
    });
  });
});

describe('cssVarsFor', () => {
  it('感應區高度帶上 px 單位', () => {
    expect(cssVarsFor({ hitZoneHeight: 24 })['--igrc-hit-zone']).toBe('24px');
  });

  it('關掉時間標籤時對應到 display none', () => {
    expect(cssVarsFor({ showLabel: false })['--igrc-label-display']).toBe('none');
  });

  it('開啟時間標籤時對應到 display block', () => {
    expect(cssVarsFor({ showLabel: true })['--igrc-label-display']).toBe('block');
  });

  it('粗細同時產生閒置與 hover 兩個值', () => {
    const vars = cssVarsFor({ barThickness: 5 });
    expect(vars['--igrc-bar-idle']).toBe('5px');
    expect(vars['--igrc-bar-hover']).toBe('10px');
  });

  it('圓點大小帶上 px 單位', () => {
    expect(cssVarsFor({ handleSize: 18 })['--igrc-handle']).toBe('18px');
  });

  it('輸入不合法時仍產生一組完整且合法的變數', () => {
    const vars = cssVarsFor({ hitZoneHeight: -5, barThickness: 'x', handleSize: 999 });
    expect(vars['--igrc-hit-zone']).toBe(`${HIT_ZONE_MIN}px`);
    expect(vars['--igrc-bar-idle']).toBe(`${DEFAULTS.barThickness}px`);
    expect(vars['--igrc-handle']).toBe(`${HANDLE_MAX}px`);
  });

  it('每一個變數都有值，不會漏掉造成沒有樣式', () => {
    const vars = cssVarsFor({});
    for (const [name, value] of Object.entries(vars)) {
      expect(value, name).toBeTruthy();
    }
    expect(Object.keys(vars).length).toBe(5);
  });
});

describe('createSettingsStore', () => {
  it('storage 是空的時候載入預設值', async () => {
    const store = createSettingsStore(fakeArea());
    expect(await store.load()).toEqual(DEFAULTS);
  });

  it('載入已儲存的設定', async () => {
    const saved = { hitZoneHeight: 20, showLabel: false, barThickness: 6, handleSize: 16 };
    const store = createSettingsStore(fakeArea({ [STORAGE_KEY]: saved }));
    expect(await store.load()).toEqual(saved);
  });

  it('載入時會清理壞掉的資料', async () => {
    const area = fakeArea({ [STORAGE_KEY]: { hitZoneHeight: 9999, barThickness: -3 } });
    const store = createSettingsStore(area);
    expect(await store.load()).toEqual({
      ...DEFAULTS,
      hitZoneHeight: HIT_ZONE_MAX,
      barThickness: THICKNESS_MIN,
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
    const saved = await store.save({ hitZoneHeight: 100, showLabel: false, handleSize: 1 });
    expect(saved).toEqual({
      ...DEFAULTS,
      hitZoneHeight: HIT_ZONE_MAX,
      showLabel: false,
      handleSize: HANDLE_MIN,
    });
    expect(area._raw()[STORAGE_KEY]).toEqual(saved);
  });

  it('儲存拋錯時不會讓呼叫端炸掉', async () => {
    const broken = { get: async () => ({}), set: () => Promise.reject(new Error('配額用完')) };
    const store = createSettingsStore(broken);
    await expect(store.save({ barThickness: 5 })).resolves.toMatchObject({ barThickness: 5 });
  });

  it('設定變更時通知監聽者', async () => {
    const area = fakeArea();
    const store = createSettingsStore(area);
    const seen = vi.fn();
    store.watch(seen);
    await store.save({ barThickness: 7 });
    expect(seen).toHaveBeenCalledWith(expect.objectContaining({ barThickness: 7 }));
  });

  it('其他鍵的變更不會觸發通知', async () => {
    const area = fakeArea();
    const store = createSettingsStore(area);
    const seen = vi.fn();
    store.watch(seen);
    await area.set({ 其他東西: 1 });
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
    await store.save({ barThickness: 4 });
    expect(seen).not.toHaveBeenCalled();
  });

  it('沒有 storage 可用時整個 store 退化成預設值且不拋錯', async () => {
    const store = createSettingsStore(null);
    expect(await store.load()).toEqual(DEFAULTS);
    expect(await store.save({ barThickness: 5 })).toMatchObject({ barThickness: 5 });
    expect(() => store.watch(() => {})()).not.toThrow();
  });
});
