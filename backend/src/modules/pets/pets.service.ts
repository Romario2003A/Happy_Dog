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

  remove(id: string) {
    return (this.prisma as any).pet.delete({ where: { id } });
  }

  async generateIdCard(id: string) {
    const pet = await this.findOne(id) as PetWithClient | null;
    if (!pet) throw new NotFoundException('Mascota no encontrada.');

    return new Promise<Buffer>(async (resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: [CARD_WIDTH, CARD_HEIGHT],
        margin: 0,
        info: {
          Title: `Carnet Happy Dog - ${pet.name}`,
          Author: 'Happy Dog',
        },
      });

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const photo = await this.loadPhoto(pet.photoUrl);
      this.drawFront(doc, pet, photo);
      doc.addPage({ size: [CARD_WIDTH, CARD_HEIGHT], margin: 0 });
      this.drawBack(doc, pet);
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

  private drawCardBase(doc: PDFKit.PDFDocument) {
    doc.save();
    doc.rect(0, 0, CARD_WIDTH, CARD_HEIGHT).fill('#F3E4C2');
    doc.opacity(0.1).rect(0, 0, CARD_WIDTH, CARD_HEIGHT).fill('#FFFFFF');
    doc.opacity(0.18).circle(this.mm(75), this.mm(8), this.mm(14)).fill('#86D6AD');
    doc.opacity(0.11).circle(this.mm(8), this.mm(46), this.mm(19)).fill('#155B66');
    doc.opacity(0.08).circle(this.mm(48), this.mm(52), this.mm(22)).fill('#155B66');
    doc.opacity(1);
    doc.roundedRect(this.mm(2), this.mm(2), this.mm(81.6), this.mm(50), this.mm(3)).lineWidth(0.9).stroke('#155B66');
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
        doc.image(photo, x + 2, y + 2, { width: size - 4, height: size - 4, fit: [size - 4, size - 4], align: 'center', valign: 'center' });
      } catch {
        this.drawPhotoPlaceholder(doc, pet, x, y, size);
      }
    } else {
      this.drawPhotoPlaceholder(doc, pet, x, y, size);
    }
    doc.restore();
  }

  private drawPhotoPlaceholder(doc: PDFKit.PDFDocument, pet: PetWithClient, x: number, y: number, size: number) {
    doc.roundedRect(x + 2, y + 2, size - 4, size - 4, this.mm(1.5)).fill('#EAF6F1');
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#155B66').text((pet.name || 'M').slice(0, 1).toUpperCase(), x, y + size / 2 - 12, { width: size, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(6).fillColor('#5E6F6A').text('Foto mascota', x, y + size - 14, { width: size, align: 'center' });
  }

  private label(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, width: number) {
    doc.font('Helvetica').fontSize(4.2).fillColor('#374B47').text(label, x, y, { width });
    doc.font('Helvetica-Bold').fontSize(6.8).fillColor('#111B19').text(value || '-', x, y + 4.8, { width, ellipsis: true });
  }

  private drawFieldBox(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, width: number, height = this.mm(9)) {
    doc.roundedRect(x, y, width, height, this.mm(1)).lineWidth(0.45).stroke('#45645E');
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

  private drawFront(doc: PDFKit.PDFDocument, pet: PetWithClient, photo: Buffer | null) {
    this.drawCardBase(doc);
    doc.rect(0, 0, CARD_WIDTH, this.mm(9.2)).fill('#155B66');
    doc.rect(this.mm(70), 0, this.mm(15.6), this.mm(54)).fill('#F8FAF7');
    doc.rect(this.mm(70), 0, this.mm(1.1), this.mm(54)).fill('#86D6AD');
    doc.font('Helvetica-Bold').fontSize(5.6).fillColor('#155B66').rotate(90, { origin: [this.mm(75.8), this.mm(8)] }).text('DOCUMENTO NACIONAL DE IDENTIDAD MASCOTA', this.mm(75.8), this.mm(8), { width: this.mm(42), align: 'center' });
    doc.rotate(-90, { origin: [this.mm(75.8), this.mm(8)] });

    doc.font('Helvetica-Bold').fontSize(6.8).fillColor('#FFFFFF').text('REPUBLICA DEL PERU', this.mm(4), this.mm(1.9), { width: this.mm(34) });
    doc.font('Helvetica-Bold').fontSize(5.6).fillColor('#D6FFF0').text('REGISTRO NACIONAL DE MASCOTAS', this.mm(4), this.mm(5.2), { width: this.mm(47) });
    doc.font('Helvetica-Bold').fontSize(6).fillColor('#86D6AD').text(this.shortCode(pet), this.mm(52), this.mm(3.1), { width: this.mm(16), align: 'right' });

    this.drawPhoto(doc, pet, photo, this.mm(5), this.mm(13), this.mm(22));
    doc.font('Helvetica-Bold').fontSize(3.8).fillColor('#155B66').text('FOTO', this.mm(5), this.mm(36.6), { width: this.mm(22), align: 'center' });
    this.drawMiniBrand(doc, this.mm(5), this.mm(42));

    doc.font('Helvetica-Bold').fontSize(4.6).fillColor('#155B66').text('N. DOCUMENTO', this.mm(30), this.mm(12.5), { width: this.mm(20) });
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111B19').text(this.petCode(pet), this.mm(30), this.mm(16), { width: this.mm(37), ellipsis: true });

    this.drawFieldBox(doc, 'Primer nombre', pet.name, this.mm(30), this.mm(26), this.mm(18));
    this.drawFieldBox(doc, 'Especie', pet.species, this.mm(50), this.mm(26), this.mm(17));
    this.drawFieldBox(doc, 'Raza', pet.breed || 'No especificada', this.mm(30), this.mm(37), this.mm(18));
    this.drawFieldBox(doc, 'Sexo', this.sexLabel(pet.sex), this.mm(50), this.mm(37), this.mm(17));

    doc.font('Helvetica').fontSize(3.9).fillColor('#374B47').text('Duenio / responsable', this.mm(5), this.mm(50), { width: this.mm(20) });
    doc.font('Helvetica-Bold').fontSize(4.8).fillColor('#111B19').text(pet.client?.fullName || 'Sin duenio', this.mm(28), this.mm(49.7), { width: this.mm(40), ellipsis: true });
    this.drawMicroText(doc, 'HAPPYDOG VETERINARIA IDENTIDAD MASCOTA', this.mm(4), this.mm(10), this.mm(64));
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
    doc.rect(0, 0, this.mm(9), CARD_HEIGHT).fill('#155B66');
    doc.font('Helvetica-Bold').fontSize(5.4).fillColor('#FFFFFF').rotate(-90, { origin: [this.mm(4.1), this.mm(49)] }).text('HAPPYDOG<<<<VETERINARIA<<<<MASCOTA', this.mm(4.1), this.mm(49), { width: this.mm(45), align: 'center' });
    doc.rotate(90, { origin: [this.mm(4.1), this.mm(49)] });
    this.drawMiniBrand(doc, this.mm(12), this.mm(4));

    doc.font('Helvetica-Bold').fontSize(6.4).fillColor('#155B66').text('CARNET HAPPY DOG', this.mm(34), this.mm(4), { width: this.mm(46), align: 'right' });
    doc.font('Helvetica').fontSize(4.2).fillColor('#374B47').text('Datos de contacto y validacion', this.mm(34), this.mm(8), { width: this.mm(46), align: 'right' });

    this.drawFieldBox(doc, 'Contacto del duenio', pet.client?.phone || pet.client?.email || 'No registrado', this.mm(12), this.mm(15), this.mm(29));
    this.drawFieldBox(doc, 'Color', pet.color || 'No registrado', this.mm(43), this.mm(15), this.mm(17));
    this.drawFieldBox(doc, 'Edad', pet.age || 'No registrada', this.mm(62), this.mm(15), this.mm(17));
    this.drawFieldBox(doc, 'Peso', pet.weightKg ? `${pet.weightKg} kg` : 'No registrado', this.mm(12), this.mm(26), this.mm(17));
    this.drawFieldBox(doc, 'Esterilizado', pet.sterilized ? 'Si' : 'No', this.mm(31), this.mm(26), this.mm(17));
    this.drawFieldBox(doc, 'Emision', new Intl.DateTimeFormat('es-PE').format(new Date()), this.mm(50), this.mm(26), this.mm(29));

    const realisticCode = this.petCode(pet);
    doc.font('Helvetica-Bold').fontSize(4.8).fillColor('#155B66').text('CODIGO DE IDENTIFICACION', this.mm(12), this.mm(37.5), { width: this.mm(67) });
    this.drawPdf417Like(doc, realisticCode, this.mm(12), this.mm(41), this.mm(38), this.mm(9));
    this.drawCode39(doc, realisticCode, this.mm(52), this.mm(41), this.mm(27), this.mm(7.8));
    doc.font('Helvetica-Bold').fontSize(4.6).fillColor('#111B19').text(realisticCode, this.mm(12), this.mm(50.2), { width: this.mm(67), align: 'center' });
    this.drawMicroText(doc, 'HAPPY DOG CAYMA IDENTIDAD VETERINARIA', this.mm(12), this.mm(12), this.mm(66));
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
    if (!photoUrl || !/^https?:\/\//i.test(photoUrl)) return null;
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
