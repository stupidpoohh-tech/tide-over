/**
 * dist/를 배포와 같은 헤더로 서빙한다.
 *
 * vite preview 대신 이걸 쓰는 이유: 실제 배포에는 public/_headers(Cloudflare)와
 * vercel.json(Vercel)의 CSP가 붙는데, 그게 앱을 깨뜨리지 않는지는 같은 헤더를
 * 얹어봐야만 알 수 있다. 여기 CSP는 그 두 파일과 같은 내용이어야 한다.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

export const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
  "font-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'none'; " +
  "frame-ancestors 'none'; object-src 'none'";

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

export function serve(root = 'dist', port = 4178) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let path = normalize(decodeURIComponent(url.pathname));
    if (path.endsWith('/')) path += 'index.html';
    const file = join(root, path);

    if (!existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end('not found');
      return;
    }

    res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader(
      'Cache-Control',
      path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    );
    res.writeHead(200).end(readFileSync(file));
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}
