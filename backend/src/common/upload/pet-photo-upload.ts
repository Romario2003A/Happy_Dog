import { BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { memoryStorage } from 'multer';

const MAX_PHOTO_SIZE = 4 * 1024 * 1024;
export const petPhotoUploadOptions = {
  storage: memoryStorage(),
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

export function uploadedFileDataUrl(file: Express.Multer.File) {
  return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
}

