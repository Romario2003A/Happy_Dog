import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
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
    return `HD-${raw}`;
  }

  private sexLabel(sex?: string | null) {
    if (sex === 'MALE') return 'Macho';
    if (sex === 'FEMALE') return 'Hembra';
    return 'No especificado';
  }

  private drawCardBase(doc: PDFKit.PDFDocument) {
    doc.save();
    doc.rect(0, 0, CARD_WIDTH, CARD_HEIGHT).fill('#F4E5C4');
    doc.opacity(0.18).circle(this.mm(77), this.mm(8), this.mm(13)).fill('#86D6AD');
    doc.opacity(0.12).circle(this.mm(9), this.mm(46), this.mm(18)).fill('#155B66');
    doc.opacity(1);
    doc.roundedRect(this.mm(2.2), this.mm(2.2), this.mm(81.2), this.mm(49.6), this.mm(3)).lineWidth(0.8).stroke('#155B66');
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
    doc.font('Helvetica').fontSize(4.8).fillColor('#5E6F6A').text(label, x, y, { width });
    doc.font('Helvetica-Bold').fontSize(7.8).fillColor('#172522').text(value || '-', x, y + 5.5, { width, ellipsis: true });
  }

  private drawFront(doc: PDFKit.PDFDocument, pet: PetWithClient, photo: Buffer | null) {
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
