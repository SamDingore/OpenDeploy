-- CreateTable
CREATE TABLE "GithubRepository" (
    "id" TEXT NOT NULL,
    "githubRepoId" BIGINT NOT NULL,
    "ownerLogin" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "defaultBranch" TEXT,
    "isPrivate" BOOLEAN NOT NULL,
    "htmlUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GithubRepository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "framework" TEXT NOT NULL DEFAULT 'Unknown',
    "productionDomain" TEXT,
    "githubRepositoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GithubRepository_githubRepoId_key" ON "GithubRepository"("githubRepoId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_clerkUserId_githubRepositoryId_key" ON "Project"("clerkUserId", "githubRepositoryId");

-- CreateIndex
CREATE INDEX "Project_clerkUserId_createdAt_idx" ON "Project"("clerkUserId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_githubRepositoryId_fkey" FOREIGN KEY ("githubRepositoryId") REFERENCES "GithubRepository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
