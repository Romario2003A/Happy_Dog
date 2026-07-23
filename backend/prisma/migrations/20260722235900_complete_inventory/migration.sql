ALTER TABLE "Product"
  ADD COLUMN "brand" TEXT,
  ADD COLUMN "presentation" TEXT,
  ADD COLUMN "supplier" TEXT,
  ADD COLUMN "purchasePrice" DECIMAL(10,2),
  ADD COLUMN "batchNumber" TEXT;

CREATE INDEX "Product_expirationDate_idx" ON "Product"("expirationDate");
