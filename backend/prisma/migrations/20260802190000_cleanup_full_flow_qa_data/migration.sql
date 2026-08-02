-- Remove only records created by the 2026-08-02 full workflow verification.
-- Production clients, pets, staff, catalog services and financial data remain intact.

CREATE TEMP TABLE "_flow_qa_users" ON COMMIT DROP AS
SELECT "id" FROM "User"
WHERE "fullName" ILIKE 'QA %'
   OR "email" ILIKE 'qa.%@example.com';

CREATE TEMP TABLE "_flow_qa_clients" ON COMMIT DROP AS
SELECT "id" FROM "Client"
WHERE "fullName" ILIKE 'QA %'
   OR "phone" IN ('900000201', '900000202')
   OR "email" ILIKE 'qa.%@example.com';

CREATE TEMP TABLE "_flow_qa_pets" ON COMMIT DROP AS
SELECT "id" FROM "Pet"
WHERE "clientId" IN (SELECT "id" FROM "_flow_qa_clients")
   OR "name" ILIKE '% QA';

CREATE TEMP TABLE "_flow_qa_products" ON COMMIT DROP AS
SELECT "id" FROM "Product"
WHERE "name" ILIKE 'QA %'
   OR "sku" ILIKE 'QA-%'
   OR "description" ILIKE '%QA prueba%';

CREATE TEMP TABLE "_flow_qa_appointments" ON COMMIT DROP AS
SELECT "id" FROM "Appointment"
WHERE "clientId" IN (SELECT "id" FROM "_flow_qa_clients")
   OR "petId" IN (SELECT "id" FROM "_flow_qa_pets")
   OR "veterinarianId" IN (SELECT "id" FROM "_flow_qa_users")
   OR "reason" ILIKE 'QA %'
   OR "notes" ILIKE '%QA%';

CREATE TEMP TABLE "_flow_qa_records" ON COMMIT DROP AS
SELECT DISTINCT mr."id"
FROM "MedicalRecord" mr
LEFT JOIN "PrescriptionItem" pi ON pi."medicalRecordId" = mr."id"
WHERE mr."appointmentId" IN (SELECT "id" FROM "_flow_qa_appointments")
   OR mr."petId" IN (SELECT "id" FROM "_flow_qa_pets")
   OR mr."veterinarianId" IN (SELECT "id" FROM "_flow_qa_users")
   OR pi."productId" IN (SELECT "id" FROM "_flow_qa_products")
   OR mr."reason" ILIKE '%QA%';

CREATE TEMP TABLE "_flow_qa_sales" ON COMMIT DROP AS
SELECT DISTINCT s."id"
FROM "Sale" s
LEFT JOIN "SaleItem" si ON si."saleId" = s."id"
WHERE s."clientId" IN (SELECT "id" FROM "_flow_qa_clients")
   OR s."appointmentId" IN (SELECT "id" FROM "_flow_qa_appointments")
   OR s."cashierId" IN (SELECT "id" FROM "_flow_qa_users")
   OR si."productId" IN (SELECT "id" FROM "_flow_qa_products")
   OR si."description" ILIKE '%QA%';

DELETE FROM "ClinicalFile"
WHERE "medicalRecordId" IN (SELECT "id" FROM "_flow_qa_records");

DELETE FROM "PrescriptionItem"
WHERE "medicalRecordId" IN (SELECT "id" FROM "_flow_qa_records")
   OR "productId" IN (SELECT "id" FROM "_flow_qa_products");

DELETE FROM "InventoryMovement"
WHERE "productId" IN (SELECT "id" FROM "_flow_qa_products")
   OR "referenceId" IN (SELECT "id" FROM "_flow_qa_records")
   OR "referenceId" IN (SELECT "id" FROM "_flow_qa_sales")
   OR "reason" ILIKE '%QA%';

DELETE FROM "CashMovement"
WHERE "clientId" IN (SELECT "id" FROM "_flow_qa_clients")
   OR "petId" IN (SELECT "id" FROM "_flow_qa_pets")
   OR "appointmentId" IN (SELECT "id" FROM "_flow_qa_appointments")
   OR "productId" IN (SELECT "id" FROM "_flow_qa_products")
   OR "saleId" IN (SELECT "id" FROM "_flow_qa_sales")
   OR "registeredById" IN (SELECT "id" FROM "_flow_qa_users")
   OR "description" ILIKE '%QA%'
   OR "clientName" ILIKE 'QA %'
   OR "petName" ILIKE '% QA';

DELETE FROM "SaleItem"
WHERE "saleId" IN (SELECT "id" FROM "_flow_qa_sales");

DELETE FROM "Sale"
WHERE "id" IN (SELECT "id" FROM "_flow_qa_sales");

DELETE FROM "MedicalRecord"
WHERE "id" IN (SELECT "id" FROM "_flow_qa_records");

DELETE FROM "PreventiveCareRecord"
WHERE "petId" IN (SELECT "id" FROM "_flow_qa_pets")
   OR "veterinarianId" IN (SELECT "id" FROM "_flow_qa_users")
   OR "productName" ILIKE '%QA%'
   OR "notes" ILIKE '%QA%';

DELETE FROM "Appointment"
WHERE "id" IN (SELECT "id" FROM "_flow_qa_appointments");

DELETE FROM "Pet"
WHERE "id" IN (SELECT "id" FROM "_flow_qa_pets");

DELETE FROM "Client"
WHERE "id" IN (SELECT "id" FROM "_flow_qa_clients");

DELETE FROM "Product"
WHERE "id" IN (SELECT "id" FROM "_flow_qa_products");

DELETE FROM "CashClosing"
WHERE "closedById" IN (SELECT "id" FROM "_flow_qa_users");

DELETE FROM "User"
WHERE "id" IN (SELECT "id" FROM "_flow_qa_users");
