-- One-time production cleanup requested after the end-to-end QA runs.
-- Only rows carrying explicit QA/E2E markers are selected; real clients and pets
-- such as GUEDSON, Sasha and Popy are intentionally outside these predicates.

CREATE TEMP TABLE "_cleanup_test_users" ON COMMIT DROP AS
SELECT "id"
FROM "User"
WHERE "fullName" ILIKE 'QA %'
   OR "email" ILIKE 'qa.%@example.com';

CREATE TEMP TABLE "_cleanup_test_clients" ON COMMIT DROP AS
SELECT "id"
FROM "Client"
WHERE "fullName" ILIKE 'QA %'
   OR "fullName" ILIKE 'Prueba Flujo %'
   OR "email" ILIKE 'qa.%@example.com'
   OR "documentNumber" ILIKE 'QA%';

CREATE TEMP TABLE "_cleanup_test_pets" ON COMMIT DROP AS
SELECT "id"
FROM "Pet"
WHERE "clientId" IN (SELECT "id" FROM "_cleanup_test_clients")
   OR "name" ILIKE 'QA %'
   OR "name" ILIKE 'Mascota E2E %';

CREATE TEMP TABLE "_cleanup_test_products" ON COMMIT DROP AS
SELECT "id"
FROM "Product"
WHERE "name" ILIKE 'QA %'
   OR "sku" ILIKE 'QA-%'
   OR "brand" ILIKE '% QA'
   OR "description" ILIKE '%prueba%';

CREATE TEMP TABLE "_cleanup_test_appointments" ON COMMIT DROP AS
SELECT "id"
FROM "Appointment"
WHERE "clientId" IN (SELECT "id" FROM "_cleanup_test_clients")
   OR "petId" IN (SELECT "id" FROM "_cleanup_test_pets")
   OR "veterinarianId" IN (SELECT "id" FROM "_cleanup_test_users")
   OR "reason" ILIKE 'QA %'
   OR "reason" ILIKE '% QA %'
   OR "notes" ILIKE '%QA%';

CREATE TEMP TABLE "_cleanup_test_records" ON COMMIT DROP AS
SELECT DISTINCT mr."id"
FROM "MedicalRecord" mr
LEFT JOIN "PrescriptionItem" pi ON pi."medicalRecordId" = mr."id"
WHERE mr."appointmentId" IN (SELECT "id" FROM "_cleanup_test_appointments")
   OR mr."petId" IN (SELECT "id" FROM "_cleanup_test_pets")
   OR mr."veterinarianId" IN (SELECT "id" FROM "_cleanup_test_users")
   OR pi."productId" IN (SELECT "id" FROM "_cleanup_test_products")
   OR mr."reason" ILIKE '%QA%';

-- A medical record authored by a QA account makes its backing appointment part
-- of the same test flow, even when a real pet was temporarily used for testing.
INSERT INTO "_cleanup_test_appointments" ("id")
SELECT DISTINCT mr."appointmentId"
FROM "MedicalRecord" mr
WHERE mr."id" IN (SELECT "id" FROM "_cleanup_test_records")
  AND mr."appointmentId" NOT IN (SELECT "id" FROM "_cleanup_test_appointments");

CREATE TEMP TABLE "_cleanup_test_sales" ON COMMIT DROP AS
SELECT DISTINCT s."id"
FROM "Sale" s
LEFT JOIN "SaleItem" si ON si."saleId" = s."id"
WHERE s."clientId" IN (SELECT "id" FROM "_cleanup_test_clients")
   OR s."appointmentId" IN (SELECT "id" FROM "_cleanup_test_appointments")
   OR s."cashierId" IN (SELECT "id" FROM "_cleanup_test_users")
   OR si."productId" IN (SELECT "id" FROM "_cleanup_test_products")
   OR si."description" ILIKE '%QA%'
   OR si."description" ILIKE '%Prueba Flujo%';

DELETE FROM "ClinicalFile"
WHERE "medicalRecordId" IN (SELECT "id" FROM "_cleanup_test_records");

DELETE FROM "PrescriptionItem"
WHERE "medicalRecordId" IN (SELECT "id" FROM "_cleanup_test_records")
   OR "productId" IN (SELECT "id" FROM "_cleanup_test_products");

DELETE FROM "InventoryMovement"
WHERE "productId" IN (SELECT "id" FROM "_cleanup_test_products")
   OR "referenceId" IN (SELECT "id" FROM "_cleanup_test_records")
   OR "referenceId" IN (SELECT "id" FROM "_cleanup_test_sales");

DELETE FROM "CashMovement"
WHERE "clientId" IN (SELECT "id" FROM "_cleanup_test_clients")
   OR "petId" IN (SELECT "id" FROM "_cleanup_test_pets")
   OR "appointmentId" IN (SELECT "id" FROM "_cleanup_test_appointments")
   OR "productId" IN (SELECT "id" FROM "_cleanup_test_products")
   OR "saleId" IN (SELECT "id" FROM "_cleanup_test_sales")
   OR "registeredById" IN (SELECT "id" FROM "_cleanup_test_users")
   OR "description" ILIKE '%QA%'
   OR "clientName" ILIKE 'QA %'
   OR "clientName" ILIKE 'Prueba Flujo %'
   OR "petName" ILIKE 'QA %'
   OR "petName" ILIKE 'Mascota E2E %';

DELETE FROM "SaleItem"
WHERE "saleId" IN (SELECT "id" FROM "_cleanup_test_sales");

DELETE FROM "Sale"
WHERE "id" IN (SELECT "id" FROM "_cleanup_test_sales");

DELETE FROM "MedicalRecord"
WHERE "id" IN (SELECT "id" FROM "_cleanup_test_records");

DELETE FROM "PreventiveCareRecord"
WHERE "petId" IN (SELECT "id" FROM "_cleanup_test_pets")
   OR "veterinarianId" IN (SELECT "id" FROM "_cleanup_test_users")
   OR "productName" ILIKE '%QA%'
   OR "notes" ILIKE '%QA%';

DELETE FROM "Appointment"
WHERE "id" IN (SELECT "id" FROM "_cleanup_test_appointments");

DELETE FROM "Pet"
WHERE "id" IN (SELECT "id" FROM "_cleanup_test_pets");

DELETE FROM "Client"
WHERE "id" IN (SELECT "id" FROM "_cleanup_test_clients");

DELETE FROM "Product"
WHERE "id" IN (SELECT "id" FROM "_cleanup_test_products");

DELETE FROM "CashClosing"
WHERE "closedById" IN (SELECT "id" FROM "_cleanup_test_users");

DELETE FROM "User"
WHERE "id" IN (SELECT "id" FROM "_cleanup_test_users");
