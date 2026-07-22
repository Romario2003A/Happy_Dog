import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.service.findMany({ orderBy: [{ active: 'desc' }, { category: 'asc' }, { name: 'asc' }] });
  }

  private parseCsv(text: string) {
    const rows:string[][]=[]; let row:string[]=[]; let cell=''; let quoted=false;
    for(let i=0;i<text.length;i++) { const ch=text[i];
      if(ch==='"' && quoted && text[i+1]==='"'){cell+='"';i++;continue;}
      if(ch==='"'){quoted=!quoted;continue;}
      if(ch===',' && !quoted){row.push(cell.trim());cell='';continue;}
      if((ch==='\n'||ch==='\r') && !quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell='';continue;}
      cell+=ch;
    }
    if(cell||row.length){row.push(cell.trim());if(row.some(Boolean))rows.push(row);}
    return rows;
  }

  private priceParts(label:string){
    const numbers=(label.match(/\d+(?:[.,]\d+)?/g)||[]).map(value=>Number(value.replace(',','.')));
    return { price:numbers[0]||0, maxPrice:numbers.length>1?numbers[1]:null, requiresQuote:/a\s*m[aá]s|desde|depende|-/i.test(label) };
  }

  async importHappyDogTariff(){
    const url='https://docs.google.com/spreadsheets/d/1yh9SQ9M2eZgeeFEVO08sjL8zZXBS0wlcUT6TrPJMuUc/export?format=csv&gid=769118406';
    const response=await fetch(url); if(!response.ok) throw new BadRequestException('No se pudo leer la hoja del tarifario.');
    const rows=this.parseCsv(await response.text()).slice(2);
    const categoryNames=new Set(['TRATAMIENTOS','LABORATORIO','VACUNACIONES','CIRUGIAS','PELUQUERIA']);
    let category='OTROS'; let procedure=''; let imported=0;
    for(const columns of rows){
      const first=(columns[0]||'').trim(); const second=(columns[1]||'').trim(); const third=(columns[2]||'').trim(); const priceLabel=(columns[3]||'').replace(/\s+/g,' ').trim();
      if(first && categoryNames.has(first.toUpperCase())) category=first.toUpperCase();
      if(second) procedure=second;
      else if(first && !categoryNames.has(first.toUpperCase())) procedure=first;
      if(!procedure || !priceLabel) continue;
      const {price,maxPrice,requiresQuote}=this.priceParts(priceLabel); if(!price) continue;
      const condition=third || (second && first && !categoryNames.has(first.toUpperCase()) ? second : '');
      const species=/CANINO|FELINO/i.test([first,second].join(' ')) ? [first,second].join(' ').match(/CANINO[^,]*|FELINO/i)?.[0] || null : null;
      const name=[procedure,condition].filter(Boolean).join(' - ');
      const existing=await this.prisma.service.findFirst({where:{name,category,condition:condition||null}});
      const data={name,category,species,condition:condition||null,price,maxPrice,priceLabel,requiresQuote,active:true};
      if(existing) await this.prisma.service.update({where:{id:existing.id},data}); else await this.prisma.service.create({data});
      imported++;
    }
    return { imported };
  }

  async create(dto: CreateServiceDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Escribe el nombre del servicio.');
    const duplicate = await this.prisma.service.findFirst({ where: { name, category: dto.category?.trim() || null, condition: dto.condition?.trim() || null } });
    if (duplicate) throw new BadRequestException('Ya existe un servicio con ese nombre.');
    return this.prisma.service.create({
      data: { name, category:dto.category?.trim() || null, species:dto.species?.trim() || null, condition:dto.condition?.trim() || null, description: dto.description?.trim() || null, price: dto.price, maxPrice:dto.maxPrice ?? null, socialPrice:dto.socialPrice ?? null, priceLabel:dto.priceLabel?.trim() || null, requiresQuote:dto.requiresQuote ?? false, active: dto.active ?? true },
    });
  }

  async update(id: string, dto: Partial<CreateServiceDto>) {
    const name = dto.name?.trim();
    if (name) {
      const duplicate = await this.prisma.service.findFirst({ where: { name, category: dto.category?.trim() || undefined, condition: dto.condition?.trim() || undefined, id: { not: id } } });
      if (duplicate) throw new BadRequestException('Ya existe un servicio con ese nombre.');
    }
    return this.prisma.service.update({
      where: { id },
      data: {
        name: name || undefined,
        description: dto.description === undefined ? undefined : dto.description.trim() || null,
        category: dto.category === undefined ? undefined : dto.category.trim() || null,
        species: dto.species === undefined ? undefined : dto.species.trim() || null,
        condition: dto.condition === undefined ? undefined : dto.condition.trim() || null,
        price: dto.price === undefined ? undefined : Number(dto.price),
        maxPrice: dto.maxPrice === undefined ? undefined : Number(dto.maxPrice),
        socialPrice: dto.socialPrice === undefined ? undefined : Number(dto.socialPrice),
        priceLabel: dto.priceLabel === undefined ? undefined : dto.priceLabel.trim() || null,
        requiresQuote: dto.requiresQuote,
        active: dto.active,
      },
    });
  }
}
