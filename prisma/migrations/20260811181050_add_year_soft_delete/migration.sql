-- AlterTable
ALTER TABLE "years" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "years_deletedAt_idx" ON "years"("deletedAt");
