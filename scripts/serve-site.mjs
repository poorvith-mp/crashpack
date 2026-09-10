import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('site-dist');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.md': 'text/plain', '.json': 'application/json' };
const headers = Object.fromEntries((await readFile(`${root}/_headers`, 'utf8')).split('\n').filter(line => /^  \S/.test(line)).map(line => { const at = line.indexOf(':'); return [line.slice(0, at).trim(), line.slice(at + 1).trim()]; }));
createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, 'http://localhost'); decodeURIComponent(url.pathname); }
  catch { res.writeHead(400).end(); return; }
  const pathname = decodeURIComponent(url.pathname);
  const testMode = process.env.CRASHPACK_BROWSER_TEST === '1';
  if (testMode && pathname === '/__browser-test.js') {
    res.writeHead(200, { ...headers, 'Content-Type': 'text/javascript' });
    res.end(await readFile('scripts/browser-test.js')); return;
  }
  const name = pathname === '/' ? 'index.html' : pathname.slice(1) + (extname(pathname) ? '' : '.html');
  const file = resolve(root, name);
  if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try {
    let content = await readFile(file);
    if (testMode && extname(file) === '.html') content = Buffer.from(content.toString().replace('<head>', '<head><script src="/__browser-test.js"></script>'));
    res.writeHead(200, { ...headers, 'Content-Type': mime[extname(file)] || 'application/octet-stream' }); res.end(content);
  }
  catch { res.writeHead(404, { ...headers, 'Content-Type': 'text/html' }); res.end(await readFile(`${root}/404.html`)); }
}).listen(4173, '127.0.0.1', () => console.log('Crashpack preview: http://127.0.0.1:4173'));
