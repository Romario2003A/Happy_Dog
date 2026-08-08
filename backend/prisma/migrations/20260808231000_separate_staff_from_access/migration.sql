CREATE TABLE "StaffMember" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "documentNumber" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "workSchedule" TEXT,
    "bankAccount" TEXT,
    "monthlySalary" DECIMAL(10,2),
    "payDay" TEXT,
    "payrollReminder" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffMember_userId_key" ON "StaffMember"("userId");
CREATE INDEX "StaffMember_fullName_idx" ON "StaffMember"("fullName");
CREATE INDEX "StaffMember_jobTitle_idx" ON "StaffMember"("jobTitle");
CREATE INDEX "StaffMember_active_idx" ON "StaffMember"("active");

INSERT INTO "StaffMember" (
    "id", "fullName", "jobTitle", "active", "workSchedule", "bankAccount",
    "monthlySalary", "payDay", "payrollReminder", "userId", "createdAt", "updatedAt"
)
SELECT
    "id",
    "fullName",
    CASE "role"::text
      WHEN 'VETERINARIAN' THEN 'Veterinaria/o'
      WHEN 'RECEPTIONIST' THEN 'Recepción'
      WHEN 'ADMIN' THEN 'Administración'
      ELSE 'Personal'
    END,
    "active", "workSchedule", "bankAccount", "monthlySalary", "payDay",
    "payrollReminder", "id", "createdAt", "updatedAt"
FROM "User"
WHERE "role"::text <> 'CLIENT'
  AND EXISTS (SELECT 1 FROM "PayrollPayment" WHERE "PayrollPayment"."staffId" = "User"."id");

ALTER TABLE "PayrollPayment" DROP CONSTRAINT "PayrollPayment_staffId_fkey";

ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayrollPayment" ADD CONSTRAINT "PayrollPayment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
