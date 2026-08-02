import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import {
  generateOriginalConsultationPdf,
  generateOriginalHistoryPdf,
  generateOriginalPrescriptionPdf,
  generateOriginalSurgeryPdf,
} from './originalDocuments.js';

const publicRoot = fileURLToPath(new URL('../../../public/', import.meta.url));
const pet = { id: 'pet-qa-12345678', name: 'Luna', species: 'Perro', breed: 'Criollo', sex: 'FEMALE', age: '4 años', color: 'Marrón', weightKg: 12.4 };
const client = { fullName: 'Cliente de prueba', phone: '999999999', documentNumber: '12345678', address: 'Cayma, Arequipa' };
const consultation = {
  date: '02/08/2026', weight: 12.4, temperature: 38.5, fc: '90', fr: '24', mucosas: 'Rosadas',
  anamnesis: 'Paciente alerta. Apetito disminuido desde ayer.', presumptiveDx: 'Gastritis', definitiveDx: 'Gastritis leve',
  treatment: 'Dieta blanda e hidratación.', frequency: 'Control en 48 horas', recommendations: 'Vigilar apetito.',
  exams: { hemograma: true, ecografia: true },
};

before(() => {
  globalThis.fetch = async value => {
    const relative = String(value).replace(/^\//, '');
    const bytes = await readFile(`${publicRoot}${relative.replaceAll('/', '\\')}`);
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    };
  };
});

async function assertPdf(bytes, pages) {
  assert.equal(Buffer.from(bytes).subarray(0, 4).toString(), '%PDF');
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), pages);
}

test('genera la consulta en dos páginas A4', async () => {
  const bytes = await generateOriginalConsultationPdf({ pet, client, consultation, preventive: [], doctor: 'Dra. Happy Dog', returnBytes: true });
  await assertPdf(bytes, 2);
});

test('genera el historial acumulativo con una página por consulta', async () => {
  const bytes = await generateOriginalHistoryPdf({ pet, client, consultations: [consultation, consultation], preventive: [], entryDate: '01/08/2026', returnBytes: true });
  await assertPdf(bytes, 3);
});

test('genera una receta PDF real en una sola página', async () => {
  const bytes = await generateOriginalPrescriptionPdf({
    pet, client, doctor: 'Dra. Happy Dog', date: '02/08/2026', returnBytes: true,
    prescription: { name: 'Amoxicilina', quantity: 10, dosage: '1 tableta cada 12 horas', instructions: 'Administrar después de comer durante 5 días.' },
    evaluation: { reason: 'Apetito disminuido', diagnosis: 'Gastritis leve', treatment: 'Dieta blanda', weight: 12.4 },
  });
  await assertPdf(bytes, 1);
});

test('genera la autorización de esterilización en una sola página', async () => {
  const bytes = await generateOriginalSurgeryPdf({
    pet, client, date: '02/08/2026', returnBytes: true,
    consent: { ownerDni: '12345678', ownerAddress: 'Cayma, Arequipa', lastMeal: '01/08/2026 20:00', petAge: '4 años', petColor: 'Marrón' },
  });
  await assertPdf(bytes, 1);
});
