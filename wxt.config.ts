import { defineConfig } from 'wxt';

// The manifest name and description are i18n keys; the text lives in public/_locales/.
export default defineConfig({
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    // Holds the appearance settings. There are no other permissions.
    permissions: ['storage'],
  },
});
