-- AlterTable
ALTER TABLE "Deployment" ADD COLUMN "streamLogs" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Deployment" ADD COLUMN "streamStages" JSONB NOT NULL DEFAULT '[]';
