# Releasing the extension

## Prepare the release

1. Open a PR from `master` that bumps `package.json` and `package-lock.json`.
   For a bug-fix release, use `npm version patch --no-git-tag-version`.
2. Draft release notes in the PR. Describe user-visible changes and credit
   contributors. Merge the PR once CI passes.

## Build and verify the packages

Use a clean checkout of the merged release commit and the Node version pinned
in `.nvmrc`.

```bash
nvm use
npm ci
npm test
npm run zip
npm run zip:firefox
```

The archives are in `.output/`.

| Destination | Archive suffix |
| --- | --- |
| Chrome Web Store and Microsoft Edge Add-ons | `-chrome.zip` |
| Firefox Add-ons (AMO), extension package | `-firefox.zip` |
| Firefox Add-ons (AMO), source package for review | `-sources.zip` |

Check that both extension archives contain the intended manifest version.
Confirm that the Firefox source archive includes `.nvmrc` and
`package-lock.json`.

Load the unpacked builds using the [README installation steps](../README.md#install).
On Instagram, verify that the extension loads, seeking works on a Reel, and
the appearance settings apply. Also test the behavior changed by the release
and record the browser and page tested.

## Tag and publish

1. Create and push an annotated `v<version>` tag on the exact commit you built.
2. Submit those archives to the stores. For AMO, include the source archive and
   the build instructions in the [README](../README.md#reproducing-a-released-build).
3. Create a GitHub Release from the tag with the release notes from the PR.
   Check which store listings are live and indicate any that are still in review.
