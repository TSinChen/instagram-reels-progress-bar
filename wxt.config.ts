import { defineConfig } from 'wxt';

// The manifest name and description are i18n keys; the text lives in public/_locales/.
export default defineConfig({
  // The sources zip goes to AMO reviewers. STORE.md is local-only submission notes,
  // and the 30 listing screenshots are 7 MB that no one needs to build the extension.
  zip: {
    excludeSources: ['docs/store/**'],
  },
  manifest: ({ browser }) => ({
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    // Holds the appearance settings. There are no other permissions.
    permissions: ['storage'],
    // Firefox refuses storage.sync unless the add-on has an explicit ID, and AMO
    // pins a listing to whatever ID the first upload carries, so this cannot change later.
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'instagram-reels-progress-bar@tsinchen.github.io',
          strict_min_version: '109.0',
          // Firefox now makes every add-on state this outright. The extension stores the
          // appearance settings and nothing else, so the honest answer is none.
          data_collection_permissions: { required: ['none'] },
        },
      },
    }),
  }),
});
