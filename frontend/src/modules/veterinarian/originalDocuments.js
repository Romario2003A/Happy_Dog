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
    x, y, size, font,
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
  const { PDFDocument, StandardFonts } = await loadPdfLib();
  const pdf = await PDFDocument.load(await fetchBytes(ORIGINALS.consultation));
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [page1, page2] = pdf.getPages();
  const { pet = {}, client = {}, consultation = {}, preventive = [], doctor = '' } = data;
  const sex = sexFlags(pet);

  draw(page1, bold, consultation.date, 70, 785, { size: 8, maxWidth: 57 });
  draw(page1, bold, historyCode(pet), 500, 779, { size: 8, maxWidth: 56 });
  draw(page1, font, client.fullName, 86, 657, { maxWidth: 265 });
  draw(page1, font, client.phone, 400, 657, { maxWidth: 140 });
  draw(page1, font, client.address, 86, 630, { maxWidth: 265 });
  draw(page1, font, client.documentNumber || client.dni, 400, 630, { maxWidth: 140 });
  draw(page1, font, pet.name, 108, 586, { size: 6.5, maxWidth: 97 });
  draw(page1, font, pet.species, 260, 586, { size: 6.5, maxWidth: 95 });
  draw(page1, font, pet.breed, 395, 586, { size: 6.5, maxWidth: 108 });
  mark(page1, bold, sex.female, 109, 574, 9);
  mark(page1, bold, sex.male, 137, 574, 9);
  draw(page1, font, pet.age, 280, 571, { size: 6.5, maxWidth: 75 });
  draw(page1, font, consultation.weight || pet.weightKg, 438, 571, { size: 6.5, maxWidth: 65 });
  draw(page1, font, pet.color, 100, 555, { size: 6.5, maxWidth: 105 });
  mark(page1, bold, Boolean(pet.sterilized), 301, 561, 9);
  mark(page1, bold, pet.sterilized === false, 334, 561, 9);
  draw(page1, font, pet.origin, 438, 555, { size: 6.5, maxWidth: 65 });

  draw(page1, font, consultation.date, 75, 510, { maxWidth: 55 });
  draw(page1, font, consultation.weight, 173, 510, { maxWidth: 37 });
  draw(page1, font, consultation.temperature, 237, 510, { maxWidth: 30 });
  draw(page1, font, consultation.fc, 297, 510, { maxWidth: 37 });
  draw(page1, font, consultation.fr, 363, 510, { maxWidth: 19 });
  draw(page1, font, consultation.mucosas, 432, 510, { maxWidth: 118 });
  drawBlock(page1, font, consultation.anamnesis, 140, 477, 407, { size: 7, maxLines: 20, lineHeight: 9 });

  const examMarks = {
    ecografia: [199, 328], rayosX: [199, 315], hemograma: [199, 301], test: [208, 287],
    heces: [349, 328], orina: [349, 315], tgoTgpFas: [349, 301], otros: [334, 287],
    citologia: [450, 328], raspadoPiel: [477, 315], ureaCrea: [469, 301],
  };
  Object.entries(examMarks).forEach(([key, [x, y]]) => mark(page1, bold, consultation.exams?.[key], x, y, 8));
  draw(page1, font, consultation.examOther, 355, 281, { size: 6.2, maxWidth: 120 });
  draw(page1, font, consultation.presumptiveDx, 140, 258, { size: 6.7, maxWidth: 407 });
  draw(page1, font, consultation.definitiveDx, 140, 238, { size: 6.7, maxWidth: 150 });
  draw(page1, font, consultation.prognosis, 400, 238, { size: 6.7, maxWidth: 145 });
  drawBlock(page1, font, consultation.treatment, 140, 211, 407, { size: 6.7, maxLines: 10, lineHeight: 8 });
  draw(page1, font, consultation.frequency, 140, 109, { size: 6.7, maxWidth: 105 });
  drawBlock(page1, font, consultation.recommendations, 140, 91, 265, { size: 6.5, maxLines: 7, lineHeight: 7.5 });
  draw(page1, font, doctor, 466, 70, { size: 6.5, maxWidth: 80 });

  const vaccineRows = preventive.filter(item => item.type === 'VACCINE').slice(0, 8);
  const dewormingRows = preventive.filter(item => item.type === 'DEWORMING').slice(0, 8);
  vaccineRows.forEach((item, index) => {
    const y = 308 - index * 14.3;
    draw(page2, font, item.appliedAt, 69, y, { size: 5.8, maxWidth: 73 });
    draw(page2, font, item.productName, 151, y, { size: 5.8, maxWidth: 79 });
    draw(page2, font, item.nextAppointmentAt, 239, y, { size: 5.8, maxWidth: 71 });
    draw(page2, font, pet.age, 326, y, { size: 5.8, maxWidth: 43 });
    draw(page2, font, item.temperature, 382, y, { size: 5.8, maxWidth: 30 });
    draw(page2, font, item.doctor || doctor, 427, y, { size: 5.8, maxWidth: 88 });
  });
  dewormingRows.forEach((item, index) => {
    const y = 138 - index * 14.3;
    draw(page2, font, item.appliedAt, 69, y, { size: 5.8, maxWidth: 73 });
    draw(page2, font, item.productName, 151, y, { size: 5.8, maxWidth: 79 });
    draw(page2, font, item.nextAppointmentAt, 239, y, { size: 5.8, maxWidth: 71 });
    draw(page2, font, pet.age, 326, y, { size: 5.8, maxWidth: 43 });
    draw(page2, font, item.temperature, 382, y, { size: 5.8, maxWidth: 30 });
    draw(page2, font, item.doctor || doctor, 427, y, { size: 5.8, maxWidth: 88 });
  });

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
