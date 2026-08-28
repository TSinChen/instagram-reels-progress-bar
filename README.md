# Instagram Reels Progress Bar

Instagram's web player has no seek bar. You can't skip ahead, you can't go back to the part you missed, and you can't tell how long a video is. This extension adds the bar that should have been there.

![The progress bar at the bottom of a Reel, showing elapsed time and a drag handle](docs/assets/hero.png)

繁體中文說明在[專案首頁](https://tsinchen.github.io/instagram-reels-progress-bar/)。

## Features

- Drag or click anywhere on the bar to jump to that point
- Current time and total length, shown while you're using the bar
- The buffered range is drawn in a lighter shade, so you can see how far ahead is safe to jump to
- Works on the Reels page, the home feed, post lightboxes and Explore
- Adjustable bar thickness, handle size and hover area; the time label can be switched off
- 14 languages: English, 繁體中文, 简体中文, Español, Português (BR), Bahasa Indonesia, हिन्दी, 日本語, 한국어, Deutsch, Français, Русский, Türkçe, Tiếng Việt

## Install

[**Get it on the Chrome Web Store**](https://chromewebstore.google.com/detail/instagram-reels-progress/jahkjaheehohdaehigjiekbfliegofdo)

Or build it yourself. The build needs Node 24; the exact pinned version is in `.nvmrc`.

```bash
npm ci
npm run build          # Chrome and Edge
npm run build:firefox  # Firefox
```

Open `chrome://extensions`, turn on Developer mode, choose **Load unpacked**, and select **`.output/chrome-mv3`** — not the project root. In Firefox, open `about:debugging`, go to **This Firefox**, choose **Load Temporary Add-on**, and pick any file inside `.output/firefox-mv3`.

For development, `npm run dev` launches a Chrome instance with the extension loaded and reloads it when `lib/` changes.

## Settings

Click the toolbar icon. No code changes needed.

| Setting | Default | Range | Notes |
|---|---|---|---|
| Bar thickness | 3px | 2–8px | Idle height. Doubles on hover. |
| Handle size | 12px | 8–20px | Diameter of the drag handle |
| Hover area height | 16px | 8–32px | The strip at the bottom of the video the bar takes over. Lower it if it covers Instagram's own buttons. |
| Show time label | on | — | Off leaves just the bar |

The time label moves up as the bar gets thicker, so it is never covered.

Colour is fixed to white. A dark bar over dark footage is invisible, and offering the choice mostly produces installs that appear not to work. To change it anyway, edit `COLOR_PLAYED` in `lib/config.js` and rebuild.

## Known limitations

- **The bottom strip of the video belongs to the bar.** Clicks there do not reach Instagram. Any scrubber has this cost; the height is adjustable down to 8px.
- **Seeking into unbuffered video may stall.** Instagram streams over MSE and decides for itself whether to fetch a segment. The bar draws the buffered range in a lighter shade so the safe region is visible in advance, and shows a spinner on the handle rather than failing silently.
- **Live video has no bar.** Its `duration` is `Infinity`; there is no progress to show.

## Development

```bash
npm ci
npm test             # unit tests
npm run test:watch
npm run dev          # WXT dev mode with hot reload
npm run build
npm run build:firefox
npm run zip          # packaged for the Chrome Web Store and Edge Add-ons
npm run zip:firefox  # packaged for AMO, alongside the source archive AMO requires
npm run shots      # regenerate the store screenshots
npm run icons      # regenerate the icons
npm run rename     # change the extension name everywhere at once
```

Fixtures that need no Instagram login:

```bash
node tools/serve.mjs
```

| URL | Purpose |
|---|---|
| `/test/fixtures/mock-instagram.html` | Reels, feed and lightbox layouts plus small thumbnails, loading `lib/` directly |
| `/test/fixtures/mock-instagram-bundle.html` | The same, loading the built output under a strict CSP |
| `/test/fixtures/popup-preview.html?locale=zh_TW` | The settings popup, with the Chrome APIs backed by in-memory stubs |
| `/test/fixtures/store-shot.html?copy=en` | 1280×800 store screenshot layout |
| `/test/fixtures/store-shot-settings.html?copy=en` | The settings screenshot |

Every `<video>` in these pages is a real element with its media properties stubbed, so results are deterministic and no video file is needed.

`npm run shots` drives the last two headlessly and asserts on the result before writing: the bar must be hovered, aligned to the video, clipped to its corners, and the output must be 1280×800. A failure exits non-zero and leaves the existing files untouched.

## Reproducing a released build

The toolchain is pinned: Node 24.14.0 in `.nvmrc`, every dependency version in `package-lock.json`. Nothing is fetched during the build beyond those dependencies, and the extension loads no remote code at run time.

```bash
nvm use          # or install the version named in .nvmrc by hand
npm ci
npm run zip:firefox
```

The unpacked build lands in `.output/firefox-mv3/`, packaged next to it as `.output/instagram-reels-progress-bar-<version>-firefox.zip`.

The output does not depend on which Node you use. Node 24.14.0 and 22.16.0 produce all 23 files of both the Chrome and the Firefox build with identical SHA-256 hashes.

## How it works

The bar is a Shadow DOM overlay on `document.body`, positioned over whichever video is currently being watched. Nothing is inserted into Instagram's DOM, and videos are found by looking for standard `<video>` elements rather than Instagram's own markup — which is why it survives Instagram's redesigns.

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) covers the design in full: how the active video is chosen, why the overlay is split into two layers, how settings reach the bar without rebuilding it, and what the known trade-offs are.

## License

MIT. See [LICENSE](LICENSE).

## Not affiliated with Instagram

An independent project. Not affiliated with, endorsed by, or sponsored by Instagram or Meta.
