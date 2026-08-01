import { BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';

export const CLINICAL_FILE_DIR = join(process.cwd(), 'uploads', 'clinical');
const MAX_CLINICAL_FILE_SIZE = 10 * 1024 * 1024;
const allowedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const extensionsByMimeType: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

export const clinicalFileUploadOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      if (!existsSync(CLINICAL_FILE_DIR)) mkdirSync(CLINICAL_FILE_DIR, { recursive: true });
      cb(null, CLINICAL_FILE_DIR);
    },
    filename: (_req, file, cb) => {
      const extension = extensionsByMimeType[file.mimetype] || extname(file.originalname).toLowerCase();
      cb(null, `clinical-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`);
    },
  }),
  fileFilter: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new BadRequestException('Solo se permiten archivos PDF, JPG o PNG.'), false);
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: MAX_CLINICAL_FILE_SIZE, files: 1 },
};
