// Renames the extension everywhere the name appears.
//
//   node tools/rename.mjs "New Name"
//   node tools/rename.mjs --check        list occurrences without changing anything
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

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

/** The English extName is the source of truth for the current name. */
function currentName() {
  const messages = JSON.parse(readFileSync('public/_locales/en/messages.json', 'utf8'));
  return messages.extName.message;
}

/** Slug used for package.json name and the zip filename. */
function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const arg = process.argv[2];
const from = currentName();

if (!arg || arg === '--check') {
  console.log(`current name: ${from}\n`);
  let total = 0;
  for (const file of TARGETS) {
    if (!existsSync(file)) {
      console.log(`   -  ${file} (not present, skipped)`);
      continue;
    }
    const hits = readFileSync(file, 'utf8').split(from).length - 1;
    total += hits;
    console.log(`  ${String(hits).padStart(2)}  ${file}`);
  }
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  console.log(`\npackage.json name (drives the zip filename): ${pkg.name}`);
  console.log(`${total} occurrences. To rename: node tools/rename.mjs "New Name"`);
  process.exit(0);
}

const to = arg.trim();
if (!to) {
  console.error('The new name cannot be empty.');
  process.exit(1);
}
if (to === from) {
  console.log(`Already named "${to}". Nothing to do.`);
  process.exit(0);
}

let changed = 0;
for (const file of TARGETS) {
  if (!existsSync(file)) continue;
  const before = readFileSync(file, 'utf8');
  const after = before.split(from).join(to);
  if (before !== after) {
    writeFileSync(file, after);
    const hits = before.split(from).length - 1;
    changed += hits;
    console.log(`  ${String(hits).padStart(2)}  ${file}`);
  }
}

const pkgPath = 'package.json';
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const slug = toSlug(to);
if (pkg.name !== slug) {
  pkg.name = slug;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`   1  ${pkgPath} (name -> ${slug}, zip becomes ${slug}-${pkg.version}-chrome.zip)`);
}

console.log(`\n"${from}" -> "${to}", ${changed} occurrences changed.`);
console.log('Now run: npm run build');
