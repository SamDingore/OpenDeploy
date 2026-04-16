import * as http from 'node:http';
import { describe, expect, it } from 'vitest';
import { postCaddyLoad } from './caddy-admin-post';

describe('postCaddyLoad', () => {
  it('posts body to HTTP admin URL', async () => {
    const server = http.createServer((req, res) => {
      let buf = '';
      req.on('data', (c) => (buf += c));
      req.on('end', () => {
        expect(req.url).toBe('/load');
        expect(buf).toContain('example.com');
        res.statusCode = 200;
        res.end('ok');
      });
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('no_addr');
    const port = addr.port;
    try {
      const r = await postCaddyLoad({
        adminUrl: `http://127.0.0.1:${port}`,
        body: 'example.com { respond "hi" }',
      });
      expect(r.statusCode).toBe(200);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
    }
  });
});
