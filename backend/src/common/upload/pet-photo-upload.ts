import { BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';

const MAX_PHOTO_SIZE = 4 * 1024 * 1024;
const PET_PHOTO_DIR = join(process.cwd(), 'uploads', 'pets');

export const petPhotoUploadOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      if (!existsSync(PET_PHOTO_DIR)) mkdirSync(PET_PHOTO_DIR, { recursive: true });
      cb(null, PET_PHOTO_DIR);
    },
    filename: (_req, file, cb) => {
      const extension = extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `pet-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`);
    },
  }),
  fileFilter: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    if (!/^image\/(jpeg|png)$/i.test(file.mimetype)) {
      cb(new BadRequestException('Solo se permiten imagenes JPG o PNG para el carnet.'), false);
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: MAX_PHOTO_SIZE },
};

export function publicUploadUrl(req: Request, path: string) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0];
  const protocol = forwardedProto || req.protocol || 'http';
  return `${protocol}://${req.get('host')}${path}`;
}

