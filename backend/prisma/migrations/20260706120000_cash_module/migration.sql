-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('INCOME', 'EXPENSE', 'DEBT_PAYMENT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CashMovementCategory" AS ENUM ('CONSULTATION', 'VACCINE', 'SURGERY', 'GROOMING', 'TREATMENT', 'PRODUCT', 'CAMPAIGN', 'DEBT', 'OTHER');

-- CreateTable
CREATE TABLE "CashMovement" (
  "id" TEXT NOT NULL,
  "type" "CashMovementType" NOT NULL,
  "category" "CashMovementCategory" NOT NULL DEFAULT 'OTHER',
  "description" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "paymentMethod" "PaymentMethod",
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "clientName" TEXT,
  "petName" TEXT,
  "clientId" TEXT,
  "petId" TEXT,
  "saleId" TEXT,
  "appointmentId" TEXT,
  "notes" TEXT,
  "registeredById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashClosing" (
  "id" TEXT NOT NULL,
  "businessDate" TIMESTAMP(3) NOT NULL,
  "openingAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "expectedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "countedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "difference" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "closedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CashClosing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashMovement_occurredAt_idx" ON "CashMovement"("occurredAt");
CREATE INDEX "CashMovement_type_idx" ON "CashMovement"("type");
CREATE INDEX "CashMovement_category_idx" ON "CashMovement"("category");
CREATE INDEX "CashMovement_paymentMethod_idx" ON "CashMovement"("paymentMethod");
CREATE INDEX "CashMovement_clientId_idx" ON "CashMovement"("clientId");
CREATE INDEX "CashMovement_petId_idx" ON "CashMovement"("petId");
CREATE UNIQUE INDEX "CashClosing_businessDate_key" ON "CashClosing"("businessDate");
CREATE INDEX "CashClosing_businessDate_idx" ON "CashClosing"("businessDate");

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CashClosing" ADD CONSTRAINT "CashClosing_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
