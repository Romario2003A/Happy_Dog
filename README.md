# Veterinaria 2.0 Profesional

Sistema integral para veterinaria: portal cliente, recepción, veterinario y administrador.

## Stack
- Frontend: Vue 3 + Vite + Vue Router + Pinia + Axios
- Backend: NestJS + Prisma
- Base de datos: PostgreSQL
- Seguridad: JWT, roles, guards, validaciones DTO
- Archivos: módulo local preparado para reemplazar por Supabase Storage/S3
- PDF: generación de receta/comprobante desde backend

## Principios de arquitectura
- Monolito modular: más simple que microservicios, pero escalable.
- Separación por módulos: auth, usuarios, clientes, mascotas, citas, historia clínica, inventario, ventas, archivos y reportes.
- No contiene datos predefinidos del cliente. El sistema inicia vacío.
- Los usuarios iniciales se crean desde endpoint protegido/seed opcional o desde base de datos según despliegue.

## Instalación local

```bash
npm run install:all
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
npm run docker:up
```

Otra forma:

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev

cd ../frontend
npm install
npm run dev
```

## Rutas del sistema
- `/cliente` Portal público para agendar citas.
- `/recepcion/login` Login recepción.
- `/recepcion` Panel recepción.
- `/veterinario/login` Login veterinario.
- `/veterinario` Consultorio veterinario.
- `/admin/login` Login administración.
- `/admin` Panel administrador.

## Variables principales
Ver `backend/.env.example` y `frontend/.env.example`.

## Preparado para nube
Puedes desplegar:
- Backend NestJS en Render, Railway, Fly.io o VPS.
- PostgreSQL en Supabase, Neon, Render PostgreSQL o Railway PostgreSQL.
- Frontend Vue en Vercel, Netlify o Cloudflare Pages.

## Nota importante
Este proyecto es una base profesional funcional para desarrollo académico/productivo. Para producción real se recomienda configurar dominio, HTTPS, backups, monitoreo, almacenamiento externo de archivos, facturación electrónica según normativa local y pruebas automatizadas completas.
