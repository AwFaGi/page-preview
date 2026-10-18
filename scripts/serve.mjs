// Простой статический сервер для демо и тестов (в npm-пакет не входит).
//   node scripts/serve.mjs [port]
// Дополнительно:
//   ?delay=<мс>       — задержать ответ (для проверки гонок при смене src)
//   POST /__report    — тестовая страница присылает результаты; сервер печатает их
//                       и завершается, если запущен с флагом --exit-on-report

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 8000);
const exitOnReport = process.argv.includes('--exit-on-report');

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'POST' && url.pathname === '/__report') {
    let body = '';
    for await (const chunk of req) body += chunk;
    res.end('ok');
    console.log(body);
    if (exitOnReport) setTimeout(() => process.exit(0), 50);
    return;
  }

  const delay = Number(url.searchParams.get('delay') ?? 0);
  if (delay > 0) await sleep(Math.min(delay, 10_000));

  let path = normalize(join(root, decodeURIComponent(url.pathname)));
  if (!path.startsWith(root)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
    const body = await readFile(path);
    res.writeHead(200, {
      'content-type': types[extname(path)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
  }
}).listen(port, () => {
  console.log(`http://localhost:${port}/demo/`);
});
