import { describe, expect, it } from 'vitest';
import { runWithTraceCarrier } from './trace-carrier';

describe('trace carrier', () => {
  it('runs the job closure when carrier is missing (noop propagation)', async () => {
    let ran = false;
    await runWithTraceCarrier(undefined, async () => {
      ran = true;
    });
    expect(ran).toBe(true);
  });

  it('runs the job closure when carrier is empty', async () => {
    let ran = false;
    await runWithTraceCarrier({}, async () => {
      ran = true;
    });
    expect(ran).toBe(true);
  });
});
