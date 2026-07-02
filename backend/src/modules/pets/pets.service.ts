import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import { PrismaService } from '../../database/prisma.service';
import { CreatePetDto } from './dto/create-pet.dto';

const MM_TO_PT = 72 / 25.4;
const CARD_WIDTH = 85.6 * MM_TO_PT;
const CARD_HEIGHT = 54 * MM_TO_PT;

const CODE39: Record<string, string> = {
  '0': 'nnnwwnwnn',
  '1': 'wnnwnnnnw',
  '2': 'nnwwnnnnw',
  '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn',
  '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn',
  '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw',
  B: 'nnwnnwnnw',
  C: 'wnwnnwnnn',
  D: 'nnnnwwnnw',
  E: 'wnnnwwnnn',
  F: 'nnwnwwnnn',
  G: 'nnnnnwwnw',
  H: 'wnnnnwwnn',
  I: 'nnwnnwwnn',
  J: 'nnnnwwwnn',
  K: 'wnnnnnnww',
  L: 'nnwnnnnww',
  M: 'wnwnnnnwn',
  N: 'nnnnwnnww',
  O: 'wnnnwnnwn',
  P: 'nnwnwnnwn',
  Q: 'nnnnnnwww',
  R: 'wnnnnnwwn',
  S: 'nnwnnnwwn',
  T: 'nnnnwnwwn',
  U: 'wwnnnnnnw',
  V: 'nwwnnnnnw',
  W: 'wwwnnnnnn',
  X: 'nwnnwnnnw',
  Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw',
  '.': 'wwnnnnwnn',
  ' ': 'nwwnnnwnn',
  '*': 'nwnnwnwnn',
  '$': 'nwnwnwnnn',
  '/': 'nwnwnnnwn',
  '+': 'nwnnnwnwn',
  '%': 'nnnwnwnwn',
};

type PetWithClient = {
  id: string;
  name: string;
  species: string;
  breed?: string | null;
  sex?: string | null;
  color?: string | null;
  age?: string | null;
  weightKg?: number | null;
  sterilized?: boolean | null;
  photoUrl?: string | null;
  cardStatus?: string | null;
  cardPrintedAt?: Date | null;
  cardLastGeneratedAt?: Date | null;
  cardPrintCount?: number | null;
  cardPrintedBy?: string | null;
  createdAt?: Date;
  client?: {
    fullName?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  };
};

@Injectable()
export class PetsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return (this.prisma as any).pet.findMany({ orderBy: { createdAt: 'desc' }, include: { client: true } });
  }

  findOne(id: string) {
    return (this.prisma as any).pet.findUnique({ where: { id }, include: { client: true } });
  }

  async create(dto: CreatePetDto) {
    return (this.prisma as any).pet.create({ data: dto as any });
  }

  update(id: string, dto: Partial<CreatePetDto>) {
    return (this.prisma as any).pet.update({ where: { id }, data: dto as any });
  }

  updatePhoto(id: string, photoUrl: string) {
    return (this.prisma as any).pet.update({
      where: { id },
      data: { photoUrl },
      include: { client: true },
    });
  }

  remove(id: string) {
    return (this.prisma as any).pet.delete({ where: { id } });
  }

  async generateIdCard(id: string) {
    const pet = await this.findOne(id) as PetWithClient | null;
    if (!pet) throw new NotFoundException('Mascota no encontrada.');

    await (this.prisma as any).pet.update({
      where: { id },
      data: { cardLastGeneratedAt: new Date() },
    });

    return this.generateCardsPdf([pet]);
  }

  async generateIdCards(ids: string[]) {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (!uniqueIds.length) throw new NotFoundException('Selecciona al menos una mascota.');

    const pets = await (this.prisma as any).pet.findMany({
      where: { id: { in: uniqueIds } },
      include: { client: true },
    }) as PetWithClient[];

    const orderedPets = uniqueIds
      .map(id => pets.find(pet => pet.id === id))
      .filter(Boolean) as PetWithClient[];

    if (!orderedPets.length) throw new NotFoundException('No se encontraron mascotas para imprimir.');

    await (this.prisma as any).pet.updateMany({
      where: { id: { in: orderedPets.map(pet => pet.id) } },
      data: { cardLastGeneratedAt: new Date() },
    });

    return this.generateCardsPdf(orderedPets);
  }

  async markCardsPrinted(ids: string[], printedBy = 'Happy Dog') {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (!uniqueIds.length) throw new NotFoundException('Selecciona al menos una mascota.');

    const pets = await (this.prisma as any).pet.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    const foundIds = pets.map((pet: { id: string }) => pet.id);
    if (!foundIds.length) throw new NotFoundException('No se encontraron mascotas para marcar.');

    const now = new Date();
    await Promise.all(foundIds.map(id => (this.prisma as any).pet.update({
      where: { id },
      data: {
        cardStatus: 'PRINTED',
        cardPrintedAt: now,
        cardPrintedBy: printedBy,
        cardPrintCount: { increment: 1 },
      },
    })));

    return { updated: foundIds.length };
  }

  async requestCardReprint(id: string) {
    const pet = await this.findOne(id);
    if (!pet) throw new NotFoundException('Mascota no encontrada.');

    return (this.prisma as any).pet.update({
      where: { id },
      data: { cardStatus: 'REPRINT_REQUESTED' },
      include: { client: true },
    });
  }

  private generateCardsPdf(pets: PetWithClient[]) {
    return new Promise<Buffer>(async (resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: [CARD_WIDTH, CARD_HEIGHT],
        margin: 0,
        info: {
          Title: pets.length === 1 ? `Carnet Happy Dog - ${pets[0].name}` : 'Carnets Happy Dog',
          Author: 'Happy Dog',
        },
      });

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      for (const [index, pet] of pets.entries()) {
        if (index > 0) doc.addPage({ size: [CARD_WIDTH, CARD_HEIGHT], margin: 0 });
        const photo = await this.loadPhoto(pet.photoUrl);
        this.drawFront(doc, pet, photo);
        doc.addPage({ size: [CARD_WIDTH, CARD_HEIGHT], margin: 0 });
        this.drawBack(doc, pet);
      }

      doc.end();
    });
  }

  private mm(value: number) {
    return value * MM_TO_PT;
  }

  private petCode(pet: PetWithClient) {
    const raw = pet.id.replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase().padStart(8, '0');
    return `MAS${raw}`;
  }

  private shortCode(pet: PetWithClient) {
    const raw = pet.id.replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase().padStart(8, '0');
    return `HD-${raw}`;
  }

  private sexLabel(sex?: string | null) {
    if (sex === 'MALE') return 'Macho';
    if (sex === 'FEMALE') return 'Hembra';
    return 'No especificado';
  }

  private sexCode(pet: PetWithClient) {
    const raw = `${pet.sex || ''} ${pet.color || ''} ${pet.breed || ''}`.toUpperCase();
    if (raw.includes('FEMALE') || raw.includes('HEMBRA')) return 'HEMBRA';
    if (raw.includes('MALE') || raw.includes('MACHO')) return 'MACHO';
    return 'N/R';
  }

  private drawCardBase(doc: PDFKit.PDFDocument) {
    doc.save();
    doc.rect(0, 0, CARD_WIDTH, CARD_HEIGHT).fill('#EEDFB9');
    doc.opacity(0.18).rect(0, 0, CARD_WIDTH, CARD_HEIGHT).fill('#FFF8E4');
    doc.opacity(0.11).circle(this.mm(75), this.mm(8), this.mm(14)).fill('#86D6AD');
    doc.opacity(0.06).circle(this.mm(8), this.mm(46), this.mm(19)).fill('#155B66');
    doc.opacity(0.045).circle(this.mm(48), this.mm(52), this.mm(22)).fill('#155B66');
    doc.opacity(1);
    this.drawSecurityTexture(doc);
    this.drawWatermarkSeal(doc);
    doc.opacity(1);
    doc.roundedRect(this.mm(2), this.mm(2), this.mm(81.6), this.mm(50), this.mm(3)).lineWidth(0.9).stroke('#155B66');
    doc.restore();
  }

  private drawSecurityTexture(doc: PDFKit.PDFDocument) {
    doc.save();
    doc.lineWidth(0.13).opacity(0.16).strokeColor('#6FB899');
    for (let row = 0; row < 19; row += 1) {
      const y = this.mm(7 + row * 3);
      doc.moveTo(0, y);
      for (let col = 0; col <= 86; col += 2) {
        const x = this.mm(col);
        const wave = Math.sin((col + row * 3) / 4) * this.mm(0.9);
        doc.lineTo(x, y + wave);
      }
      doc.stroke();
    }

    doc.lineWidth(0.1).opacity(0.13).strokeColor('#155B66');
    for (let col = -15; col < 95; col += 4.3) {
      doc.moveTo(this.mm(col), 0).lineTo(this.mm(col + 38), CARD_HEIGHT).stroke();
    }

    doc.opacity(0.1).fillColor('#155B66');
    for (let index = 0; index < 110; index += 1) {
      const x = this.mm((index * 17) % 86);
      const y = this.mm((index * 29) % 54);
      doc.circle(x, y, 0.28).fill();
    }
    doc.restore();
  }

  private drawWatermarkSeal(doc: PDFKit.PDFDocument) {
    const cx = this.mm(47);
    const cy = this.mm(29);
    doc.save();
    doc.opacity(0.08).lineWidth(0.8).strokeColor('#155B66').circle(cx, cy, this.mm(13)).stroke();
    doc.opacity(0.08).lineWidth(0.45).circle(cx, cy, this.mm(9)).stroke();
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#155B66').opacity(0.07).text('HAPPY DOG', cx - this.mm(17), cy - this.mm(2.5), { width: this.mm(34), align: 'center' });
    doc.restore();
  }

  private drawBrand(doc: PDFKit.PDFDocument, x: number, y: number, light = false) {
    doc.font('Helvetica-Bold').fontSize(13).fillColor(light ? '#FFFFFF' : '#155B66').text('Happy', x, y, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(13).fillColor(light ? '#FFFFFF' : '#155B66').text('Dog', x, y + 10, { lineBreak: false });
    doc.circle(x + 31, y + 18, 5).fill('#86D6AD');
    doc.circle(x + 24, y + 13, 2.7).fill('#86D6AD');
    doc.circle(x + 30, y + 11, 2.7).fill('#86D6AD');
    doc.circle(x + 36, y + 13, 2.7).fill('#86D6AD');
  }

  private drawMiniBrand(doc: PDFKit.PDFDocument, x: number, y: number, light = false) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(light ? '#FFFFFF' : '#155B66').text('Happy', x, y, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(8).fillColor(light ? '#FFFFFF' : '#155B66').text('Dog', x, y + 6.4, { lineBreak: false });
    doc.circle(x + 19.5, y + 11, 3).fill(light ? '#FFFFFF' : '#86D6AD');
    doc.circle(x + 15.5, y + 8, 1.5).fill(light ? '#FFFFFF' : '#86D6AD');
    doc.circle(x + 19.4, y + 7, 1.5).fill(light ? '#FFFFFF' : '#86D6AD');
    doc.circle(x + 23.2, y + 8, 1.5).fill(light ? '#FFFFFF' : '#86D6AD');
  }

  private drawPhoto(doc: PDFKit.PDFDocument, pet: PetWithClient, photo: Buffer | null, x: number, y: number, size: number) {
    doc.save();
    doc.roundedRect(x, y, size, size, this.mm(2)).fill('#FFFFFF').stroke('#155B66');
    if (photo) {
      try {
        doc.save();
        doc.roundedRect(x + 2, y + 2, size - 4, size - 4, this.mm(1.5)).clip();
        doc.image(photo, x + 2, y + 2, { cover: [size - 4, size - 4], align: 'center', valign: 'center' });
        doc.restore();
      } catch {
        this.drawPhotoPlaceholder(doc, pet, x, y, size);
      }
    } else {
      this.drawPhotoPlaceholder(doc, pet, x, y, size);
    }
    doc.restore();
  }

  private drawFadedPhoto(doc: PDFKit.PDFDocument, pet: PetWithClient, photo: Buffer | null, x: number, y: number, size: number) {
    doc.save();
    doc.roundedRect(x, y, size, size, this.mm(1.4)).fill('#F4E7C8').stroke('#9AA89F');
    doc.opacity(0.58);
    if (photo) {
      try {
        doc.save();
        doc.roundedRect(x + 1.2, y + 1.2, size - 2.4, size - 2.4, this.mm(1)).clip();
        doc.image(photo, x + 1.2, y + 1.2, { cover: [size - 2.4, size - 2.4], align: 'center', valign: 'center' });
        doc.restore();
      } catch {
        this.drawPhotoPlaceholder(doc, pet, x, y, size);
      }
    } else {
      this.drawPhotoPlaceholder(doc, pet, x, y, size);
    }
    doc.opacity(0.34).roundedRect(x + 1.2, y + 1.2, size - 2.4, size - 2.4, this.mm(1)).fill('#F3E4C2');
    doc.opacity(1);
    doc.restore();
  }

  private drawPhotoPlaceholder(doc: PDFKit.PDFDocument, pet: PetWithClient, x: number, y: number, size: number) {
    doc.roundedRect(x + 2, y + 2, size - 4, size - 4, this.mm(1.5)).fill('#EAF6F1');
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#155B66').text((pet.name || 'M').slice(0, 1).toUpperCase(), x, y + size / 2 - 12, { width: size, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(6).fillColor('#5E6F6A').text('Foto mascota', x, y + size - 14, { width: size, align: 'center' });
  }

  private label(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, width: number) {
    doc.font('Helvetica').fontSize(3.9).fillColor('#39524D').text(label, x, y, { width });
    doc.font('Helvetica-Bold').fontSize(6.1).fillColor('#111B19').text(value || '-', x, y + 4.3, { width, ellipsis: true });
  }

  private drawFieldBox(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, width: number, height = this.mm(9)) {
    doc.save();
    doc.opacity(0.28).roundedRect(x, y, width, height, this.mm(0.9)).fill('#F9F1D9');
    doc.opacity(0.75).roundedRect(x, y, width, height, this.mm(0.9)).lineWidth(0.32).stroke('#45645E');
    doc.restore();
    this.label(doc, label, value, x + this.mm(1.2), y + this.mm(1.2), width - this.mm(2.4));
  }

  private drawMicroText(doc: PDFKit.PDFDocument, text: string, x: number, y: number, width: number) {
    const repeated = Array(12).fill(text).join('  ');
    doc.font('Helvetica-Bold').fontSize(3.2).fillColor('#155B66').opacity(0.45).text(repeated, x, y, { width, height: this.mm(2.5), ellipsis: true });
    doc.opacity(1);
  }

  private drawPdf417Like(doc: PDFKit.PDFDocument, value: string, x: number, y: number, width: number, height: number) {
    const cols = 24;
    const rows = 10;
    const cellW = width / cols;
    const cellH = height / rows;
    let seed = Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0);

    doc.save().fillColor('#101010');
    doc.rect(x, y, cellW * 2, height).fill();
    doc.rect(x + width - cellW * 2, y, cellW * 2, height).fill();
    for (let row = 0; row < rows; row += 1) {
      for (let col = 2; col < cols - 2; col += 1) {
        seed = (seed * 1103515245 + 12345 + row + col) & 0x7fffffff;
        if ((seed + row * col) % 3 !== 0) {
          doc.rect(x + col * cellW, y + row * cellH, cellW * 0.9, cellH * 0.82).fill();
        }
      }
    }
    doc.restore();
  }

  private drawVerticalBars(doc: PDFKit.PDFDocument, value: string, x: number, y: number, width: number, height: number) {
    let seed = Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const bars = 26;
    const step = width / bars;

    doc.save().fillColor('#111111');
    for (let index = 0; index < bars; index += 1) {
      seed = (seed * 1664525 + 1013904223 + index) & 0x7fffffff;
      const barWidth = step * (seed % 4 === 0 ? 1.6 : seed % 3 === 0 ? 1.15 : 0.65);
      if (seed % 5 !== 0) doc.rect(x + index * step, y, barWidth, height).fill();
    }
    doc.font('Helvetica-Bold').fontSize(3.8).fillColor('#1F2A2D').text(value, x - this.mm(5), y + height + this.mm(0.8), { width: width + this.mm(10), height: this.mm(2.5), align: 'center' });
    doc.restore();
  }

  private drawFront(doc: PDFKit.PDFDocument, pet: PetWithClient, photo: Buffer | null) {
    this.drawCardBase(doc);
    const issueDate = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
    const petCode = this.petCode(pet);
    const sex = this.sexCode(pet);

    doc.roundedRect(this.mm(4), this.mm(3), this.mm(77.6), this.mm(8), this.mm(2)).fill('#F7FAF8');
    doc.font('Helvetica-Bold').fontSize(6.9).fillColor('#1F2A2D').text('REPUBLICA DEL PERU', this.mm(6), this.mm(5.7), { width: this.mm(30), height: this.mm(3), ellipsis: true });
    doc.font('Helvetica-Bold').fontSize(3.25).fillColor('#1F2A2D').text('REGISTRO NACIONAL DE IDENTIFICACION', this.mm(36), this.mm(4.8), { width: this.mm(28), height: this.mm(2.4), align: 'center' });
    doc.font('Helvetica-Bold').fontSize(3.25).fillColor('#1F2A2D').text('DOCUMENTO NACIONAL DE IDENTIDAD', this.mm(36), this.mm(7.4), { width: this.mm(28), height: this.mm(2.4), align: 'center' });
    doc.font('Helvetica-Bold').fontSize(5).fillColor('#1F2A2D').text('DNI', this.mm(65.5), this.mm(5.4), { width: this.mm(6), height: this.mm(3) });
    doc.font('Helvetica-Bold').fontSize(4.7).fillColor('#CF6677').text(petCode.replace('MAS', '').slice(0, 8), this.mm(71), this.mm(5.4), { width: this.mm(9.5), height: this.mm(3), align: 'right' });

    this.drawPhoto(doc, pet, photo, this.mm(9), this.mm(14), this.mm(22));

    doc.save().opacity(0.18);
    this.drawBrand(doc, this.mm(37), this.mm(24), true);
    doc.restore();

    const ownerParts = (pet.client?.fullName || 'SIN DUENIO').toUpperCase().split(' ');
    const firstSurname = ownerParts[0] || 'HAPPY';
    const secondSurname = ownerParts[1] || 'DOG';
    this.label(doc, 'Primer Apellido', firstSurname, this.mm(34), this.mm(14), this.mm(23));
    this.label(doc, 'Segundo Apellido', secondSurname, this.mm(34), this.mm(23), this.mm(23));
    this.label(doc, 'Nombre', pet.name.toUpperCase(), this.mm(34), this.mm(32), this.mm(23));
    this.label(doc, 'SEXO', sex, this.mm(34), this.mm(38), this.mm(13));
    this.label(doc, 'ESPECIE', pet.species.toUpperCase(), this.mm(47), this.mm(38), this.mm(17));

    doc.rect(this.mm(65), this.mm(14), this.mm(15), this.mm(7.5)).lineWidth(0.55).stroke('#1F2A2D');
    doc.rect(this.mm(65), this.mm(21.5), this.mm(15), this.mm(7.5)).stroke('#1F2A2D');
    doc.rect(this.mm(65), this.mm(29), this.mm(15), this.mm(7.5)).stroke('#1F2A2D');
    doc.font('Helvetica').fontSize(4.4).fillColor('#1F2A2D').text('Fecha de Inscripcion', this.mm(65.5), this.mm(14.8), { width: this.mm(14) });
    doc.font('Helvetica-Bold').fontSize(5).text(issueDate, this.mm(65.5), this.mm(18.2), { width: this.mm(14), align: 'center' });
    doc.font('Helvetica').fontSize(4.4).text('Fecha de Emision', this.mm(65.5), this.mm(22.2), { width: this.mm(14) });
    doc.font('Helvetica-Bold').fontSize(5).text(issueDate, this.mm(65.5), this.mm(25.6), { width: this.mm(14), align: 'center' });
    doc.font('Helvetica').fontSize(4.4).text('Fecha de Caducidad', this.mm(65.5), this.mm(29.7), { width: this.mm(14) });
    doc.font('Helvetica-Bold').fontSize(5).text('NO CADUCA', this.mm(65.5), this.mm(33.1), { width: this.mm(14), align: 'center' });

    this.drawFadedPhoto(doc, pet, photo, this.mm(68), this.mm(37), this.mm(8));

    doc.font('Courier-Bold').fontSize(5.15).fillColor('#1A1A1A').text(`I<PER${petCode.replace(/[^A-Z0-9]/g, '').padEnd(14, '0')}2<<<<<<<<<<<<<<<<<<<<`, this.mm(7), this.mm(43.1), { width: this.mm(72), height: this.mm(2.4), characterSpacing: 0.25 });
    doc.font('Courier-Bold').fontSize(5.15).text(`${petCode.replace('MAS', '').padEnd(16, '0')}PER<<<<<<<<<<<<<<<<<<<<0`, this.mm(7), this.mm(46.5), { width: this.mm(72), height: this.mm(2.4), characterSpacing: 0.25 });
    doc.font('Courier-Bold').fontSize(5.15).text(`<<<<<<<<<<<<HAPPYDOG<<<<VETERINARIA<<<<`, this.mm(7), this.mm(49.8), { width: this.mm(72), height: this.mm(2.4), characterSpacing: 0.25 });
    return;

    this.drawCardBase(doc);
    doc.rect(0, 0, CARD_WIDTH, this.mm(9)).fill('#155B66');
    doc.font('Helvetica-Bold').fontSize(7.8).fillColor('#FFFFFF').text('DOCUMENTO DE IDENTIDAD MASCOTA', this.mm(4), this.mm(3), { width: this.mm(52) });
    doc.font('Helvetica-Bold').fontSize(6).fillColor('#86D6AD').text(this.petCode(pet), this.mm(61), this.mm(3.4), { width: this.mm(20), align: 'right' });

    this.drawPhoto(doc, pet, photo, this.mm(5), this.mm(13), this.mm(25));
    this.drawBrand(doc, this.mm(6), this.mm(40));

    this.label(doc, 'Nombre', pet.name, this.mm(34), this.mm(13), this.mm(43));
    this.label(doc, 'Especie', pet.species, this.mm(34), this.mm(23), this.mm(18));
    this.label(doc, 'Raza', pet.breed || 'No especificada', this.mm(55), this.mm(23), this.mm(24));
    this.label(doc, 'Sexo', this.sexLabel(pet.sex), this.mm(34), this.mm(33), this.mm(18));
    this.label(doc, 'Edad', pet.age || 'No registrada', this.mm(55), this.mm(33), this.mm(24));
    this.label(doc, 'Dueño', pet.client?.fullName || 'Sin dueño', this.mm(34), this.mm(43), this.mm(45));
  }

  private drawBack(doc: PDFKit.PDFDocument, pet: PetWithClient) {
    this.drawCardBase(doc);
    const realisticCode = this.petCode(pet);

    doc.rect(this.mm(5), this.mm(4), this.mm(49), this.mm(14)).lineWidth(0.55).stroke('#1F2A2D');
    for (let i = 1; i < 4; i += 1) doc.moveTo(this.mm(5 + i * 12.25), this.mm(4)).lineTo(this.mm(5 + i * 12.25), this.mm(18)).stroke();
    doc.moveTo(this.mm(5), this.mm(11)).lineTo(this.mm(54), this.mm(11)).stroke();

    doc.save().opacity(0.35);
    this.drawBrand(doc, this.mm(63), this.mm(5), true);
    doc.restore();

    this.label(doc, 'Departamento', 'AREQUIPA', this.mm(5), this.mm(19.5), this.mm(20));
    this.label(doc, 'Provincia', 'AREQUIPA', this.mm(28), this.mm(19.5), this.mm(20));
    this.label(doc, 'Distrito', 'CAYMA', this.mm(51), this.mm(19.5), this.mm(20));
    this.label(doc, 'Direccion', pet.client?.address || 'AV. AREQUIPA 113 FC. BOLOGNESI CAYMA', this.mm(5), this.mm(29), this.mm(68));
    this.label(doc, 'Raza', pet.breed || 'No registrada', this.mm(5), this.mm(36), this.mm(28));
    this.label(doc, 'Color', pet.color || 'No registrado', this.mm(35), this.mm(36), this.mm(28));

    this.drawPdf417Like(doc, realisticCode, this.mm(5), this.mm(39.8), this.mm(58), this.mm(10));
    this.drawVerticalBars(doc, realisticCode, this.mm(70), this.mm(29), this.mm(8), this.mm(18));
    return;

    this.drawCardBase(doc);
    this.drawBrand(doc, this.mm(5), this.mm(5));
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#155B66').text('CARNET HAPPY DOG', this.mm(28), this.mm(5), { width: this.mm(52), align: 'right' });

    this.label(doc, 'Contacto del dueño', pet.client?.phone || pet.client?.email || 'No registrado', this.mm(5), this.mm(19), this.mm(38));
    this.label(doc, 'Color', pet.color || 'No registrado', this.mm(47), this.mm(19), this.mm(32));
    this.label(doc, 'Peso', pet.weightKg ? `${pet.weightKg} kg` : 'No registrado', this.mm(5), this.mm(29), this.mm(20));
    this.label(doc, 'Esterilizado', pet.sterilized ? 'Sí' : 'No', this.mm(28), this.mm(29), this.mm(18));
    this.label(doc, 'Emisión', new Intl.DateTimeFormat('es-PE').format(new Date()), this.mm(50), this.mm(29), this.mm(29));

    const code = this.petCode(pet);
    doc.font('Helvetica-Bold').fontSize(5).fillColor('#5E6F6A').text('Código de identificación', this.mm(5), this.mm(40), { width: this.mm(75) });
    this.drawCode39(doc, code, this.mm(5), this.mm(44), this.mm(75), this.mm(7));
    doc.font('Helvetica-Bold').fontSize(5.5).fillColor('#172522').text(code, this.mm(5), this.mm(50), { width: this.mm(75), align: 'center' });
  }

  private drawCode39(doc: PDFKit.PDFDocument, value: string, x: number, y: number, width: number, height: number) {
    const text = `*${value.toUpperCase().replace(/[^A-Z0-9 .\-$/+%]/g, '')}*`;
    const wideRatio = 2.8;
    const units = Array.from(text).reduce((total, char) => {
      const pattern = CODE39[char] || CODE39['0'];
      return total + Array.from(pattern).reduce((sum, part) => sum + (part === 'w' ? wideRatio : 1), 0) + 1;
    }, 0);
    const narrow = width / units;
    let cursor = x;

    doc.save().fillColor('#111111');
    for (const char of text) {
      const pattern = CODE39[char] || CODE39['0'];
      Array.from(pattern).forEach((part, index) => {
        const barWidth = narrow * (part === 'w' ? wideRatio : 1);
        if (index % 2 === 0) doc.rect(cursor, y, barWidth, height).fill();
        cursor += barWidth;
      });
      cursor += narrow;
    }
    doc.restore();
  }

  private async loadPhoto(photoUrl?: string | null) {
    if (!photoUrl) return null;
    if (/^data:image\/(?:png|jpe?g);base64,/i.test(photoUrl)) {
      return Buffer.from(photoUrl.split(',')[1], 'base64');
    }
    if (!/^https?:\/\//i.test(photoUrl)) return null;
    try {
      const response = await fetch(photoUrl);
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch {
      return null;
    }
  }
}
