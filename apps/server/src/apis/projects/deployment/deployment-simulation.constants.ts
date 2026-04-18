/**
 * Simulated phase durations (ms). Replace with real build steps later.
 */
export const SIMULATION_DELAYS_MS = {
  workerPickup: 1000,
  install: 1200,
  buildPart1: 1600,
  buildPart2: 1400,
  package: 900,
  healthcheck: 1000,
  readyFinalize: 300,
} as const;
