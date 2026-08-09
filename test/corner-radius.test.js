import { describe, it, expect } from 'vitest';
import { bottomRadiiFor } from '../lib/corner-radius.js';

/**
 * 做一棵假的元素樹。每個節點帶自己的 style，最後一個是最外層。
 * chain[0] 是影片本身。
 */
function tree(...styles) {
  const nodes = styles.map((style) => ({ style, parentElement: null }));
  for (let i = 0; i < nodes.length - 1; i += 1) {
    nodes[i].parentElement = nodes[i + 1];
  }
  return {
    video: nodes[0],
    getStyle: (el) => ({
      overflow: 'visible',
      overflowX: 'visible',
      overflowY: 'visible',
      borderBottomLeftRadius: '0px',
      borderBottomRightRadius: '0px',
      ...el.style,
    }),
  };
}

const NONE = {};

describe('bottomRadiiFor', () => {
  it('沒有任何圓角時回傳 0', () => {
    const { video, getStyle } = tree(NONE, NONE, NONE);
    expect(bottomRadiiFor(video, getStyle)).toEqual({ left: 0, right: 0 });
  });

  it('影片自己有圓角就直接用', () => {
    const { video, getStyle } = tree({ borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' });
    expect(bottomRadiiFor(video, getStyle)).toEqual({ left: 8, right: 8 });
  });

  it('圓角在外層容器上時往上找得到', () => {
    const { video, getStyle } = tree(
      NONE,
      { overflow: 'hidden', borderBottomLeftRadius: '22px', borderBottomRightRadius: '22px' },
    );
    expect(bottomRadiiFor(video, getStyle)).toEqual({ left: 22, right: 22 });
  });

  it('外層有圓角但不裁切的話不算數', () => {
    // 沒有 overflow: hidden 就不會把影片切圓，進度條也不該自己裁
    const { video, getStyle } = tree(
      NONE,
      { borderBottomLeftRadius: '22px', borderBottomRightRadius: '22px' },
    );
    expect(bottomRadiiFor(video, getStyle)).toEqual({ left: 0, right: 0 });
  });

  it('外層有裁切但沒圓角就繼續往上找', () => {
    const { video, getStyle } = tree(
      NONE,
      { overflow: 'hidden' },
      { overflow: 'hidden', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' },
    );
    expect(bottomRadiiFor(video, getStyle)).toEqual({ left: 12, right: 12 });
  });

  it('只有 overflowY 是 hidden 也算裁切', () => {
    const { video, getStyle } = tree(
      NONE,
      { overflowY: 'hidden', borderBottomLeftRadius: '6px', borderBottomRightRadius: '6px' },
    );
    expect(bottomRadiiFor(video, getStyle)).toEqual({ left: 6, right: 6 });
  });

  it('overflow: clip 也算裁切', () => {
    const { video, getStyle } = tree(
      NONE,
      { overflow: 'clip', borderBottomLeftRadius: '10px', borderBottomRightRadius: '10px' },
    );
    expect(bottomRadiiFor(video, getStyle)).toEqual({ left: 10, right: 10 });
  });

  it('左右半徑不同時分別回傳', () => {
    const { video, getStyle } = tree(
      NONE,
      { overflow: 'hidden', borderBottomLeftRadius: '4px', borderBottomRightRadius: '16px' },
    );
    expect(bottomRadiiFor(video, getStyle)).toEqual({ left: 4, right: 16 });
  });

  it('百分比半徑當作沒有，硬套會畫成橢圓', () => {
    const { video, getStyle } = tree(
      NONE,
      { overflow: 'hidden', borderBottomLeftRadius: '50%', borderBottomRightRadius: '50%' },
    );
    expect(bottomRadiiFor(video, getStyle)).toEqual({ left: 0, right: 0 });
  });

  it('超過層數上限就放棄，不在深層 DOM 裡白繞', () => {
    const { video, getStyle } = tree(
      NONE, NONE, NONE, NONE, NONE, NONE, NONE,
      { overflow: 'hidden', borderBottomLeftRadius: '22px', borderBottomRightRadius: '22px' },
    );
    expect(bottomRadiiFor(video, getStyle, 3)).toEqual({ left: 0, right: 0 });
  });

  it('層數上限之內找得到', () => {
    const { video, getStyle } = tree(
      NONE, NONE, NONE,
      { overflow: 'hidden', borderBottomLeftRadius: '22px', borderBottomRightRadius: '22px' },
    );
    expect(bottomRadiiFor(video, getStyle, 5)).toEqual({ left: 22, right: 22 });
  });

  it('沒有影片時不拋錯', () => {
    expect(bottomRadiiFor(null, () => ({}))).toEqual({ left: 0, right: 0 });
  });

  it('走到最上層沒有 parentElement 時停下來', () => {
    const { video, getStyle } = tree(NONE);
    expect(() => bottomRadiiFor(video, getStyle)).not.toThrow();
    expect(bottomRadiiFor(video, getStyle)).toEqual({ left: 0, right: 0 });
  });
});
