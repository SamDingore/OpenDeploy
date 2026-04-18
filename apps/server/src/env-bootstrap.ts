import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

function isServerPackageRoot(dir: string): boolean {
  return (
    existsSync(resolve(dir, 'package.json')) &&
    existsSync(resolve(dir, 'prisma', 'schema.prisma'))
  );
}

/**
 * Load `.env` before any other app modules so BullMQ, Prisma, and decorators
 * see the same configuration as runtime.
 */
function loadEnv(): void {
  const candidates = [
    resolve(__dirname, '..', '..'),
    resolve(__dirname, '..'),
    process.cwd(),
  ];
  const root = candidates.find(isServerPackageRoot) ?? process.cwd();
  const base = resolve(root, '.env');
  const local = resolve(root, '.env.local');
  if (existsSync(base)) {
    config({ path: base });
  }
  if (existsSync(local)) {
    config({ path: local, override: true });
  }
}

loadEnv();
