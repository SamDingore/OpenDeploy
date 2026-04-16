import { BuildFailureCode, DeploymentStatus } from './enums';

const TERMINAL: DeploymentStatus[] = [
  DeploymentStatus.build_succeeded,
  DeploymentStatus.build_failed,
  DeploymentStatus.cancelled,
];

const SUCCESS_END = DeploymentStatus.build_succeeded;

/** Valid forward progression edges (excluding failure/cancel from intermediate states). */
const FORWARD: Record<DeploymentStatus, DeploymentStatus[]> = {
  [DeploymentStatus.created]: [DeploymentStatus.queued, DeploymentStatus.cancelled],
  [DeploymentStatus.queued]: [
    DeploymentStatus.assigned,
    DeploymentStatus.cancelled,
    DeploymentStatus.build_failed,
  ],
  [DeploymentStatus.assigned]: [
    DeploymentStatus.fetching_source,
    DeploymentStatus.build_failed,
    DeploymentStatus.cancelled,
  ],
  [DeploymentStatus.fetching_source]: [
    DeploymentStatus.preparing_context,
    DeploymentStatus.build_failed,
    DeploymentStatus.cancelled,
  ],
  [DeploymentStatus.preparing_context]: [
    DeploymentStatus.building_image,
    DeploymentStatus.build_failed,
    DeploymentStatus.cancelled,
  ],
  [DeploymentStatus.building_image]: [
    DeploymentStatus.pushing_image,
    DeploymentStatus.build_succeeded,
    DeploymentStatus.build_failed,
    DeploymentStatus.cancelled,
  ],
  [DeploymentStatus.pushing_image]: [
    DeploymentStatus.build_succeeded,
    DeploymentStatus.build_failed,
    DeploymentStatus.cancelled,
  ],
  [DeploymentStatus.build_succeeded]: [],
  [DeploymentStatus.build_failed]: [],
  [DeploymentStatus.cancelled]: [],
};

export type TransitionResult =
  | { ok: true; next: DeploymentStatus }
  | { ok: false; reason: string };

export function canTransition(
  from: DeploymentStatus,
  to: DeploymentStatus,
): TransitionResult {
  if (from === to) {
    return { ok: true, next: to };
  }
  if (TERMINAL.includes(from)) {
    return { ok: false, reason: 'deployment_already_terminal' };
  }
  const allowed = FORWARD[from];
  if (!allowed?.includes(to)) {
    return { ok: false, reason: 'invalid_state_transition' };
  }
  return { ok: true, next: to };
}

export function assertTerminalFailureReason(
  status: DeploymentStatus,
  code: BuildFailureCode | null | undefined,
): void {
  if (status === DeploymentStatus.build_failed && code == null) {
    throw new Error('failure_code_required_when_build_failed');
  }
  if (status !== DeploymentStatus.build_failed && code != null) {
    throw new Error('failure_code_only_when_build_failed');
  }
}

export function isTerminalStatus(status: DeploymentStatus): boolean {
  return TERMINAL.includes(status);
}

export function isSuccessStatus(status: DeploymentStatus): boolean {
  return status === SUCCESS_END;
}
