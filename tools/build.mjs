// 把 src/content 底下的 ES modules 攤平成單一 classic script，輸出到 dist/content.js。
// 只用 Node 內建模組，沒有 bundler 依賴。
//
// 為什麼需要這一步：MV3 的 content script 是 classic script，不支援 import。
// 常見替代做法是用 import(chrome.runtime.getURL(...)) 動態載入，但那條路我們無法在
// 這台機器上自動驗證（Chrome 151 已移除 --load-extension，跑不了自動化的擴充功能測試）。
// 攤平成一支 classic script 之後就沒有任何動態載入環節，也不需要 web_accessible_resources，
// 失敗模式直接消失。src/ 仍然是 ES modules，單元測試照樣直接測它。
//
// 執行：node tools/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';

const ENTRY = 'src/content/main.js';
const OUTPUT = 'dist/content.js';

/** 抓出一個檔案裡所有相對路徑的 import。支援跨行的 import 敘述。 */
function findImports(source) {
  const pattern = /import\s+[^;]*?from\s+['"](\.[^'"]+)['"]\s*;/g;
  return [...source.matchAll(pattern)].map((m) => m[1]);
}

/** 深度優先走訪，產生相依在前的檔案順序。 */
function collectModules(entry) {
  const ordered = [];
  const visited = new Set();
  const visiting = new Set();

  function visit(file) {
    const key = resolve(file);
    if (visited.has(key)) return;
    if (visiting.has(key)) {
      throw new Error(`偵測到循環相依：${relative(process.cwd(), key)}`);
    }
    visiting.add(key);

    const source = readFileSync(file, 'utf8');
    for (const spec of findImports(source)) {
      visit(resolve(dirname(file), spec));
    }

    visiting.delete(key);
    visited.add(key);
    ordered.push({ file, source });
  }

  visit(entry);
  return ordered;
}

/** 拿掉 import 敘述與 export 關鍵字，只留下宣告本身。 */
function stripModuleSyntax(source) {
  return source
    .replace(/import\s+[^;]*?from\s+['"][^'"]+['"]\s*;\s*\n?/g, '')
    .replace(/^export\s+/gm, '');
}

/**
 * 攤平之後所有模組共用同一個作用域，重名的頂層宣告會互相覆蓋。
 * 與其讓它在執行期悄悄壞掉，不如在這裡直接失敗。
 */
function assertNoDuplicateDeclarations(modules) {
  const seen = new Map();
  const duplicates = [];

  for (const { file, body } of modules) {
    const pattern = /^(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/gm;
    for (const match of body.matchAll(pattern)) {
      const name = match[1];
      if (seen.has(name)) {
        duplicates.push(`${name}（${relative(process.cwd(), seen.get(name))} 與 ${relative(process.cwd(), file)}）`);
      } else {
        seen.set(name, file);
      }
    }
  }

  if (duplicates.length) {
    throw new Error(`頂層宣告重名，攤平後會互相覆蓋：\n  ${duplicates.join('\n  ')}`);
  }
}

const modules = collectModules(ENTRY).map((m) => ({
  file: m.file,
  body: stripModuleSyntax(m.source).trim(),
}));

assertNoDuplicateDeclarations(modules);

const banner = `// 由 tools/build.mjs 自動產生，請勿直接編輯。
// 原始碼在 src/content/，改完請重新執行：node tools/build.mjs
`;

const bundle = [
  banner,
  '(() => {',
  "'use strict';",
  '',
  ...modules.map((m) => `// ── ${relative(process.cwd(), m.file).replace(/\\/g, '/')} ${'─'.repeat(Math.max(0, 60 - m.file.length))}\n${m.body}\n`),
  '// ── 啟動 ──',
  'init();',
  '})();',
  '',
].join('\n');

mkdirSync('dist', { recursive: true });
writeFileSync(OUTPUT, bundle);

console.log(`${OUTPUT} 已產生（${modules.length} 個模組，${bundle.length} bytes）`);
console.log('模組順序：');
modules.forEach((m, i) => console.log(`  ${i + 1}. ${relative(process.cwd(), m.file).replace(/\\/g, '/')}`));
