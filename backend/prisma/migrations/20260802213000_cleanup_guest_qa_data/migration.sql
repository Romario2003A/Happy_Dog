-- Remove only the two guest appointments created to verify the unauthenticated flow.
-- Production clients, pets, appointments and catalog data remain intact.

CREATE TEMP TABLE "_guest_qa_clients" ON COMMIT DROP AS
SELECT "id" FROM "Client"
WHERE "phone" IN ('900000203', '900000204')
   OR "fullName" IN ('QA Invitado Sin Sesión', 'QA Invitado Tarifario');

CREATE TEMP TABLE "_guest_qa_pets" ON COMMIT DROP AS
SELECT "id" FROM "Pet"
WHERE "clientId" IN (SELECT "id" FROM "_guest_qa_clients")
   OR "name" IN ('Toby QA', 'Lola QA');

CREATE TEMP TABLE "_guest_qa_appointments" ON COMMIT DROP AS
SELECT "id" FROM "Appointment"
WHERE "clientId" IN (SELECT "id" FROM "_guest_qa_clients")
   OR "petId" IN (SELECT "id" FROM "_guest_qa_pets");

CREATE TEMP TABLE "_guest_qa_records" ON COMMIT DROP AS
SELECT "id" FROM "MedicalRecord"
WHERE "appointmentId" IN (SELECT "id" FROM "_guest_qa_appointments")
   OR "petId" IN (SELECT "id" FROM "_guest_qa_pets");

CREATE TEMP TABLE "_guest_qa_sales" ON COMMIT DROP AS
SELECT "id" FROM "Sale"
WHERE "clientId" IN (SELECT "id" FROM "_guest_qa_clients")
   OR "appointmentId" IN (SELECT "id" FROM "_guest_qa_appointments");

DELETE FROM "ClinicalFile"
WHERE "medicalRecordId" IN (SELECT "id" FROM "_guest_qa_records");

DELETE FROM "PrescriptionItem"
WHERE "medicalRecordId" IN (SELECT "id" FROM "_guest_qa_records");

DELETE FROM "InventoryMovement"
WHERE "referenceId" IN (SELECT "id" FROM "_guest_qa_records")
   OR "referenceId" IN (SELECT "id" FROM "_guest_qa_sales");

DELETE FROM "CashMovement"
WHERE "clientId" IN (SELECT "id" FROM "_guest_qa_clients")
   OR "petId" IN (SELECT "id" FROM "_guest_qa_pets")
   OR "appointmentId" IN (SELECT "id" FROM "_guest_qa_appointments")
   OR "saleId" IN (SELECT "id" FROM "_guest_qa_sales");

DELETE FROM "SaleItem"
WHERE "saleId" IN (SELECT "id" FROM "_guest_qa_sales");

DELETE FROM "Sale"
WHERE "id" IN (SELECT "id" FROM "_guest_qa_sales");

DELETE FROM "MedicalRecord"
WHERE "id" IN (SELECT "id" FROM "_guest_qa_records");

DELETE FROM "PreventiveCareRecord"
WHERE "petId" IN (SELECT "id" FROM "_guest_qa_pets");

DELETE FROM "Appointment"
WHERE "id" IN (SELECT "id" FROM "_guest_qa_appointments");

DELETE FROM "Pet"
WHERE "id" IN (SELECT "id" FROM "_guest_qa_pets");

DELETE FROM "Client"
WHERE "id" IN (SELECT "id" FROM "_guest_qa_clients");
