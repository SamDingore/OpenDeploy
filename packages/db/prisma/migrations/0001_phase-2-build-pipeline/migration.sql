-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('created', 'queued', 'assigned', 'fetching_source', 'preparing_context', 'building_image', 'pushing_image', 'build_succeeded', 'build_failed', 'cancelled');

-- CreateEnum
CREATE TYPE "BuildFailureCode" AS ENUM ('github_webhook_invalid', 'github_api_transient', 'github_api_forbidden', 'repo_fetch_failed', 'repo_not_found', 'dockerfile_invalid', 'build_failed', 'registry_push_failed', 'timeout', 'worker_internal_error');

-- CreateEnum
CREATE TYPE "TriggerSource" AS ENUM ('manual', 'push', 'pull_request');

-- CreateEnum
CREATE TYPE "DeploymentAttemptResult" AS ENUM ('succeeded', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "EnvironmentType" AS ENUM ('preview', 'production');

-- CreateEnum
CREATE TYPE "WorkerStatus" AS ENUM ('online', 'offline', 'draining', 'error');

-- CreateEnum
CREATE TYPE "WebhookProvider" AS ENUM ('github', 'clerk');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "productionBranchRule" TEXT,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitProviderInstallation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "providerInstallationId" TEXT NOT NULL,
    "accountLogin" TEXT,
    "rawMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitProviderInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepositoryLink" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "providerRepoId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "defaultBranch" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepositoryLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Environment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "EnvironmentType" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Environment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "status" "DeploymentStatus" NOT NULL DEFAULT 'created',
    "commitSha" TEXT,
    "branch" TEXT,
    "triggerSource" "TriggerSource" NOT NULL DEFAULT 'manual',
    "buildStartedAt" TIMESTAMP(3),
    "buildFinishedAt" TIMESTAMP(3),
    "buildDurationMs" INTEGER,
    "failureCode" "BuildFailureCode",
    "failureDetail" TEXT,
    "gitRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeploymentAttempt" (
    "id" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "queueJobId" TEXT,
    "workerNodeId" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "result" "DeploymentAttemptResult",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeploymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeploymentLogChunk" (
    "id" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeploymentLogChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildArtifact" (
    "id" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "imageTag" TEXT NOT NULL,
    "imageDigest" TEXT,
    "registryType" TEXT,
    "registryRepository" TEXT,
    "buildContextBytes" INTEGER,
    "dockerfilePath" TEXT,
    "builderVersion" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuildArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceSnapshot" (
    "id" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "repoOwner" TEXT,
    "repoName" TEXT,
    "installationId" TEXT,
    "commitSha" TEXT NOT NULL,
    "cloneUrlMasked" TEXT,
    "defaultBranch" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerNode" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "WorkerStatus" NOT NULL DEFAULT 'offline',
    "lastHeartbeatAt" TIMESTAMP(3),
    "supportsBuildkit" BOOLEAN NOT NULL DEFAULT true,
    "supportsRegistryPush" BOOLEAN NOT NULL DEFAULT false,
    "availableCpu" INTEGER,
    "availableMemoryMb" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "provider" "WebhookProvider" NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "Project_workspaceId_idx" ON "Project"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_workspaceId_slug_key" ON "Project"("workspaceId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "GitProviderInstallation_providerInstallationId_key" ON "GitProviderInstallation"("providerInstallationId");

-- CreateIndex
CREATE INDEX "RepositoryLink_installationId_idx" ON "RepositoryLink"("installationId");

-- CreateIndex
CREATE UNIQUE INDEX "RepositoryLink_projectId_key" ON "RepositoryLink"("projectId");

-- CreateIndex
CREATE INDEX "Environment_projectId_idx" ON "Environment"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Environment_projectId_slug_key" ON "Environment"("projectId", "slug");

-- CreateIndex
CREATE INDEX "Deployment_workspaceId_projectId_environmentId_idx" ON "Deployment"("workspaceId", "projectId", "environmentId");

-- CreateIndex
CREATE INDEX "Deployment_projectId_status_idx" ON "Deployment"("projectId", "status");

-- CreateIndex
CREATE INDEX "Deployment_createdAt_idx" ON "Deployment"("createdAt");

-- CreateIndex
CREATE INDEX "DeploymentAttempt_deploymentId_idx" ON "DeploymentAttempt"("deploymentId");

-- CreateIndex
CREATE UNIQUE INDEX "DeploymentAttempt_deploymentId_attemptNumber_key" ON "DeploymentAttempt"("deploymentId", "attemptNumber");

-- CreateIndex
CREATE INDEX "DeploymentLogChunk_deploymentId_seq_idx" ON "DeploymentLogChunk"("deploymentId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "DeploymentLogChunk_deploymentId_seq_key" ON "DeploymentLogChunk"("deploymentId", "seq");

-- CreateIndex
CREATE INDEX "BuildArtifact_deploymentId_createdAt_idx" ON "BuildArtifact"("deploymentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SourceSnapshot_deploymentId_key" ON "SourceSnapshot"("deploymentId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_idempotencyKey_key" ON "WebhookEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WebhookEvent_provider_processed_idx" ON "WebhookEvent"("provider", "processed");

-- CreateIndex
CREATE INDEX "WebhookEvent_workspaceId_idx" ON "WebhookEvent"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_deliveryId_key" ON "WebhookEvent"("provider", "deliveryId");

-- CreateIndex
CREATE INDEX "AuditEvent_workspaceId_createdAt_idx" ON "AuditEvent"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_idx" ON "AuditEvent"("actorUserId");

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitProviderInstallation" ADD CONSTRAINT "GitProviderInstallation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepositoryLink" ADD CONSTRAINT "RepositoryLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepositoryLink" ADD CONSTRAINT "RepositoryLink_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "GitProviderInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Environment" ADD CONSTRAINT "Environment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentAttempt" ADD CONSTRAINT "DeploymentAttempt_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentAttempt" ADD CONSTRAINT "DeploymentAttempt_workerNodeId_fkey" FOREIGN KEY ("workerNodeId") REFERENCES "WorkerNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentLogChunk" ADD CONSTRAINT "DeploymentLogChunk_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildArtifact" ADD CONSTRAINT "BuildArtifact_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceSnapshot" ADD CONSTRAINT "SourceSnapshot_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

