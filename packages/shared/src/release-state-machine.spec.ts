import { describe, expect, it } from 'vitest';
import { ReleaseStatus } from './enums';
import { canTransitionRelease } from './release-state-machine';

describe('canTransitionRelease', () => {
  it('allows happy path', () => {
    expect(canTransitionRelease(ReleaseStatus.pending, ReleaseStatus.provisioning_runtime).ok).toBe(true);
    expect(canTransitionRelease(ReleaseStatus.health_checking, ReleaseStatus.active).ok).toBe(true);
  });

  it('blocks skip states', () => {
    expect(canTransitionRelease(ReleaseStatus.pending, ReleaseStatus.active).ok).toBe(false);
  });
});
