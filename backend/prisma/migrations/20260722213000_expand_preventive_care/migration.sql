ALTER TABLE "PreventiveCareRecord"
  ADD COLUMN "nextProductName" TEXT,
  ADD COLUMN "amountCharged" DECIMAL(10,2),
  ADD COLUMN "sterilizationRecommended" BOOLEAN NOT NULL DEFAULT false;
