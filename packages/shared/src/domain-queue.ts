export const DOMAIN_QUEUE_NAME = 'domains';

export type DomainJobKind =
  | 'domain-verify'
  | 'certificate-issue'
  | 'certificate-renew'
  | 'domain-attach'
  | 'domain-detach'
  | 'domain-reconcile';

export interface DomainJobPayload {
  kind: DomainJobKind;
  customDomainId?: string;
  /** For reconcile-all sweeps */
  sweep?: boolean;
  traceCarrier?: Record<string, string>;
}
