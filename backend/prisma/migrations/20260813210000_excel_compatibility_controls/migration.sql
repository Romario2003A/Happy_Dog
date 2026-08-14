-- Add operational controls previously tracked in the CAJA 2026 workbook.
ALTER TABLE "Pet"
ADD COLUMN "recordNumber" SERIAL NOT NULL;

CREATE UNIQUE INDEX "Pet_recordNumber_key" ON "Pet"("recordNumber");

ALTER TABLE "Appointment"
ADD COLUMN "campaignName" TEXT;

ALTER TABLE "MedicalRecord"
ADD COLUMN "sutureRemovalAt" TIMESTAMP(3),
ADD COLUMN "sutureRemovalCompletedAt" TIMESTAMP(3);

CREATE INDEX "MedicalRecord_sutureRemovalAt_idx" ON "MedicalRecord"("sutureRemovalAt");

ALTER TABLE "CashMovement"
ADD COLUMN "affectsCash" BOOLEAN NOT NULL DEFAULT true;
