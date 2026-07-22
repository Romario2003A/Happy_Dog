ALTER TABLE "User"
  ADD COLUMN "workSchedule" TEXT,
  ADD COLUMN "bankAccount" TEXT,
  ADD COLUMN "monthlySalary" DECIMAL(10,2),
  ADD COLUMN "payDay" TEXT,
  ADD COLUMN "payrollReminder" TEXT;
