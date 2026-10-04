-- AlterTable
ALTER TABLE "Repository" ADD COLUMN     "installationId" UUID;

-- CreateIndex
CREATE INDEX "Repository_installationId_idx" ON "Repository"("installationId");

-- AddForeignKey
ALTER TABLE "Repository" ADD CONSTRAINT "Repository_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "GitHubInstallation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
