import { describe, it, expect } from 'vitest';
import { bottomRadiiFor } from '../lib/corner-radius.js';

/** Builds a chain of elements, innermost first; the first is the video. */
const SAME_BOX = { left: 0, right: 400, bottom: 600 };

/**
 * Each entry is a style object, optionally with a `rect` describing that element's box.
 * Elements default to sharing the video's box, so a test only states a rect when the
 * point is that the ancestor is larger than the video.
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
    getRect: (el) => ({ ...SAME_BOX, ...(el.style.rect || {}) }),
  };
}

const NONE = {};

describe('bottomRadiiFor', () => {
  it('returns zero when nothing is rounded', () => {
    const { video, getStyle, getRect } = tree(NONE, NONE, NONE);
    expect(bottomRadiiFor(video, getStyle, 5, getRect)).toEqual({ left: 0, right: 0 });
  });

  it('uses the radius on the video itself', () => {
    const { video, getStyle, getRect } = tree({ borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' });
    expect(bottomRadiiFor(video, getStyle, 5, getRect)).toEqual({ left: 8, right: 8 });
  });

  it('finds a radius on an ancestor', () => {
    const { video, getStyle, getRect } = tree(
      NONE,
      { overflow: 'hidden', borderBottomLeftRadius: '22px', borderBottomRightRadius: '22px' },
    );
    expect(bottomRadiiFor(video, getStyle, 5, getRect)).toEqual({ left: 22, right: 22 });
  });

  it('ignores an ancestor that rounds but does not clip', () => {
    // Without a clip the video is not rounded, so the bar should not round either
    const { video, getStyle, getRect } = tree(
      NONE,
      { borderBottomLeftRadius: '22px', borderBottomRightRadius: '22px' },
    );
    expect(bottomRadiiFor(video, getStyle, 5, getRect)).toEqual({ left: 0, right: 0 });
  });

  it('keeps walking past an ancestor that clips without rounding', () => {
    const { video, getStyle, getRect } = tree(
      NONE,
      { overflow: 'hidden' },
      { overflow: 'hidden', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' },
    );
    expect(bottomRadiiFor(video, getStyle, 5, getRect)).toEqual({ left: 12, right: 12 });
  });

  it('treats overflowY: hidden as clipping', () => {
    const { video, getStyle, getRect } = tree(
      NONE,
      { overflowY: 'hidden', borderBottomLeftRadius: '6px', borderBottomRightRadius: '6px' },
    );
    expect(bottomRadiiFor(video, getStyle, 5, getRect)).toEqual({ left: 6, right: 6 });
  });

  it('treats overflow: clip as clipping', () => {
    const { video, getStyle, getRect } = tree(
      NONE,
      { overflow: 'clip', borderBottomLeftRadius: '10px', borderBottomRightRadius: '10px' },
    );
    expect(bottomRadiiFor(video, getStyle, 5, getRect)).toEqual({ left: 10, right: 10 });
  });

  it('returns left and right radii independently', () => {
    const { video, getStyle, getRect } = tree(
      NONE,
      { overflow: 'hidden', borderBottomLeftRadius: '4px', borderBottomRightRadius: '16px' },
    );
    expect(bottomRadiiFor(video, getStyle, 5, getRect)).toEqual({ left: 4, right: 16 });
  });

  it('ignores percentage radii, which describe an ellipse', () => {
    const { video, getStyle, getRect } = tree(
      NONE,
      { overflow: 'hidden', borderBottomLeftRadius: '50%', borderBottomRightRadius: '50%' },
    );
    expect(bottomRadiiFor(video, getStyle, 5, getRect)).toEqual({ left: 0, right: 0 });
  });

  it('gives up past the depth limit rather than walking a deep tree', () => {
    const { video, getStyle, getRect } = tree(
      NONE, NONE, NONE, NONE, NONE, NONE, NONE,
      { overflow: 'hidden', borderBottomLeftRadius: '22px', borderBottomRightRadius: '22px' },
    );
    expect(bottomRadiiFor(video, getStyle, 3, getRect)).toEqual({ left: 0, right: 0 });
  });

  it('finds a radius within the depth limit', () => {
    const { video, getStyle, getRect } = tree(
      NONE, NONE, NONE,
      { overflow: 'hidden', borderBottomLeftRadius: '22px', borderBottomRightRadius: '22px' },
    );
    expect(bottomRadiiFor(video, getStyle, 5, getRect)).toEqual({ left: 22, right: 22 });
  });

  it('takes only the corner whose edge lines up with the video', () => {
    // A lightbox with a comment column beside the video rounds its own right corner
    // somewhere else entirely
    const { video, getStyle, getRect } = tree(
      NONE,
      {
        overflow: 'hidden',
        borderBottomLeftRadius: '8px',
        borderBottomRightRadius: '8px',
        rect: { left: 0, right: 740, bottom: 600 },
      },
    );
    expect(bottomRadiiFor(video, getStyle, 5, getRect)).toEqual({ left: 8, right: 0 });
  });

  it('ignores a clipping ancestor whose bottom edge is elsewhere', () => {
    const { video, getStyle, getRect } = tree(
      NONE,
      {
        overflow: 'hidden',
        borderBottomLeftRadius: '8px',
        borderBottomRightRadius: '8px',
        rect: { left: 0, right: 400, bottom: 900 },
      },
    );
    expect(bottomRadiiFor(video, getStyle, 5, getRect)).toEqual({ left: 0, right: 0 });
  });

  it('keeps walking when a rounded ancestor does not line up at all', () => {
    const { video, getStyle, getRect } = tree(
      NONE,
      {
        overflow: 'hidden',
        borderBottomLeftRadius: '8px',
        borderBottomRightRadius: '8px',
        rect: { left: -40, right: 900, bottom: 900 },
      },
      { overflow: 'hidden', borderBottomLeftRadius: '14px', borderBottomRightRadius: '14px' },
    );
    expect(bottomRadiiFor(video, getStyle, 5, getRect)).toEqual({ left: 14, right: 14 });
  });

  it('tolerates subpixel differences in edge positions', () => {
    const { video, getStyle, getRect } = tree(
      NONE,
      {
        overflow: 'hidden',
        borderBottomLeftRadius: '8px',
        borderBottomRightRadius: '8px',
        rect: { left: 0.4, right: 399.6, bottom: 600.3 },
      },
    );
    expect(bottomRadiiFor(video, getStyle, 5, getRect)).toEqual({ left: 8, right: 8 });
  });

  it('does not throw without a video', () => {
    expect(bottomRadiiFor(null, () => ({}))).toEqual({ left: 0, right: 0 });
  });

  it('stops at the root when there is no parent', () => {
    const { video, getStyle, getRect } = tree(NONE);
    expect(() => bottomRadiiFor(video, getStyle, 5, getRect)).not.toThrow();
    expect(bottomRadiiFor(video, getStyle, 5, getRect)).toEqual({ left: 0, right: 0 });
  });
});
