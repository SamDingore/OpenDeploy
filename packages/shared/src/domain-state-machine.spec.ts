import { describe, expect, it } from 'vitest';
import { canTransitionCustomDomain, isTerminalCustomDomainStatus } from './domain-state-machine';

describe('isTerminalCustomDomainStatus', () => {
  it('marks revoked/deleted as terminal', () => {
    expect(isTerminalCustomDomainStatus('revoked')).toBe(true);
    expect(isTerminalCustomDomainStatus('deleted')).toBe(true);
    expect(isTerminalCustomDomainStatus('failed')).toBe(false);
  });
});

describe('canTransitionCustomDomain', () => {
  it('allows awaiting_verification to verified', () => {
    expect(canTransitionCustomDomain('awaiting_verification', 'verified').ok).toBe(true);
  });

  it('allows failed to verified after re-check', () => {
    expect(canTransitionCustomDomain('failed', 'verified').ok).toBe(true);
  });

  it('blocks invalid jumps', () => {
    expect(canTransitionCustomDomain('pending', 'active').ok).toBe(false);
  });
});
