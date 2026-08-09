import { defineConfig } from 'wxt';

// manifest 的 name 與 description 走 i18n，實際文字在 public/_locales/ 底下。
export default defineConfig({
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    // storage 用來存使用者的外觀設定；沒有其他權限。
    permissions: ['storage'],
  },
});
