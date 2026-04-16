-- Phase 4: custom domains, ownership verification, certificate records

CREATE TYPE "CustomDomainStatus" AS ENUM (
  'pending',
  'awaiting_verification',
  'verified',
  'certificate_issuing',
  'certificate_active',
  'certificate_renewing',
  'active',
  'failed',
  'revoked',
  'detached',
  'deleted'
);

CREATE TYPE "DomainVerificationMethod" AS ENUM ('cname_and_txt');

CREATE TYPE "DomainFailureCode" AS ENUM (
  'invalid_hostname',
  'verification_not_found',
  'cname_misconfigured',
  'txt_misconfigured',
  'rate_limited',
  'acme_order_failed',
  'edge_attach_failed',
  'renewal_failed'
);

CREATE TYPE "DomainCheckMethod" AS ENUM ('dns_txt', 'http_token', 'cname_target');

CREATE TYPE "CertChallengeType" AS ENUM ('http_01', 'dns_01');

CREATE TYPE "CertificateProvider" AS ENUM ('letsencrypt');

CREATE TYPE "CertificateRecordStatus" AS ENUM (
  'pending',
  'issuing',
  'active',
  'renewal_pending',
  'failed',
  'expired'
);

CREATE TYPE "DomainEventType" AS ENUM (
  'domain_created',
  'verification_check',
  'verification_passed',
  'verification_failed',
  'certificate_order_started',
  'certificate_active',
  'certificate_renewal',
  'certificate_failure',
  'attach_requested',
  'attach_succeeded',
  'attach_failed',
  'detach',
  'reconcile',
  'status_transition'
);

ALTER TABLE "RouteBinding" ALTER COLUMN "platformHostnameId" DROP NOT NULL;

CREATE TABLE "CustomDomain" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "environmentId" TEXT NOT NULL,
  "hostname" TEXT NOT NULL,
  "apexDomain" TEXT NOT NULL,
  "status" "CustomDomainStatus" NOT NULL DEFAULT 'pending',
  "verificationMethod" "DomainVerificationMethod" NOT NULL DEFAULT 'cname_and_txt',
  "verificationToken" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "lastCheckedAt" TIMESTAMP(3),
  "activeCertificateId" TEXT,
  "routeBindingId" TEXT,
  "createdByUserId" TEXT,
  "failureCode" "DomainFailureCode",
  "failureDetail" TEXT,
  "lastIssuanceAttemptAt" TIMESTAMP(3),
  "nextRetryAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomDomain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomDomain_hostname_key" ON "CustomDomain"("hostname");
CREATE UNIQUE INDEX "CustomDomain_activeCertificateId_key" ON "CustomDomain"("activeCertificateId");
CREATE UNIQUE INDEX "CustomDomain_routeBindingId_key" ON "CustomDomain"("routeBindingId");

CREATE TABLE "DomainVerificationCheck" (
  "id" TEXT NOT NULL,
  "customDomainId" TEXT NOT NULL,
  "method" "DomainCheckMethod" NOT NULL,
  "result" BOOLEAN NOT NULL,
  "observedValue" TEXT,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "errorDetail" TEXT,

  CONSTRAINT "DomainVerificationCheck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CertificateRecord" (
  "id" TEXT NOT NULL,
  "customDomainId" TEXT NOT NULL,
  "provider" "CertificateProvider" NOT NULL DEFAULT 'letsencrypt',
  "status" "CertificateRecordStatus" NOT NULL DEFAULT 'pending',
  "challengeType" "CertChallengeType" NOT NULL DEFAULT 'http_01',
  "externalOrderRef" TEXT,
  "notBefore" TIMESTAMP(3),
  "notAfter" TIMESTAMP(3),
  "renewalAttemptedAt" TIMESTAMP(3),
  "renewalSucceededAt" TIMESTAMP(3),
  "failureCode" "DomainFailureCode",
  "failureDetail" TEXT,
  "serialNumberMasked" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CertificateRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DomainEvent" (
  "id" TEXT NOT NULL,
  "customDomainId" TEXT NOT NULL,
  "type" "DomainEventType" NOT NULL,
  "payloadJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CustomDomain" ADD CONSTRAINT "CustomDomain_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomDomain" ADD CONSTRAINT "CustomDomain_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomDomain" ADD CONSTRAINT "CustomDomain_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DomainVerificationCheck" ADD CONSTRAINT "DomainVerificationCheck_customDomainId_fkey" FOREIGN KEY ("customDomainId") REFERENCES "CustomDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CertificateRecord" ADD CONSTRAINT "CertificateRecord_customDomainId_fkey" FOREIGN KEY ("customDomainId") REFERENCES "CustomDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DomainEvent" ADD CONSTRAINT "DomainEvent_customDomainId_fkey" FOREIGN KEY ("customDomainId") REFERENCES "CustomDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomDomain" ADD CONSTRAINT "CustomDomain_routeBindingId_fkey" FOREIGN KEY ("routeBindingId") REFERENCES "RouteBinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CustomDomain" ADD CONSTRAINT "CustomDomain_activeCertificateId_fkey" FOREIGN KEY ("activeCertificateId") REFERENCES "CertificateRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "CustomDomain_projectId_environmentId_idx" ON "CustomDomain"("projectId", "environmentId");
CREATE INDEX "CustomDomain_status_idx" ON "CustomDomain"("status");
CREATE INDEX "CustomDomain_nextRetryAt_idx" ON "CustomDomain"("nextRetryAt");

CREATE INDEX "DomainVerificationCheck_customDomainId_checkedAt_idx" ON "DomainVerificationCheck"("customDomainId", "checkedAt");

CREATE INDEX "CertificateRecord_customDomainId_createdAt_idx" ON "CertificateRecord"("customDomainId", "createdAt");
CREATE INDEX "CertificateRecord_notAfter_idx" ON "CertificateRecord"("notAfter");

CREATE INDEX "DomainEvent_customDomainId_createdAt_idx" ON "DomainEvent"("customDomainId", "createdAt");
