import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), ".env"),
  quiet: true,
});

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
