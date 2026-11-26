# Releasing the extension

## Prepare the release

1. Check the latest release tag and the published version on each store. Pick
   a version higher than all of them.
2. Open a PR from `master` that bumps `package.json` and `package-lock.json`.
   For a bug-fix release, use `npm version patch --no-git-tag-version`.
3. Draft release notes in the PR. Summarize what changed for users, link the
   relevant PRs, and credit contributors. Merge the PR once CI passes.

## Build and verify the packages

Use a clean checkout of the merged release commit. Install the Node version
pinned in `.nvmrc`, or select it with `nvm use` if you use nvm.

```bash
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

Check that both extension archives contain the intended manifest version and
that the Firefox source archive includes `.nvmrc` and `package-lock.json`.

Load the unpacked builds using the [README installation steps](../README.md#install).
In Edge, use **Load unpacked** on `edge://extensions` with the Chrome build.
For each browser receiving the update, check that the extension loads on
Instagram, seeking works on a Reel, and popup settings apply. Also test the
behavior changed by the release and record the browser and page tested.

## Submit to stores and publish

1. From the verified checkout, tag and push the exact commit you built.

   ```bash
   version=$(node -p 'require("./package.json").version')
   git tag -a "v$version" -m "Version $version" && git push origin "refs/tags/v$version"
   ```

2. Create a draft GitHub Release for the tag. Copy the release notes from the
   PR and mention contributors by GitHub handle.
3. Submit the verified archives to the stores. For AMO, include the source
   archive and the [README build instructions](../README.md#reproducing-a-released-build).
4. Confirm the new version is live on every store receiving the update.
5. Add the live store links to the draft and publish the GitHub Release.

If a submitted package needs a code change, prepare a new version through
the same PR and verification steps. Keep the existing tag on the original commit.
