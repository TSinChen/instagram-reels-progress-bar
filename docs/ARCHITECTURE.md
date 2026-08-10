# Architecture

## The constraint that shapes everything

Instagram's markup is compiled. Class names are hashes (`x1n2onr6`), the DOM tree is deep and unstable, and React re-renders replace subtrees without warning. Anything anchored to Instagram's own structure breaks within weeks.

The only stable anchor is the `<video>` element itself, because it is part of the HTML standard rather than part of Instagram. Every positioning decision in this extension follows from that.

## The overlay

The progress bar lives in a Shadow DOM host appended to `document.body`, positioned with `position: fixed` over whichever video is currently being watched. It is realigned every animation frame from the video's `getBoundingClientRect()`.

Nothing is inserted into Instagram's DOM. React can rebuild its entire tree and the overlay is unaffected. Shadow DOM blocks style leakage in both directions; `:host { all: initial }` additionally blocks inherited properties such as Instagram's global font stack.

Two alternatives were rejected:

- **Appending into the video's container.** React removes injected nodes on re-render, containers commonly set `overflow: hidden` which clips the UI, and it means competing with Instagram's z-index stack.
- **One bar per video.** The home feed can hold a dozen videos, which would mean a dozen render loops and a dozen bars on screen.

### Two layers, two sizes

The host is 48px tall with `pointer-events: none`. It is a positioning container and a canvas for the time label, nothing more.

Inside it, a strip flush with the bottom edge — 16px by default, user-adjustable — carries `pointer-events: auto`. That strip is the only region where the extension intercepts clicks that would otherwise reach Instagram.

Splitting the two means the label has room to render without being clipped, while the intercepted area stays as small as the interaction allows.

### Rounded corners

A fixed-position element on `body` is not clipped by an ancestor's `overflow: hidden`, so over a rounded video the bar's ends would protrude past the curve. `corner-radius.js` walks up at most five levels to find the element that actually clips the video — one with both an overflow clip and a corner radius — and the host applies those radii itself. Each corner is taken only when that ancestor's edge coincides with the video's: a container wider than the video, such as a lightbox with a comment column beside it, rounds its own corner somewhere else, and copying that radius would draw a curve where the video has a square edge.

The clip goes on the host rather than on the bar. A 48px host renders the full curve; CSS scales radii down when they exceed the box, so applying a 22px radius to a 3px-tall bar would draw the wrong arc. When there is no radius the host leaves `overflow` visible, otherwise the handle would be cut in half at either end of the track.

## Choosing the active video

One rule covers every page. There are no per-page special cases.

1. Collect every `<video>` in the document.
2. Discard anything narrower or shorter than 80px — thumbnails and hidden preload elements.
3. Compute each video's intersection with the viewport, and that intersection as a fraction of the element's own area.
4. Discard anything less than 50% visible.
5. Take the largest visible area. When the top two are within 5% of each other, prefer the one that is playing.

This falls out correctly on the Reels page (a swipe brings the next video into view), the home feed (whichever video is centred wins), the post lightbox (it dominates the viewport), and Explore.

## Two loops

**Selection runs at low frequency.** A 200ms interval, a captured `scroll` listener, and a `MutationObserver` on `body` all do the same thing: mark that the active video should be re-evaluated. The observer is debounced by 150ms so that a burst of React re-renders costs one evaluation rather than hundreds. SPA navigation needs no route handling — the DOM changes, the observer fires, the rule re-runs.

**Rendering runs every frame,** and only while a video is active. It aligns the host, reads playback state, and paints. The loop stops entirely when the tab is hidden.

Corner radii are recomputed only when the video's geometry changes; `getComputedStyle` every frame would be wasteful.

## Settings

Adjustable values reach the bar as CSS custom properties set on the host. Custom properties inherit through the shadow boundary, so changing one repaints the whole bar without rebuilding any DOM — adjusting a setting mid-drag does not interrupt the drag.

Settings live in `chrome.storage.sync` and are watched, so a change in the popup applies to every open Instagram tab immediately.

`normalizeSettings` treats stored data as untrusted. It may come from an older version or have been edited by hand, so every field is clamped to a legal range and unknown fields are dropped.

Colour is fixed. A dark bar over dark footage is invisible, and offering the choice mostly produces installs that appear not to work.

## Seeking

`SeekController` translates pointer events into writes to `video.currentTime`. It owns no UI; it exposes interaction state that the render loop reads.

Writes are throttled to one per animation frame, because a drag produces pointer events far faster than the player can act on them. `pointerup` bypasses the throttle so the release lands exactly where the pointer is.

The bar tracks two separate times. `playedTime` drives the fill and the handle; `labelTime` drives the text. While hovering without pressing, the fill stays at the real playback position and only the label follows the pointer, previewing where a click would land.

Pointer capture is taken on `pointerdown` so a drag continues to track after the pointer leaves the video, or the window.

## Module boundaries

`lib/` has no dependency on any Chrome API. The storage area is injected by the entrypoint, which is what makes the whole layer testable under plain vitest.

| Module | Responsibility |
|---|---|
| `config.js` | Constants that are not user-adjustable |
| `geometry.js` | Visible area, pointer position to ratio to seconds. Pure. |
| `time-format.js` | Seconds to `M:SS`. Pure. |
| `media-state.js` | Buffered end, stall detection. Pure. |
| `corner-radius.js` | Locate the element that clips the video. Pure given style and rect getters. |
| `settings.js` | Defaults, normalisation, CSS variable mapping, storage wrapper |
| `video-tracker.js` | Select the active video and report changes |
| `progress-bar.js` | Shadow DOM UI. Draws only; knows nothing about video. |
| `styles.js` | The shadow root's stylesheet |
| `seek-controller.js` | Pointer events to seeks |
| `main.js` | Lifecycle wiring and the render loop |

## Testing

Pure logic is covered directly by vitest. The modules that matter most for correctness — the selection rule, the seek arithmetic, settings normalisation, buffered and stall detection — take plain objects, so their tests need no DOM and no media.

Layout, transitions and pointer interaction are verified in a real browser against fixtures under `test/fixtures/`. Those pages use real `<video>` elements with their media properties stubbed, which keeps results deterministic without shipping a video file.

`npm run shots` drives the same fixtures headlessly to produce the store screenshots, and asserts on the result before writing — the bar must be in its hover state, aligned to the video, clipped to the video's corners, and the output must be 1280×800.

What none of this covers is Instagram's real DOM and how its MSE player responds to a `currentTime` write. That is verified by hand.

## Known trade-offs

**The bottom strip belongs to the extension.** Clicks there do not reach Instagram. Any scrubber has this cost. The height is adjustable down to 8px.

**Seeking into unbuffered video may stall.** Instagram streams over MSE and decides for itself whether to fetch a segment that has not been requested. The bar draws the buffered range in a lighter shade so the safe region is visible in advance, and shows a spinner on the handle rather than failing silently.

**Live video has no bar.** Its `duration` is `Infinity`; there is no progress to show.

**The bar stays visible behind Instagram's own dialogs.** Nothing in the selection rule knows that a modal has been opened in front of the video, so the idle hairline keeps drawing and a click landing in the hover strip is swallowed. The obvious remedy — hit-testing the point under the bar — is worse than the problem: Instagram keeps its own transparent layers over the video, so that test would hide the bar during ordinary playback. A safer version would look for `[aria-modal="true"]` and exclude any dialog that contains the video, since the post lightbox is itself a dialog with the video inside it.
