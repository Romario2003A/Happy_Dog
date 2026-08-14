CREATE TYPE "ObligationRecurrence" AS ENUM ('MONTHLY', 'ONE_TIME');

ALTER TABLE "Appointment"
ADD COLUMN "assignedStaffId" TEXT,
ADD COLUMN "pickedUpAt" TIMESTAMP(3);

CREATE INDEX "Appointment_assignedStaffId_idx" ON "Appointment"("assignedStaffId");
CREATE INDEX "Appointment_pickupAt_idx" ON "Appointment"("pickupAt");

ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_assignedStaffId_fkey"
FOREIGN KEY ("assignedStaffId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "BusinessObligation" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "payee" TEXT,
  "category" TEXT,
  "amount" DECIMAL(10,2) NOT NULL,
  "nextDueAt" TIMESTAMP(3) NOT NULL,
  "recurrence" "ObligationRecurrence" NOT NULL DEFAULT 'MONTHLY',
  "referenceCode" TEXT,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastPaidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessObligation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BusinessObligation_nextDueAt_active_idx" ON "BusinessObligation"("nextDueAt", "active");

ALTER TABLE "CashMovement" ADD COLUMN "obligationId" TEXT;
CREATE INDEX "CashMovement_obligationId_idx" ON "CashMovement"("obligationId");
ALTER TABLE "CashMovement"
ADD CONSTRAINT "CashMovement_obligationId_fkey"
FOREIGN KEY ("obligationId") REFERENCES "BusinessObligation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
