-- Remove only the records created by the linked cash workflow verification.
-- Production clients, appointments, services, inventory and cash data remain intact.

CREATE TEMP TABLE "_cash_qa_clients" ON COMMIT DROP AS
SELECT "id" FROM "Client"
WHERE "phone" = '900000205'
   OR "fullName" = 'QA Caja Flujo';

CREATE TEMP TABLE "_cash_qa_pets" ON COMMIT DROP AS
SELECT "id" FROM "Pet"
WHERE "clientId" IN (SELECT "id" FROM "_cash_qa_clients")
   OR "name" = 'Milo Caja QA';

CREATE TEMP TABLE "_cash_qa_appointments" ON COMMIT DROP AS
SELECT "id" FROM "Appointment"
WHERE "clientId" IN (SELECT "id" FROM "_cash_qa_clients")
   OR "petId" IN (SELECT "id" FROM "_cash_qa_pets");

CREATE TEMP TABLE "_cash_qa_records" ON COMMIT DROP AS
SELECT "id" FROM "MedicalRecord"
WHERE "appointmentId" IN (SELECT "id" FROM "_cash_qa_appointments")
   OR "petId" IN (SELECT "id" FROM "_cash_qa_pets");

CREATE TEMP TABLE "_cash_qa_sales" ON COMMIT DROP AS
SELECT "id" FROM "Sale"
WHERE "clientId" IN (SELECT "id" FROM "_cash_qa_clients")
   OR "appointmentId" IN (SELECT "id" FROM "_cash_qa_appointments");

DELETE FROM "ClinicalFile"
WHERE "medicalRecordId" IN (SELECT "id" FROM "_cash_qa_records");

DELETE FROM "PrescriptionItem"
WHERE "medicalRecordId" IN (SELECT "id" FROM "_cash_qa_records");

DELETE FROM "InventoryMovement"
WHERE "referenceId" IN (SELECT "id" FROM "_cash_qa_records")
   OR "referenceId" IN (SELECT "id" FROM "_cash_qa_sales");

DELETE FROM "CashMovement"
WHERE "clientId" IN (SELECT "id" FROM "_cash_qa_clients")
   OR "petId" IN (SELECT "id" FROM "_cash_qa_pets")
   OR "appointmentId" IN (SELECT "id" FROM "_cash_qa_appointments")
   OR "saleId" IN (SELECT "id" FROM "_cash_qa_sales")
   OR "clientName" = 'QA Caja Flujo'
   OR "petName" = 'Milo Caja QA';

DELETE FROM "SaleItem"
WHERE "saleId" IN (SELECT "id" FROM "_cash_qa_sales");

DELETE FROM "Sale"
WHERE "id" IN (SELECT "id" FROM "_cash_qa_sales");

DELETE FROM "MedicalRecord"
WHERE "id" IN (SELECT "id" FROM "_cash_qa_records");

DELETE FROM "PreventiveCareRecord"
WHERE "petId" IN (SELECT "id" FROM "_cash_qa_pets");

DELETE FROM "Appointment"
WHERE "id" IN (SELECT "id" FROM "_cash_qa_appointments");

DELETE FROM "Pet"
WHERE "id" IN (SELECT "id" FROM "_cash_qa_pets");

DELETE FROM "Client"
WHERE "id" IN (SELECT "id" FROM "_cash_qa_clients");
