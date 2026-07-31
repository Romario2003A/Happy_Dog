-- Correct services imported under a stale spreadsheet section.
UPDATE "Service"
SET "category" = 'CONSULTAS'
WHERE UPPER("name") LIKE 'INFORME MEDICO%';

UPDATE "Service"
SET "category" = 'TRATAMIENTOS'
WHERE UPPER("name") LIKE 'NEBULIZACION%';
