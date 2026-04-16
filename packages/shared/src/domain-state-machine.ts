/** Mirrors Prisma `CustomDomainStatus` without depending on `@prisma/client` in shared. */
export type CustomDomainStatusName =
  | 'pending'
  | 'awaiting_verification'
  | 'verified'
  | 'certificate_issuing'
  | 'certificate_active'
  | 'certificate_renewing'
  | 'active'
  | 'failed'
  | 'revoked'
  | 'detached'
  | 'deleted';

/** Only states that cannot progress without admin-style intervention. */
const TERMINAL: CustomDomainStatusName[] = ['revoked', 'deleted'];

export function isTerminalCustomDomainStatus(s: CustomDomainStatusName): boolean {
  return TERMINAL.includes(s);
}

export function canTransitionCustomDomain(
  from: CustomDomainStatusName,
  to: CustomDomainStatusName,
): { ok: true } | { ok: false; reason: string } {
  if (from === to) return { ok: true };
  if (TERMINAL.includes(from) && to !== 'deleted' && from !== 'deleted') {
    return { ok: false, reason: 'terminal_state' };
  }

  const allowed: Partial<Record<CustomDomainStatusName, CustomDomainStatusName[]>> = {
    pending: ['awaiting_verification', 'failed', 'deleted'],
    awaiting_verification: ['verified', 'failed', 'deleted', 'awaiting_verification'],
    verified: ['certificate_issuing', 'failed', 'deleted', 'detached'],
    certificate_issuing: ['certificate_active', 'failed', 'active', 'certificate_issuing'],
    certificate_active: ['active', 'certificate_renewing', 'failed', 'detached'],
    certificate_renewing: ['certificate_active', 'active', 'failed'],
    active: ['certificate_renewing', 'detached', 'failed'],
    failed: ['awaiting_verification', 'certificate_issuing', 'deleted', 'detached', 'verified'],
    detached: ['awaiting_verification', 'verified', 'deleted'],
    revoked: ['deleted'],
    deleted: [],
  };

  const next = allowed[from];
  if (!next?.includes(to)) {
    return { ok: false, reason: `invalid_transition:${from}->${to}` };
  }
  return { ok: true };
}
