-- Leave the production workspace empty while preserving access accounts,
-- the service catalog and application configuration.
-- This reset is intentionally global: the current customer and operational
-- records were created while testing the application.

BEGIN;

DELETE FROM "ClinicalFile";
DELETE FROM "PrescriptionItem";
DELETE FROM "MedicalRecord";
DELETE FROM "PreventiveCareRecord";

DELETE FROM "CashMovement";
DELETE FROM "SaleItem";
DELETE FROM "Sale";

DELETE FROM "InventoryMovement";
DELETE FROM "Appointment";
DELETE FROM "Pet";
DELETE FROM "Client";

DELETE FROM "CashClosing";
DELETE FROM "Product";

COMMIT;
