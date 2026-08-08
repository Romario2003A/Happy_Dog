CREATE TYPE "PayrollPaymentStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

ALTER TYPE "CashMovementCategory" ADD VALUE IF NOT EXISTS 'PAYROLL';

CREATE TABLE "PayrollPayment" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "PayrollPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "paymentMethod" "PaymentMethod",
    "referenceCode" TEXT,
    "notes" TEXT,
    "staffId" TEXT NOT NULL,
    "registeredById" TEXT,
    "cashMovementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayrollPayment_cashMovementId_key" ON "PayrollPayment"("cashMovementId");
CREATE UNIQUE INDEX "PayrollPayment_staffId_period_key" ON "PayrollPayment"("staffId", "period");
CREATE INDEX "PayrollPayment_period_status_idx" ON "PayrollPayment"("period", "status");
CREATE INDEX "PayrollPayment_staffId_idx" ON "PayrollPayment"("staffId");

ALTER TABLE "PayrollPayment" ADD CONSTRAINT "PayrollPayment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollPayment" ADD CONSTRAINT "PayrollPayment_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayrollPayment" ADD CONSTRAINT "PayrollPayment_cashMovementId_fkey" FOREIGN KEY ("cashMovementId") REFERENCES "CashMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
