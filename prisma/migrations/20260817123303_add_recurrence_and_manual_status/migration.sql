/*
  Warnings:

  - You are about to drop the column `installments` on the `expenses` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "MonthStatus" AS ENUM ('EMPTY', 'PARTIAL', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CardStatusMode" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "RecurrenceType" AS ENUM ('NONE', 'INSTALLMENT', 'RECURRING');

-- AlterTable
ALTER TABLE "cards" ADD COLUMN     "manualStatus" "MonthStatus",
ADD COLUMN     "statusMode" "CardStatusMode" NOT NULL DEFAULT 'AUTOMATIC';

-- AlterTable
ALTER TABLE "expenses" DROP COLUMN "installments",
ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "installmentNumber" INTEGER,
ADD COLUMN     "recurrenceType" "RecurrenceType" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "totalInstallments" INTEGER;

-- AlterTable
ALTER TABLE "incomes" ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "installmentNumber" INTEGER,
ADD COLUMN     "recurrenceType" "RecurrenceType" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "totalInstallments" INTEGER;

-- CreateIndex
CREATE INDEX "expenses_groupId_idx" ON "expenses"("groupId");

-- CreateIndex
CREATE INDEX "incomes_groupId_idx" ON "incomes"("groupId");
