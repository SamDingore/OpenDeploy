-- Phase 5: node pools, leases, quotas, edge config versions, reconciliation, telemetry links

-- Extend WorkerStatus (runs once per environment)
ALTER TYPE "WorkerStatus" ADD VALUE 'degraded';
ALTER TYPE "WorkerStatus" ADD VALUE 'quarantined';
ALTER TYPE "WorkerStatus" ADD VALUE 'retired';

-- CreateEnum
CREATE TYPE "NodePoolKind" AS ENUM ('build', 'runtime', 'edge', 'mixed');
CREATE TYPE "NodeLeaseScopeType" AS ENUM ('build', 'runtime', 'edge_op');
CREATE TYPE "EgressPolicyTier" AS ENUM ('unrestricted', 'allowlisted', 'blocked');
CREATE TYPE "IsolationTier" AS ENUM ('standard', 'hardened', 'internal_trusted');
CREATE TYPE "RunnerClass" AS ENUM ('standard', 'hardened', 'internal_trusted');
CREATE TYPE "ReconciliationKind" AS ENUM ('runtime', 'route', 'domain', 'node', 'lease', 'artifact', 'edge_config');
CREATE TYPE "ReconciliationRunStatus" AS ENUM ('scheduled', 'running', 'completed', 'partially_repaired', 'failed');
CREATE TYPE "EdgeNodeStatus" AS ENUM ('active', 'config_applying', 'degraded', 'offline', 'quarantined');
CREATE TYPE "EdgeConfigApplyStatus" AS ENUM ('pending', 'applied', 'failed', 'rolled_back');
CREATE TYPE "CapacityEventType" AS ENUM ('scale_out_requested', 'scale_in_requested', 'quota_denied', 'queue_depth_high', 'worker_pool_saturated');

-- CreateTable
CREATE TABLE "NodePool" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "NodePoolKind" NOT NULL DEFAULT 'mixed',
    "isHardened" BOOLEAN NOT NULL DEFAULT false,
    "supportsRootless" BOOLEAN NOT NULL DEFAULT false,
    "capacityCpu" INTEGER,
    "capacityMemoryMb" INTEGER,
    "maxConcurrentBuilds" INTEGER NOT NULL DEFAULT 4,
    "maxConcurrentRuntimes" INTEGER NOT NULL DEFAULT 20,
    "labelsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NodePool_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NodePool_name_key" ON "NodePool"("name");

CREATE TABLE "WorkspaceQuota" (
    "workspaceId" TEXT NOT NULL,
    "maxConcurrentBuilds" INTEGER NOT NULL DEFAULT 5,
    "maxConcurrentRuntimes" INTEGER NOT NULL DEFAULT 20,
    "maxCertJobsInFlight" INTEGER NOT NULL DEFAULT 10,
    "maxEdgeReloadsPerHour" INTEGER NOT NULL DEFAULT 120,
    "maxCustomDomains" INTEGER NOT NULL DEFAULT 50,

    CONSTRAINT "WorkspaceQuota_pkey" PRIMARY KEY ("workspaceId")
);

CREATE TABLE "RuntimePolicy" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "projectId" TEXT,
    "cpuLimit" INTEGER,
    "memoryLimitMb" INTEGER,
    "maxReplicas" INTEGER NOT NULL DEFAULT 1,
    "egressPolicy" "EgressPolicyTier" NOT NULL DEFAULT 'unrestricted',
    "isolationTier" "IsolationTier" NOT NULL DEFAULT 'standard',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuntimePolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RuntimePolicy_projectId_key" ON "RuntimePolicy"("projectId");
CREATE INDEX "RuntimePolicy_workspaceId_idx" ON "RuntimePolicy"("workspaceId");

CREATE TABLE "NodeLease" (
    "id" TEXT NOT NULL,
    "workerNodeId" TEXT NOT NULL,
    "scopeType" "NodeLeaseScopeType" NOT NULL,
    "scopeId" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "NodeLease_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CapacityEvent" (
    "id" TEXT NOT NULL,
    "nodePoolId" TEXT,
    "type" "CapacityEventType" NOT NULL,
    "payloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapacityEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReconciliationRun" (
    "id" TEXT NOT NULL,
    "kind" "ReconciliationKind" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "ReconciliationRunStatus" NOT NULL DEFAULT 'running',
    "itemsExamined" INTEGER NOT NULL DEFAULT 0,
    "itemsRepaired" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "metadataJson" JSONB,

    CONSTRAINT "ReconciliationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TelemetrySpanLink" (
    "id" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "spanId" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelemetrySpanLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EdgeNode" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "EdgeNodeStatus" NOT NULL DEFAULT 'active',
    "caddyAdminSocketPath" TEXT,
    "publicBaseUrl" TEXT,
    "lastHeartbeatAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EdgeNode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EdgeNode_name_key" ON "EdgeNode"("name");

CREATE TABLE "EdgeConfigVersion" (
    "id" TEXT NOT NULL,
    "edgeNodeId" TEXT,
    "version" INTEGER NOT NULL,
    "configHash" TEXT NOT NULL,
    "bodySnapshot" TEXT NOT NULL,
    "applyStatus" "EdgeConfigApplyStatus" NOT NULL DEFAULT 'applied',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorDetail" TEXT,
    "actorHint" TEXT,

    CONSTRAINT "EdgeConfigVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EdgeConfigVersion_edgeNodeId_version_key" ON "EdgeConfigVersion"("edgeNodeId", "version");
CREATE INDEX "EdgeConfigVersion_edgeNodeId_appliedAt_idx" ON "EdgeConfigVersion"("edgeNodeId", "appliedAt");

-- AlterTable WorkerNode
ALTER TABLE "WorkerNode" ADD COLUMN "rootlessCapable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WorkerNode" ADD COLUMN "runnerClass" "RunnerClass" NOT NULL DEFAULT 'standard';
ALTER TABLE "WorkerNode" ADD COLUMN "workerIdentityFingerprint" TEXT;
ALTER TABLE "WorkerNode" ADD COLUMN "nodePoolId" TEXT;

CREATE INDEX "WorkerNode_nodePoolId_idx" ON "WorkerNode"("nodePoolId");
CREATE INDEX "WorkerNode_status_idx" ON "WorkerNode"("status");

-- FKs
ALTER TABLE "WorkspaceQuota" ADD CONSTRAINT "WorkspaceQuota_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RuntimePolicy" ADD CONSTRAINT "RuntimePolicy_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RuntimePolicy" ADD CONSTRAINT "RuntimePolicy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkerNode" ADD CONSTRAINT "WorkerNode_nodePoolId_fkey" FOREIGN KEY ("nodePoolId") REFERENCES "NodePool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NodeLease" ADD CONSTRAINT "NodeLease_workerNodeId_fkey" FOREIGN KEY ("workerNodeId") REFERENCES "WorkerNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CapacityEvent" ADD CONSTRAINT "CapacityEvent_nodePoolId_fkey" FOREIGN KEY ("nodePoolId") REFERENCES "NodePool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EdgeConfigVersion" ADD CONSTRAINT "EdgeConfigVersion_edgeNodeId_fkey" FOREIGN KEY ("edgeNodeId") REFERENCES "EdgeNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "NodeLease_workerNodeId_scopeType_releasedAt_idx" ON "NodeLease"("workerNodeId", "scopeType", "releasedAt");
CREATE INDEX "NodeLease_expiresAt_idx" ON "NodeLease"("expiresAt");

CREATE INDEX "CapacityEvent_nodePoolId_createdAt_idx" ON "CapacityEvent"("nodePoolId", "createdAt");
CREATE INDEX "CapacityEvent_createdAt_idx" ON "CapacityEvent"("createdAt");

CREATE INDEX "ReconciliationRun_kind_startedAt_idx" ON "ReconciliationRun"("kind", "startedAt");

CREATE INDEX "TelemetrySpanLink_resourceType_resourceId_idx" ON "TelemetrySpanLink"("resourceType", "resourceId");
CREATE INDEX "TelemetrySpanLink_traceId_idx" ON "TelemetrySpanLink"("traceId");

-- Default pool for existing installs
INSERT INTO "NodePool" ("id", "name", "kind", "isHardened", "supportsRootless", "maxConcurrentBuilds", "maxConcurrentRuntimes", "createdAt", "updatedAt")
VALUES ('clphase5defaultpool00', 'default', 'mixed', false, false, 4, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
