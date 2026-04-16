import { ReleaseStatus } from './enums';

const transitions: Record<ReleaseStatus, ReleaseStatus[]> = {
  [ReleaseStatus.pending]: [ReleaseStatus.provisioning_runtime, ReleaseStatus.failed, ReleaseStatus.terminated],
  [ReleaseStatus.provisioning_runtime]: [
    ReleaseStatus.starting,
    ReleaseStatus.failed,
    ReleaseStatus.terminated,
  ],
  [ReleaseStatus.starting]: [
    ReleaseStatus.health_checking,
    ReleaseStatus.failed,
    ReleaseStatus.terminated,
  ],
  [ReleaseStatus.health_checking]: [
    ReleaseStatus.active,
    ReleaseStatus.failed,
    ReleaseStatus.terminated,
  ],
  [ReleaseStatus.active]: [
    ReleaseStatus.stopped,
    ReleaseStatus.failed,
    ReleaseStatus.rolled_back,
    ReleaseStatus.terminated,
  ],
  [ReleaseStatus.failed]: [ReleaseStatus.terminated],
  [ReleaseStatus.stopped]: [ReleaseStatus.terminated],
  [ReleaseStatus.rolled_back]: [ReleaseStatus.terminated],
  [ReleaseStatus.terminated]: [],
};

export function canTransitionRelease(
  from: ReleaseStatus,
  to: ReleaseStatus,
): { ok: true } | { ok: false; reason: string } {
  if (from === to) return { ok: true };
  const allowed = transitions[from];
  if (!allowed?.includes(to)) {
    return { ok: false, reason: `invalid_release_transition:${from}->${to}` };
  }
  return { ok: true };
}
