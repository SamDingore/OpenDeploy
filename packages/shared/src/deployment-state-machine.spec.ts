import { describe, expect, it } from 'vitest';
import { DeploymentStatus } from './enums';
import { canTransition } from './deployment-state-machine';

describe('deployment state machine', () => {
  it('allows happy path', () => {
    const steps: DeploymentStatus[] = [
      DeploymentStatus.created,
      DeploymentStatus.queued,
      DeploymentStatus.assigned,
      DeploymentStatus.fetching_source,
      DeploymentStatus.preparing_context,
      DeploymentStatus.building_image,
      DeploymentStatus.pushing_image,
      DeploymentStatus.build_succeeded,
    ];
    for (let i = 0; i < steps.length - 1; i++) {
      const from = steps[i]!;
      const to = steps[i + 1]!;
      expect(canTransition(from, to).ok).toBe(true);
    }
  });

  it('rejects skip-ahead', () => {
    expect(canTransition(DeploymentStatus.created, DeploymentStatus.building_image).ok).toBe(false);
  });

  it('rejects transitions after terminal', () => {
    expect(canTransition(DeploymentStatus.build_failed, DeploymentStatus.queued).ok).toBe(false);
  });
});
