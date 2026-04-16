-- Phase 3: runtime releases, routing, health, secrets

CREATE TYPE "ReleaseType" AS ENUM ('preview', 'production');

CREATE TYPE "ReleaseStatus" AS ENUM (
  'pending',
  'provisioning_runtime',
  'starting',
  'health_checking',
  'active',
  'failed',
  'stopped',
  'rolled_back',
  'terminated'
);

CREATE TYPE "RuntimeInstanceStatus" AS ENUM (
  'created',
  'starting',
  'running',
  'unhealthy',
  'stopping',
  'stopped',
  'failed'
);

CREATE TYPE "RouteBindingStatus" AS ENUM (
  'pending',
  'attached',
  'detaching',
  'detached',
  'failed'
);

CREATE TYPE "PlatformHostnameKind" AS ENUM ('preview', 'production');

CREATE TYPE "PlatformHostnameStatus" AS ENUM ('pending', 'active', 'retired');

CREATE TYPE "HealthCheckType" AS ENUM ('http', 'tcp');

ALTER TABLE "Environment" ADD COLUMN "runtimeContainerPort" INTEGER NOT NULL DEFAULT 3000;
ALTER TABLE "Environment" ADD COLUMN "runtimeHealthCheck" JSONB;
ALTER TABLE "Environment" ADD COLUMN "activeReleaseId" TEXT;

ALTER TABLE "Deployment" ADD COLUMN "pullRequestNumber" INTEGER;

CREATE TABLE "Release" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "environmentId" TEXT NOT NULL,
  "deploymentId" TEXT NOT NULL,
  "buildArtifactId" TEXT NOT NULL,
  "releaseType" "ReleaseType" NOT NULL,
  "status" "ReleaseStatus" NOT NULL DEFAULT 'pending',
  "pullRequestNumber" INTEGER,
  "commitSha" TEXT NOT NULL,
  "activatedAt" TIMESTAMP(3),
  "deactivatedAt" TIMESTAMP(3),
  "rollbackOfReleaseId" TEXT,
  "createdByUserId" TEXT,
  "failureDetail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Release_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Environment_activeReleaseId_key" ON "Environment"("activeReleaseId");

ALTER TABLE "Release" ADD CONSTRAINT "Release_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Release" ADD CONSTRAINT "Release_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Release" ADD CONSTRAINT "Release_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Release" ADD CONSTRAINT "Release_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Release" ADD CONSTRAINT "Release_buildArtifactId_fkey" FOREIGN KEY ("buildArtifactId") REFERENCES "BuildArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Release" ADD CONSTRAINT "Release_rollbackOfReleaseId_fkey" FOREIGN KEY ("rollbackOfReleaseId") REFERENCES "Release"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Environment" ADD CONSTRAINT "Environment_activeReleaseId_fkey" FOREIGN KEY ("activeReleaseId") REFERENCES "Release"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "RuntimeInstance" (
  "id" TEXT NOT NULL,
  "releaseId" TEXT NOT NULL,
  "workerNodeId" TEXT,
  "containerName" TEXT NOT NULL,
  "containerIdMasked" TEXT,
  "imageTag" TEXT NOT NULL,
  "imageDigest" TEXT,
  "status" "RuntimeInstanceStatus" NOT NULL DEFAULT 'created',
  "internalPort" INTEGER NOT NULL,
  "upstreamDial" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3),
  "stoppedAt" TIMESTAMP(3),
  "lastHealthStatus" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RuntimeInstance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RuntimeInstance_containerName_key" ON "RuntimeInstance"("containerName");

CREATE TABLE "PlatformHostname" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "environmentId" TEXT NOT NULL,
  "hostname" TEXT NOT NULL,
  "kind" "PlatformHostnameKind" NOT NULL,
  "pullRequestNumber" INTEGER,
  "status" "PlatformHostnameStatus" NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlatformHostname_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformHostname_hostname_key" ON "PlatformHostname"("hostname");

CREATE TABLE "RouteBinding" (
  "id" TEXT NOT NULL,
  "platformHostnameId" TEXT NOT NULL,
  "runtimeInstanceId" TEXT NOT NULL,
  "status" "RouteBindingStatus" NOT NULL DEFAULT 'pending',
  "attachedAt" TIMESTAMP(3),
  "detachedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RouteBinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HealthCheckResult" (
  "id" TEXT NOT NULL,
  "runtimeInstanceId" TEXT NOT NULL,
  "checkType" "HealthCheckType" NOT NULL,
  "success" BOOLEAN NOT NULL,
  "latencyMs" INTEGER,
  "detail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "HealthCheckResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RuntimeLogChunk" (
  "id" TEXT NOT NULL,
  "releaseId" TEXT NOT NULL,
  "seq" INTEGER NOT NULL,
  "level" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RuntimeLogChunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnvironmentSecret" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "environmentId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "valueEncrypted" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EnvironmentSecret_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RuntimeInstance" ADD CONSTRAINT "RuntimeInstance_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RuntimeInstance" ADD CONSTRAINT "RuntimeInstance_workerNodeId_fkey" FOREIGN KEY ("workerNodeId") REFERENCES "WorkerNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PlatformHostname" ADD CONSTRAINT "PlatformHostname_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformHostname" ADD CONSTRAINT "PlatformHostname_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RouteBinding" ADD CONSTRAINT "RouteBinding_platformHostnameId_fkey" FOREIGN KEY ("platformHostnameId") REFERENCES "PlatformHostname"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RouteBinding" ADD CONSTRAINT "RouteBinding_runtimeInstanceId_fkey" FOREIGN KEY ("runtimeInstanceId") REFERENCES "RuntimeInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HealthCheckResult" ADD CONSTRAINT "HealthCheckResult_runtimeInstanceId_fkey" FOREIGN KEY ("runtimeInstanceId") REFERENCES "RuntimeInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RuntimeLogChunk" ADD CONSTRAINT "RuntimeLogChunk_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EnvironmentSecret" ADD CONSTRAINT "EnvironmentSecret_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnvironmentSecret" ADD CONSTRAINT "EnvironmentSecret_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Release_projectId_environmentId_status_idx" ON "Release"("projectId", "environmentId", "status");
CREATE INDEX "Release_pullRequestNumber_projectId_environmentId_idx" ON "Release"("pullRequestNumber", "projectId", "environmentId");
CREATE INDEX "Release_deploymentId_idx" ON "Release"("deploymentId");

CREATE INDEX "RuntimeInstance_releaseId_idx" ON "RuntimeInstance"("releaseId");
CREATE INDEX "RuntimeInstance_workerNodeId_idx" ON "RuntimeInstance"("workerNodeId");

CREATE INDEX "PlatformHostname_projectId_environmentId_idx" ON "PlatformHostname"("projectId", "environmentId");

CREATE INDEX "RouteBinding_platformHostnameId_status_idx" ON "RouteBinding"("platformHostnameId", "status");
CREATE INDEX "RouteBinding_runtimeInstanceId_idx" ON "RouteBinding"("runtimeInstanceId");

CREATE INDEX "HealthCheckResult_runtimeInstanceId_createdAt_idx" ON "HealthCheckResult"("runtimeInstanceId", "createdAt");

CREATE UNIQUE INDEX "RuntimeLogChunk_releaseId_seq_key" ON "RuntimeLogChunk"("releaseId", "seq");
CREATE INDEX "RuntimeLogChunk_releaseId_seq_idx" ON "RuntimeLogChunk"("releaseId", "seq");

CREATE UNIQUE INDEX "EnvironmentSecret_environmentId_name_key" ON "EnvironmentSecret"("environmentId", "name");
CREATE INDEX "EnvironmentSecret_projectId_idx" ON "EnvironmentSecret"("projectId");
