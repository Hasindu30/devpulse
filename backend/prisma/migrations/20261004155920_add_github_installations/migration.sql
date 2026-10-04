-- CreateTable
CREATE TABLE "GitHubInstallation" (
    "id" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "githubInstallationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accountLogin" TEXT NOT NULL,
    "accountType" TEXT,
    "repositorySelection" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GitHubInstallation_githubInstallationId_key" ON "GitHubInstallation"("githubInstallationId");

-- CreateIndex
CREATE INDEX "GitHubInstallation_teamId_idx" ON "GitHubInstallation"("teamId");

-- AddForeignKey
ALTER TABLE "GitHubInstallation" ADD CONSTRAINT "GitHubInstallation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
