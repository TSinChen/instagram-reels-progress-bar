# Project instructions

- Base video selection and overlay placement on standard `<video>` elements
  and visible geometry. Avoid Instagram-generated class names. Keep the
  overlay in its own Shadow DOM host.
- Keep browser extension APIs in `entrypoints/`. Pass the dependencies needed
  by `lib/` explicitly so its logic can be tested independently.
- Preserve the guarantees in [the privacy policy](docs/privacy.md). Discuss
  changes to permissions, host access, or network behavior with the maintainer
  before implementing them.
- For changes to video selection, layout, or seeking, exercise the relevant
  login-free fixtures in the [development guide](README.md#development). Report
  which Instagram views you tested live, if any. The fixtures stub media
  playback. Testing Instagram's player requires a live check.
