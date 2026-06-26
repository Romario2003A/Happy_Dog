# Arquitectura

## Decisión principal
Se eligió monolito modular con NestJS. Es más mantenible para un proyecto académico/productivo inicial que microservicios.

## Módulos
- Auth: login JWT.
- Users: usuarios y roles.
- Clients: dueños.
- Pets: pacientes.
- Appointments: citas y estados.
- Medical Records: historia clínica y recetas.
- Inventory: productos y stock.
- Sales: caja/POS.
- Files: archivos clínicos.
- Reports: métricas administrativas.

## Seguridad
- JWT Bearer Token.
- Roles: ADMIN, RECEPTIONIST, VETERINARIAN.
- Validaciones DTO.
- Helmet y CORS.
- Contraseñas con bcrypt.

## Escalabilidad futura
- Reemplazar almacenamiento local por Supabase Storage o S3.
- Agregar jobs para recordatorios WhatsApp/correo.
- Agregar multi-sucursal.
- Facturación electrónica según normativa local.
