import * as http from 'node:http';
import * as https from 'node:https';

export type CaddyAdminPostResult = { statusCode: number; rawBody: string };

/**
 * POST Caddyfile body to Caddy admin /load. Prefer {@link unixSocketPath} in production so the
 * admin API is not exposed on TCP alongside untrusted workloads (see Caddy security guidance).
 */
export async function postCaddyLoad(input: {
  adminUrl?: string;
  unixSocketPath?: string;
  body: string;
}): Promise<CaddyAdminPostResult> {
  if (input.unixSocketPath) {
    return postViaUnixSocket(input.unixSocketPath, input.body);
  }
  if (input.adminUrl) {
    return postViaUrl(input.adminUrl, input.body);
  }
  throw new Error('caddy_admin_not_configured');
}

function postViaUnixSocket(socketPath: string, body: string): Promise<CaddyAdminPostResult> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath,
        path: '/load',
        method: 'POST',
        headers: {
          'Content-Type': 'text/caddyfile',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c as Buffer));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            rawBody: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function postViaUrl(adminBase: string, body: string): Promise<CaddyAdminPostResult> {
  const base = adminBase.replace(/\/$/, '');
  const url = new URL(`${base}/load`);
  const isHttps = url.protocol === 'https:';
  const lib = isHttps ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: {
          'Content-Type': 'text/caddyfile',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c as Buffer));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            rawBody: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
