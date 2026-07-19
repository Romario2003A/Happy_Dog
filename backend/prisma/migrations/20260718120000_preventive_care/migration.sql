CREATE TYPE "PreventiveCareType" AS ENUM ('VACCINE', 'DEWORMING');
CREATE TABLE "PreventiveCareRecord" ("id" TEXT NOT NULL,"type" "PreventiveCareType" NOT NULL,"appliedAt" TIMESTAMP(3) NOT NULL,"productName" TEXT NOT NULL,"weightKg" DOUBLE PRECISION,"nextAppointmentAt" TIMESTAMP(3),"notes" TEXT,"petId" TEXT NOT NULL,"veterinarianId" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "PreventiveCareRecord_pkey" PRIMARY KEY ("id"));
CREATE INDEX "PreventiveCareRecord_petId_type_idx" ON "PreventiveCareRecord"("petId","type");
CREATE INDEX "PreventiveCareRecord_appliedAt_idx" ON "PreventiveCareRecord"("appliedAt");
ALTER TABLE "PreventiveCareRecord" ADD CONSTRAINT "PreventiveCareRecord_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PreventiveCareRecord" ADD CONSTRAINT "PreventiveCareRecord_veterinarianId_fkey" FOREIGN KEY ("veterinarianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
