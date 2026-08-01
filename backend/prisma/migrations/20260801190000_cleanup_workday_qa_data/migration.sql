-- Remove only the records created by the 2026-08-01 end-to-end workday test.
-- Real clients and pets are preserved. The single appointment made with a real
-- client is identified by its exact QA reason.

CREATE TEMP TABLE "_workday_qa_clients" ON COMMIT DROP AS
SELECT "id"
FROM "Client"
WHERE "fullName" IN (
  'QA Consulta Happy Dog',
  'QA Vacuna Happy Dog',
  'QA Baño Happy Dog',
  'QA Cirugía Happy Dog'
)
OR "phone" IN ('900000101', '900000102', '900000103', '900000104');

CREATE TEMP TABLE "_workday_qa_pets" ON COMMIT DROP AS
SELECT "id"
FROM "Pet"
WHERE "clientId" IN (SELECT "id" FROM "_workday_qa_clients");

CREATE TEMP TABLE "_workday_qa_appointments" ON COMMIT DROP AS
SELECT "id"
FROM "Appointment"
WHERE "clientId" IN (SELECT "id" FROM "_workday_qa_clients")
   OR "petId" IN (SELECT "id" FROM "_workday_qa_pets")
   OR "reason" = 'QA solicitud web sin doctor';

CREATE TEMP TABLE "_workday_qa_records" ON COMMIT DROP AS
SELECT "id"
FROM "MedicalRecord"
WHERE "appointmentId" IN (SELECT "id" FROM "_workday_qa_appointments")
   OR "petId" IN (SELECT "id" FROM "_workday_qa_pets");

CREATE TEMP TABLE "_workday_qa_sales" ON COMMIT DROP AS
SELECT "id"
FROM "Sale"
WHERE "clientId" IN (SELECT "id" FROM "_workday_qa_clients")
   OR "appointmentId" IN (SELECT "id" FROM "_workday_qa_appointments");

DELETE FROM "ClinicalFile"
WHERE "medicalRecordId" IN (SELECT "id" FROM "_workday_qa_records");

DELETE FROM "PrescriptionItem"
WHERE "medicalRecordId" IN (SELECT "id" FROM "_workday_qa_records");

DELETE FROM "InventoryMovement"
WHERE "referenceId" IN (SELECT "id" FROM "_workday_qa_records")
   OR "referenceId" IN (SELECT "id" FROM "_workday_qa_sales");

DELETE FROM "CashMovement"
WHERE "clientId" IN (SELECT "id" FROM "_workday_qa_clients")
   OR "petId" IN (SELECT "id" FROM "_workday_qa_pets")
   OR "appointmentId" IN (SELECT "id" FROM "_workday_qa_appointments")
   OR "saleId" IN (SELECT "id" FROM "_workday_qa_sales");

DELETE FROM "SaleItem"
WHERE "saleId" IN (SELECT "id" FROM "_workday_qa_sales");

DELETE FROM "Sale"
WHERE "id" IN (SELECT "id" FROM "_workday_qa_sales");

DELETE FROM "MedicalRecord"
WHERE "id" IN (SELECT "id" FROM "_workday_qa_records");

DELETE FROM "PreventiveCareRecord"
WHERE "petId" IN (SELECT "id" FROM "_workday_qa_pets");

DELETE FROM "Appointment"
WHERE "id" IN (SELECT "id" FROM "_workday_qa_appointments");

DELETE FROM "Pet"
WHERE "id" IN (SELECT "id" FROM "_workday_qa_pets");

DELETE FROM "Client"
WHERE "id" IN (SELECT "id" FROM "_workday_qa_clients");
