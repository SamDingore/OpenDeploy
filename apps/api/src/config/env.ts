import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_APP_SLUG: z.string().optional(),
  GITHUB_APP_CLIENT_ID: z.string().optional(),
  GITHUB_APP_CLIENT_SECRET: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  CLERK_WEBHOOK_SECRET: z.string().optional(),
  INTERNAL_API_SECRET: z.string().min(16),
  APP_ORIGIN: z.string().url().default('http://localhost:3000'),
  API_PUBLIC_URL: z.string().url().default('http://localhost:3001'),
  /** Base domain for platform-managed hostnames (e.g. deploy.example.com). */
  PLATFORM_PUBLIC_DOMAIN: z.string().min(1).default('deploy.local'),
  /** Optional Caddy admin API (e.g. http://caddy:2019). When unset, edge reload is skipped. */
  CADDY_ADMIN_URL: z.string().url().optional(),
  /** ACME account email when Caddy obtains public certs (optional for local). */
  CADDY_ACME_EMAIL: z.string().email().optional(),
  /** Optional path to write Caddyfile for volume-based reload. */
  CADDYFILE_PATH: z.string().optional(),
  PREVIEW_TTL_HOURS: z.coerce.number().min(1).default(168),
  /** 32-byte hex key for AES-256-GCM secret storage. */
  SECRETS_ENCRYPTION_KEY: z.string().length(64).optional(),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment: ${JSON.stringify(msg)}`);
  }
  return parsed.data;
}
