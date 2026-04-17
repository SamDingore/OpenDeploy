import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Monorepo root `.env` (this file compiles to `apps/api/dist/`). */
const rootEnv = resolve(__dirname, '../../..', '.env');
if (existsSync(rootEnv)) {
  config({ path: rootEnv });
}
