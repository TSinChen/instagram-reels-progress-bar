// 驗證頁與截圖用的靜態伺服器。只用 Node 內建模組。
//
// 直接執行會固定開在 8123：
//   node tools/serve.mjs
// 也可以被 import，讓截圖腳本自己起一台：
//   import { createStaticServer } from './serve.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEFAULT_PORT = 8123;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/** 開一台以 root 為根目錄的靜態伺服器。回傳 Promise<http.Server>。 */
export function createStaticServer(port = DEFAULT_PORT, root = process.cwd()) {
  const server = createServer(async (req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const safePath = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
    const filePath = join(root, safePath);

    try {
      const body = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': TYPES[extname(filePath)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404');
    }
  });

  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

// 只有被直接執行時才自己啟動
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await createStaticServer(DEFAULT_PORT);
  console.log(`http://localhost:${DEFAULT_PORT}/test/fixtures/mock-instagram.html`);
}
