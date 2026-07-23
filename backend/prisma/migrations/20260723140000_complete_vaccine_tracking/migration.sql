ALTER TABLE "PreventiveCareRecord"
ADD COLUMN "dewormed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "followUpCalled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sterilizationCallDone" BOOLEAN NOT NULL DEFAULT false;
