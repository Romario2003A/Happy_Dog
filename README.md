<div align="center">
  <h1>🐾 Happy Dog</h1>
  <p><strong>Sistema Integral de Gestión Veterinaria</strong></p>
  <p>Una plataforma moderna y completa diseñada para simplificar y profesionalizar la administración de clínicas veterinarias. Desde la agenda de citas hasta el historial clínico y la caja diaria, todo en un solo lugar.</p>
</div>

---

## ✨ Características Principales

Happy Dog está diseñado para cubrir todas las necesidades de una clínica veterinaria con paneles separados para cada tipo de usuario:

- **Portal Administrativo**: Control total del negocio. Gestiona el inventario, clientes, ventas, reportes financieros y caja diaria.
- **Consultorio Veterinario**: Acceso rápido a historiales clínicos, generación de recetas médicas en PDF y registro detallado de consultas.
- **Recepción**: Agenda diaria interactiva, creación de citas por llamada, registro rápido de clientes y generación de carnets de mascotas.
- **Portal del Cliente**: Interfaz amigable para que los dueños agenden citas, se registren usando Google OAuth y lleven control de sus mascotas.

## 🛠️ Stack Tecnológico

Construido con herramientas modernas para garantizar escalabilidad, seguridad y una excelente experiencia de usuario.

### Frontend
- **Framework:** Vue 3 (Composition API) + Vite
- **Estado y Enrutamiento:** Pinia + Vue Router
- **Peticiones:** Axios

### Backend
- **Framework:** NestJS + TypeScript
- **ORM & Base de Datos:** Prisma + PostgreSQL
- **Seguridad:** JWT, Guards, Encriptación bcrypt, Google OAuth
- **Documentación API:** Swagger integrado

---

## 🚀 Guía de Instalación Rápida

Puedes correr este proyecto localmente en tu máquina siguiendo estos pasos:

### Opción 1: Instalación Rápida (Recomendada)
Si tienes Node.js y Docker instalados, ejecuta los siguientes comandos en la raíz del proyecto:

```bash
# 1. Instalar dependencias para frontend y backend
npm run install:all

# 2. Configurar variables de entorno (copiar las plantillas)
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Levantar la base de datos, backend y frontend usando Docker Compose
npm run docker:up
```

### Opción 2: Instalación Manual
Si prefieres correr los servicios por separado sin Docker:

**1. Backend**
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev
```

**2. Frontend**
Abre una nueva terminal y ejecuta:
```bash
cd frontend
npm install
npm run dev
```

---

## 🗺️ Estructura del Sistema

Una vez que el proyecto esté corriendo, puedes acceder a los diferentes portales a través de las siguientes rutas:

| Portal | Ruta de Acceso | Descripción |
|--------|---------------|-------------|
| **Portal Cliente** | `/cliente` | Agenda pública y registro de dueños. |
| **Recepción** | `/recepcion` | Panel de agenda diaria y carnets. |
| **Veterinario** | `/veterinario` | Historias clínicas y consultas médicas. |
| **Administración**| `/admin` | Inventario, caja y reportes del negocio. |

*Nota: Todas las rutas del personal (recepción, veterinario, admin) cuentan con sus respectivos logins de seguridad bajo la ruta `/personal/login`.*

---

## ☁️ Listo para la Nube

El sistema utiliza una arquitectura de *Monolito Modular*, lo que lo hace perfecto para desplegar de forma sencilla y escalable:
- **Backend:** Render, Railway, Fly.io o cualquier VPS.
- **Base de Datos:** Supabase, Neon, Render o Railway PostgreSQL.
- **Frontend:** Vercel, Netlify o Cloudflare Pages.

---

## 🛡️ Notas para Producción

Happy Dog es una base sólida para un entorno real. Si planeas llevarlo a producción, te recomendamos:
- Configurar un dominio personalizado con certificados HTTPS.
- Implementar backups automáticos de la base de datos PostgreSQL.
- Migrar el almacenamiento local de imágenes (fotos de mascotas) a un servicio como Supabase Storage o AWS S3.

---
<div align="center">
  <p>Desarrollado con ❤️ para mejorar la atención de nuestras mascotas.</p>
</div>
