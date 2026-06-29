-- CreateEnum
CREATE TYPE "PetCardStatus" AS ENUM ('PENDING', 'PRINTED', 'REPRINT_REQUESTED');

-- AlterTable
ALTER TABLE "Pet"
ADD COLUMN "cardStatus" "PetCardStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "cardPrintedAt" TIMESTAMP(3),
ADD COLUMN "cardLastGeneratedAt" TIMESTAMP(3),
ADD COLUMN "cardPrintCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "cardPrintedBy" TEXT;

-- CreateIndex
CREATE INDEX "Pet_cardStatus_idx" ON "Pet"("cardStatus");
