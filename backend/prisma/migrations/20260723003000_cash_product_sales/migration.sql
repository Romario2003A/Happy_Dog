ALTER TABLE "CashMovement"
  ADD COLUMN "productId" TEXT,
  ADD COLUMN "productQuantity" INTEGER;

CREATE INDEX "CashMovement_productId_idx" ON "CashMovement"("productId");

ALTER TABLE "CashMovement"
  ADD CONSTRAINT "CashMovement_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
