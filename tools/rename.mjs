// 一次改掉所有出現擴充功能名稱的地方。
//
// 名稱本來應該只存在於 _locales 的 extName，但它無可避免會出現在
// README 標題、商店文案、隱私權政策這些人看的文字裡。與其每次改名
// 都手動找六個檔案（而且一定會漏），不如把它變成一個指令。
//
// 用法：
//   node tools/rename.mjs "New Name"
//   node tools/rename.mjs --check        只列出目前名稱出現在哪裡，不修改
import { readFileSync, writeFileSync } from 'node:fs';

const TARGETS = [
  'public/_locales/en/messages.json',
  'public/_locales/zh_TW/messages.json',
  'entrypoints/popup/index.html',
  'README.md',
  'docs/store/STORE.md',
  'docs/privacy.md',
  'docs/index.md',
  'docs/_config.yml',
];

/** 目前的顯示名稱以 en 語系的 extName 為準。 */
function currentName() {
  const messages = JSON.parse(readFileSync('public/_locales/en/messages.json', 'utf8'));
  return messages.extName.message;
}

/** 名稱轉成 package.json 與 zip 檔名用的 slug。 */
function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const arg = process.argv[2];
const from = currentName();

if (!arg || arg === '--check') {
  console.log(`目前名稱：${from}\n`);
  let total = 0;
  for (const file of TARGETS) {
    const hits = readFileSync(file, 'utf8').split(from).length - 1;
    total += hits;
    console.log(`  ${String(hits).padStart(2)}  ${file}`);
  }
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  console.log(`\npackage.json name（決定 zip 檔名）：${pkg.name}`);
  console.log(`共 ${total} 處。改名請執行：node tools/rename.mjs "新名稱"`);
  process.exit(0);
}

const to = arg.trim();
if (!to) {
  console.error('新名稱不能是空的');
  process.exit(1);
}
if (to === from) {
  console.log(`名稱已經是「${to}」，沒有東西要改。`);
  process.exit(0);
}

let changed = 0;
for (const file of TARGETS) {
  const before = readFileSync(file, 'utf8');
  const after = before.split(from).join(to);
  if (before !== after) {
    writeFileSync(file, after);
    const hits = before.split(from).length - 1;
    changed += hits;
    console.log(`  ${String(hits).padStart(2)} 處  ${file}`);
  }
}

const pkgPath = 'package.json';
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const slug = toSlug(to);
if (pkg.name !== slug) {
  pkg.name = slug;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`   1 處  ${pkgPath}（name → ${slug}，zip 會變成 ${slug}-${pkg.version}-chrome.zip）`);
}

console.log(`\n「${from}」→「${to}」，共改 ${changed} 處。`);
console.log('接著跑：npm run build');
