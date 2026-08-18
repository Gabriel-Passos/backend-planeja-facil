/*
  Warnings:

  - Added the required column `date` to the `expenses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `date` to the `incomes` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ExpenseCategory" ADD VALUE 'COMPRAS';
ALTER TYPE "ExpenseCategory" ADD VALUE 'ASSINATURAS';
ALTER TYPE "ExpenseCategory" ADD VALUE 'PETS';
ALTER TYPE "ExpenseCategory" ADD VALUE 'PRESENTES';
ALTER TYPE "ExpenseCategory" ADD VALUE 'IMPOSTOS';
ALTER TYPE "ExpenseCategory" ADD VALUE 'SEGUROS';
ALTER TYPE "ExpenseCategory" ADD VALUE 'VIAGEM';
ALTER TYPE "ExpenseCategory" ADD VALUE 'CUIDADOS_PESSOAIS';
ALTER TYPE "ExpenseCategory" ADD VALUE 'MANUTENCAO';
ALTER TYPE "ExpenseCategory" ADD VALUE 'DOACOES';

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "date" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "incomes" ADD COLUMN     "date" TIMESTAMP(3) NOT NULL;
