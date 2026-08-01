let pdfLibPromise;

function loadPdfLib() {
  if (!pdfLibPromise) pdfLibPromise = import('pdf-lib');
  return pdfLibPromise;
}

const ORIGINALS = {
  consultation: '/documents/historia-clinica-consulta-original.pdf',
  history: '/documents/historia-clinica-acumulativa-original.pdf',
  surgery: '/documents/autorizacion-esterilizacion-castracion-original.png',
};

async function fetchBytes(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`No se pudo cargar la plantilla original (${response.status}).`);
  return response.arrayBuffer();
}

function safeText(value) {
  return String(value ?? '')
    .replace(/\r/g, '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2013|\u2014/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '');
}

function fitText(text, font, size, maxWidth) {
  const value = safeText(text);
  if (!maxWidth || font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  let result = value;
  while (result.length && font.widthOfTextAtSize(`${result}...`, size) > maxWidth) result = result.slice(0, -1);
  return result ? `${result}...` : '';
}

function draw(page, font, value, x, y, options = {}) {
  if (value === undefined || value === null || value === '') return;
  const size = options.size || 7.5;
  page.drawText(fitText(value, font, size, options.maxWidth), {
    x, y, size, font, color: options.color,
  });
}

function wrapText(value, font, size, maxWidth, maxLines) {
  const paragraphs = safeText(value).split('\n');
  const lines = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
      else {
        if (line) lines.push(line);
        line = word;
      }
      if (lines.length >= maxLines) break;
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (lines.length >= maxLines) break;
  }
  if (lines.length === maxLines && paragraphs.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = fitText(`${lines[maxLines - 1]}...`, font, size, maxWidth);
  }
  return lines;
}

function drawBlock(page, font, value, x, topY, maxWidth, options = {}) {
  const size = options.size || 7;
  const lineHeight = options.lineHeight || size * 1.25;
  const maxLines = options.maxLines || 6;
  wrapText(value, font, size, maxWidth, maxLines).forEach((line, index) => {
    draw(page, font, line, x, topY - (index * lineHeight), { size, maxWidth });
  });
}

function mark(page, font, checked, x, y, size = 10) {
  if (checked) draw(page, font, 'X', x, y, { size });
}

function openGeneratedPdf(bytes, fileName) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const preview = window.open(url, '_blank', 'noopener,noreferrer');
  if (!preview) {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

function historyCode(pet) {
  return safeText(pet?.id || '').replace(/-/g, '').slice(0, 8).toUpperCase();
}

function sexFlags(pet) {
  const value = safeText(pet?.sex).toLowerCase();
  return {
    male: value === 'male' || value.includes('macho') || value === 'm',
    female: value === 'female' || value.includes('hembra') || value === 'f',
  };
}

function speciesFlags(pet) {
  const value = safeText(pet?.species).toLowerCase();
  return {
    cat: value.includes('gato') || value.includes('felino') || value.includes('cat'),
    dog: value.includes('perro') || value.includes('canino') || value.includes('dog'),
  };
}

function drawConsultationBlock(page, font, consultation, topY) {
  const exams = consultation.exams && typeof consultation.exams === 'object'
    ? Object.entries(consultation.exams).filter(([, selected]) => selected).map(([name]) => name).join(', ')
    : consultation.exams;
  const examText = safeText(exams).toLowerCase();
  const examChecks = [
    ['hemograma', 202, 128], ['urea', 202, 141], ['tgo', 202, 153], ['ecografia', 202, 166],
    ['ecografía', 202, 166], ['rayos', 202, 178], ['heces', 368, 128], ['orina', 368, 141],
    ['citologia', 368, 153], ['citología', 368, 153], ['otros', 368, 166],
  ];
  draw(page, font, consultation.date, 184, topY, { size: 6.5, maxWidth: 47 });
  draw(page, font, consultation.weight, 241, topY, { size: 6.5, maxWidth: 28 });
  draw(page, font, consultation.fc, 319, topY, { size: 6.5, maxWidth: 24 });
  draw(page, font, consultation.fr, 398, topY, { size: 6.5, maxWidth: 24 });
  draw(page, font, consultation.temperature, 477, topY, { size: 6.5, maxWidth: 25 });
  drawBlock(page, font, consultation.anamnesis, 186, topY - 28, 316, { size: 6.5, maxLines: 11, lineHeight: 8 });
  examChecks.forEach(([term, x, offset]) => mark(page, font, examText.includes(term), x, topY - offset, 7));
  draw(page, font, consultation.presumptiveDx, 188, topY - 204, { size: 6.2, maxWidth: 94 });
  draw(page, font, consultation.definitiveDx, 320, topY - 204, { size: 6.2, maxWidth: 181 });
  drawBlock(page, font, consultation.treatment, 185, topY - 234, 315, { size: 6.5, maxLines: 8, lineHeight: 8 });
  draw(page, font, consultation.frequency, 187, topY - 311, { size: 6.5, maxWidth: 313 });
}

export async function generateOriginalConsultationPdf(data) {
  const { PDFDocument, StandardFonts, rgb } = await loadPdfLib();
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(await fetchBytes('/documents/happy-dog-pdf-logo.png'));
  const page1 = pdf.addPage([595.32, 841.92]);
  const page2 = pdf.addPage([595.32, 841.92]);
  const { pet = {}, client = {}, consultation = {}, preventive = [], doctor = '' } = data;
  const sex = sexFlags(pet);
  const colors = {
    teal: rgb(0.082, 0.357, 0.4),
    mint: rgb(0.52, 0.82, 0.66),
    pale: rgb(0.94, 0.975, 0.965),
    paleBlue: rgb(0.94, 0.97, 0.975),
    ink: rgb(0.08, 0.14, 0.13),
    muted: rgb(0.36, 0.44, 0.42),
    line: rgb(0.76, 0.84, 0.82),
    white: rgb(1, 1, 1),
  };
  const margin = 36;
  const contentWidth = 523.32;
  const sectionTitle = (page, title, y) => {
    page.drawRectangle({ x: margin, y, width: contentWidth, height: 20, color: colors.pale });
    page.drawRectangle({ x: margin, y, width: 4, height: 20, color: colors.mint });
    draw(page, bold, title.toUpperCase(), margin + 12, y + 6, { size: 8.5, maxWidth: contentWidth - 20 });
  };
  const field = (page, label, value, x, y, width, height = 28) => {
    page.drawRectangle({ x, y, width, height, color: colors.white, borderColor: colors.line, borderWidth: 0.7 });
    draw(page, bold, safeText(label).toUpperCase(), x + 7, y + height - 10, { size: 5.8, maxWidth: width - 14 });
    draw(page, font, value || '-', x + 7, y + 7, { size: 8, maxWidth: width - 14 });
  };
  const textBox = (page, label, value, x, y, width, height, options = {}) => {
    page.drawRectangle({ x, y, width, height, color: options.color || colors.white, borderColor: colors.line, borderWidth: 0.7 });
    draw(page, bold, safeText(label).toUpperCase(), x + 8, y + height - 13, { size: 6.5, maxWidth: width - 16 });
    drawBlock(page, font, value || '-', x + 8, y + height - 28, width - 16, {
      size: options.size || 7.5,
      lineHeight: options.lineHeight || 9,
      maxLines: options.maxLines || Math.max(1, Math.floor((height - 32) / 9)),
    });
  };
  const header = (page, subtitle, pageNumber) => {
    page.drawRectangle({ x: margin, y: 754, width: contentWidth, height: 62, color: colors.paleBlue });
    page.drawRectangle({ x: margin, y: 754, width: 7, height: 62, color: colors.teal });
    page.drawImage(logo, { x: 48, y: 761, width: 48, height: 48 });
    draw(page, bold, 'HAPPY DOG', 110, 791, { size: 17, maxWidth: 180, color: colors.teal });
    draw(page, font, subtitle, 110, 774, { size: 9, maxWidth: 270, color: colors.muted });
    draw(page, bold, `N. HISTORIA: ${historyCode(pet) || '-'}`, 410, 792, { size: 7.2, maxWidth: 135 });
    draw(page, font, `Fecha: ${consultation.date || '-'}`, 410, 777, { size: 7.2, maxWidth: 135 });
    draw(page, font, `Página ${pageNumber} de 2`, 474, 762, { size: 6.5, maxWidth: 71 });
  };
  const footer = (page) => {
    page.drawLine({ start: { x: margin, y: 25 }, end: { x: margin + contentWidth, y: 25 }, color: colors.line, thickness: 0.7 });
    draw(page, font, 'Historia clínica veterinaria - Happy Dog', margin, 12, { size: 6.3, maxWidth: 250 });
    draw(page, font, 'Documento generado desde el sistema médico', 370, 12, { size: 6.3, maxWidth: 189 });
  };

  header(page1, 'HISTORIA CLÍNICA - CONSULTA MÉDICA', 1);
  sectionTitle(page1, 'Datos del propietario', 724);
  field(page1, 'Nombre', client.fullName, margin, 692, 292, 30);
  field(page1, 'Teléfono', client.phone, 328, 692, 110, 30);
  field(page1, 'DNI', client.documentNumber || client.dni, 438, 692, 121.32, 30);
  field(page1, 'Direccion', client.address, margin, 662, contentWidth, 30);

  sectionTitle(page1, 'Datos del paciente', 635);
  const third = contentWidth / 3;
  field(page1, 'Nombre', pet.name, margin, 603, third, 30);
  field(page1, 'Especie', pet.species, margin + third, 603, third, 30);
  field(page1, 'Raza', pet.breed, margin + third * 2, 603, third, 30);
  field(page1, 'Sexo', sex.female ? 'Hembra' : sex.male ? 'Macho' : pet.sex, margin, 573, third, 30);
  field(page1, 'Edad', pet.age, margin + third, 573, third, 30);
  field(page1, 'Peso', consultation.weight || pet.weightKg ? `${consultation.weight || pet.weightKg} kg` : '-', margin + third * 2, 573, third, 30);
  field(page1, 'Color', pet.color, margin, 543, third, 30);
  field(page1, 'Esterilizado', pet.sterilized === true ? 'Sí' : pet.sterilized === false ? 'No' : '-', margin + third, 543, third, 30);
  field(page1, 'Procedencia', pet.origin, margin + third * 2, 543, third, 30);

  sectionTitle(page1, 'Evaluación de la consulta', 516);
  const vitalWidths = [88, 70, 70, 62, 62, 171.32];
  const vitalLabels = ['Fecha', 'Peso', 'T', 'FC', 'FR', 'Mucosas'];
  const vitalValues = [consultation.date, consultation.weight, consultation.temperature, consultation.fc, consultation.fr, consultation.mucosas];
  let vitalX = margin;
  vitalWidths.forEach((width, index) => {
    field(page1, vitalLabels[index], vitalValues[index], vitalX, 484, width, 30);
    vitalX += width;
  });
  textBox(page1, 'Anamnesis y exploración física', consultation.anamnesis, margin, 391, contentWidth, 85, { maxLines: 6 });

  sectionTitle(page1, 'Exámenes complementarios', 364);
  page1.drawRectangle({ x: margin, y: 299, width: contentWidth, height: 63, color: colors.white, borderColor: colors.line, borderWidth: 0.7 });
  const exams = [
    ['ecografia', 'Ecografía'], ['rayosX', 'Rayos X'], ['hemograma', 'Hemograma'], ['test', 'Test'],
    ['heces', 'Examen de heces'], ['orina', 'Examen de orina'], ['tgoTgpFas', 'TGO, TGP y FAS'],
    ['citologia', 'Citología'], ['raspadoPiel', 'Raspado de piel'], ['ureaCrea', 'Urea y crea'], ['otros', 'Otros'],
  ];
  exams.forEach(([key, label], index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = margin + 10 + column * 172;
    const y = 344 - row * 14;
    page1.drawRectangle({ x, y: y - 1, width: 8, height: 8, borderColor: colors.teal, borderWidth: 0.8, color: consultation.exams?.[key] ? colors.teal : colors.white });
    if (consultation.exams?.[key]) draw(page1, bold, 'X', x + 1.5, y, { size: 5.8 });
    draw(page1, font, label, x + 13, y, { size: 6.8, maxWidth: 150 });
  });
  draw(page1, font, consultation.examOther, 396, 304, { size: 6.5, maxWidth: 145 });

  sectionTitle(page1, 'Diagnóstico y pronóstico', 272);
  textBox(page1, 'DX presuntivo', consultation.presumptiveDx, margin, 224, 261.66, 46, { maxLines: 2, size: 7 });
  textBox(page1, 'DX definitivo', consultation.definitiveDx, 297.66, 224, 261.66, 46, { maxLines: 2, size: 7 });
  textBox(page1, 'Pronostico', consultation.prognosis, margin, 184, contentWidth, 38, { maxLines: 1, size: 7 });

  sectionTitle(page1, 'Plan médico', 157);
  textBox(page1, 'Tratamiento', consultation.treatment, margin, 88, 330, 67, { maxLines: 4, size: 7 });
  textBox(page1, 'Frecuencia', consultation.frequency, 370, 121, 189.32, 34, { maxLines: 1, size: 7 });
  textBox(page1, 'Recomendaciones', consultation.recommendations, 370, 88, 189.32, 32, { maxLines: 1, size: 6.5 });
  draw(page1, bold, 'MÉDICO VETERINARIO', margin, 62, { size: 6.5, maxWidth: 130 });
  draw(page1, font, doctor || '-', 132, 62, { size: 7.5, maxWidth: 205 });
  page1.drawLine({ start: { x: 370, y: 62 }, end: { x: 535, y: 62 }, color: colors.muted, thickness: 0.7 });
  draw(page1, font, 'Firma y sello', 421, 49, { size: 6.2, maxWidth: 90 });
  footer(page1);

  header(page2, 'PREVENCION Y SEGUIMIENTO', 2);
  const table = (title, rows, yTop, emptyProductLabel) => {
    sectionTitle(page2, title, yTop);
    const x = margin;
    const widths = [82, 158, 91, 192.32];
    const labels = ['Fecha', emptyProductLabel, 'Próxima cita', 'Médico responsable'];
    let headerX = x;
    widths.forEach((width, index) => {
      page2.drawRectangle({ x: headerX, y: yTop - 28, width, height: 26, color: colors.teal, borderColor: colors.white, borderWidth: 0.5 });
      draw(page2, bold, labels[index], headerX + 6, yTop - 19, { size: 6.5, maxWidth: width - 12, color: colors.white });
      headerX += width;
    });
    const visibleRows = rows.slice(0, 8);
    for (let rowIndex = 0; rowIndex < 8; rowIndex += 1) {
      const item = visibleRows[rowIndex] || {};
      const rowY = yTop - 54 - rowIndex * 31;
      const hasRecord = Boolean(item.appliedAt || item.productName || item.nextAppointmentAt || item.doctor);
      const values = [item.appliedAt || '', item.productName || '', item.nextAppointmentAt || '', hasRecord ? (item.doctor || doctor || '') : ''];
      let cellX = x;
      widths.forEach((width, index) => {
        page2.drawRectangle({ x: cellX, y: rowY, width, height: 31, color: rowIndex % 2 ? colors.paleBlue : colors.white, borderColor: colors.line, borderWidth: 0.55 });
        drawBlock(page2, font, values[index], cellX + 6, rowY + 19, width - 12, { size: 6.8, lineHeight: 8, maxLines: 2 });
        cellX += width;
      });
    }
  };
  const vaccineRows = preventive.filter(item => item.type === 'VACCINE');
  const dewormingRows = preventive.filter(item => item.type === 'DEWORMING');
  table('Cronograma de vacunación', vaccineRows, 714, 'Vacuna');
  table('Cronograma de desparasitación', dewormingRows, 399, 'Producto');
  draw(page2, font, 'Las filas vacías quedan disponibles para completar futuros controles impresos.', margin, 94, { size: 7, maxWidth: contentWidth });
  footer(page2);

  const bytes = await pdf.save();
  if (data.returnBytes) return bytes;
  openGeneratedPdf(bytes, `historia-clinica-consulta-${safeText(pet.name) || 'paciente'}.pdf`);
}

export async function generateOriginalHistoryPdf(data) {
  const { PDFDocument, StandardFonts } = await loadPdfLib();
  const sourceBytes = await fetchBytes(ORIGINALS.history);
  const pdf = await PDFDocument.load(sourceBytes);
  const template = await PDFDocument.load(sourceBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const { pet = {}, client = {}, preventive = [], consultations = [], entryDate = '' } = data;
  const page1 = pdf.getPage(0);

  draw(page1, font, historyCode(pet), 431, 727, { size: 7, maxWidth: 60 });
  draw(page1, font, entryDate, 154, 703, { size: 7, maxWidth: 105 });
  draw(page1, font, client.fullName, 128, 644, { size: 7, maxWidth: 258 });
  draw(page1, font, client.phone, 438, 644, { size: 7, maxWidth: 71 });
  draw(page1, font, client.address, 130, 615, { size: 7, maxWidth: 260 });
  draw(page1, font, client.documentNumber || client.dni, 420, 615, { size: 7, maxWidth: 90 });
  draw(page1, font, pet.name, 128, 549, { size: 7, maxWidth: 135 });
  draw(page1, font, pet.species, 313, 549, { size: 7, maxWidth: 92 });
  draw(page1, font, pet.age, 443, 549, { size: 7, maxWidth: 65 });
  draw(page1, font, pet.breed, 111, 526, { size: 7, maxWidth: 135 });
  draw(page1, font, safeText(pet.sex), 280, 526, { size: 7, maxWidth: 35 });
  draw(page1, font, pet.color, 338, 526, { size: 7, maxWidth: 68 });
  draw(page1, font, pet.weightKg, 443, 526, { size: 7, maxWidth: 65 });

  const deworming = preventive.filter(item => item.type === 'DEWORMING').slice(0, 12);
  deworming.forEach((item, index) => {
    const y = 447 - index * 14;
    draw(page1, font, item.appliedAt, 95, y, { size: 5.6, maxWidth: 68 });
    draw(page1, font, item.productName, 172, y, { size: 5.6, maxWidth: 83 });
    draw(page1, font, item.weight, 267, y, { size: 5.6, maxWidth: 50 });
    draw(page1, font, item.doctor, 329, y, { size: 5.6, maxWidth: 72 });
    draw(page1, font, item.nextAppointmentAt, 414, y, { size: 5.6, maxWidth: 88 });
  });
  const vaccines = preventive.filter(item => item.type === 'VACCINE').slice(0, 11);
  vaccines.forEach((item, index) => {
    const y = 217 - index * 14;
    draw(page1, font, item.appliedAt, 95, y, { size: 5.6, maxWidth: 88 });
    draw(page1, font, item.productName, 198, y, { size: 5.6, maxWidth: 88 });
    draw(page1, font, item.doctor, 306, y, { size: 5.6, maxWidth: 88 });
    draw(page1, font, item.nextAppointmentAt, 414, y, { size: 5.6, maxWidth: 88 });
  });

  const consultationPages = Math.max(1, Math.ceil(consultations.length / 2));
  for (let index = 1; index < consultationPages; index += 1) {
    const [copy] = await pdf.copyPages(template, [1]);
    pdf.addPage(copy);
  }
  const pages = pdf.getPages();
  for (let index = 0; index < consultationPages; index += 1) {
    const page = pages[index + 1];
    const first = consultations[index * 2];
    const second = consultations[index * 2 + 1];
    if (first) drawConsultationBlock(page, font, first, 755);
    if (second) drawConsultationBlock(page, font, second, 397);
  }

  const bytes = await pdf.save();
  if (data.returnBytes) return bytes;
  openGeneratedPdf(bytes, `historia-clinica-${safeText(pet.name) || 'paciente'}.pdf`);
}

export async function generateOriginalSurgeryPdf(data) {
  const { PDFDocument, StandardFonts } = await loadPdfLib();
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.32, 841.92]);
  const image = await pdf.embedPng(await fetchBytes(ORIGINALS.surgery));
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { pet = {}, client = {}, consent = {}, date = '' } = data;
  const species = speciesFlags(pet);
  const sex = sexFlags(pet);
  page.drawImage(image, { x: 0, y: 0, width: 595.32, height: 841.92 });

  const x = value => value * (595.32 / 2480);
  const y = value => 841.92 - value * (841.92 / 3508);
  draw(page, font, date, x(78), y(1780), { size: 7, maxWidth: 50 });
  draw(page, font, pet.name, x(332), y(568), { size: 7, maxWidth: 200 });
  mark(page, bold, species.dog, x(493), y(703), 9);
  mark(page, bold, species.cat, x(757), y(703), 9);
  mark(page, bold, sex.male, x(493), y(775), 9);
  mark(page, bold, sex.female, x(757), y(775), 9);
  draw(page, font, consent.petAge || pet.age, x(335), y(850), { size: 7, maxWidth: 55 });
  draw(page, font, consent.petColor || pet.color, x(635), y(850), { size: 7, maxWidth: 115 });
  draw(page, font, pet.breed, x(335), y(970), { size: 7, maxWidth: 160 });
  draw(page, font, consent.lastMeal, x(330), y(1170), { size: 7, maxWidth: 440 });
  mark(page, bold, consent.digestiveIssue, x(493), y(1300), 9);
  mark(page, bold, !consent.digestiveIssue, x(760), y(1300), 9);
  mark(page, bold, consent.medicalCondition, x(493), y(1477), 9);
  mark(page, bold, !consent.medicalCondition, x(760), y(1477), 9);
  draw(page, font, consent.medicalConditionDetail, x(330), y(1604), { size: 6.5, maxWidth: 450 });
  draw(page, font, consent.medication, x(330), y(1738), { size: 6.5, maxWidth: 450 });

  draw(page, font, client.fullName, x(1400), y(545), { size: 7, maxWidth: 420 });
  draw(page, font, consent.ownerAddress || client.address, x(1400), y(655), { size: 7, maxWidth: 420 });
  draw(page, font, client.phone, x(1400), y(765), { size: 7, maxWidth: 420 });
  draw(page, font, consent.alternativeName, x(1400), y(948), { size: 6.5, maxWidth: 420 });
  draw(page, font, consent.alternativePhone, x(1400), y(1091), { size: 6.5, maxWidth: 420 });
  drawBlock(page, font, consent.staffNotes, x(1400), y(1490), x(700), { size: 6.5, maxLines: 14, lineHeight: 8 });
  draw(page, bold, client.fullName, x(700), y(3120), { size: 6.5, maxWidth: 235 });
  draw(page, bold, consent.ownerDni, x(200), y(3180), { size: 6.5, maxWidth: 130 });

  const bytes = await pdf.save();
  if (data.returnBytes) return bytes;
  openGeneratedPdf(bytes, `autorizacion-esterilizacion-${safeText(pet.name) || 'paciente'}.pdf`);
}
