# Contributing

Small fixes and documentation updates are welcome as pull requests. For a new feature or a larger change, open a [Change proposal](https://github.com/TSinChen/instagram-reels-progress-bar/issues/new?template=change_proposal.yml) first so we can discuss the approach.

## Set up and verify your change

Fork the repository and create a branch from `master`. Use the Node version in [`.nvmrc`](.nvmrc). If you use nvm, run `nvm install` in the project directory.

Run the same checks GitHub Actions runs on pull requests.

```bash
npm ci
npm test
npm run build
npm run build:firefox
```

See [Development](README.md#development) for hot reload and browser fixtures you can run without an Instagram login. The [architecture notes](docs/ARCHITECTURE.md) explain how the extension selects videos and positions the progress bar.

When fixing a bug, add a regression test if the behavior can be reproduced in the existing test suite. For changes to video selection, seeking, or layout, also try the affected view on Instagram and include the browser and page type you tested. The fixtures stub media playback, so checking a real Reel or post can catch differences in Instagram's layout or player behavior.

## Open a pull request

- Target `master` and keep the change focused.
- Explain what changed and why. For bugs, include the reproduction steps and expected behavior.
- Link the related issue, if there is one, and describe how you verified the change.
