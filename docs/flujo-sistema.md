# Flujo principal

1. Cliente solicita cita desde `/cliente` o por teléfono.
2. Recepción registra o confirma cita.
3. Recepción cambia estado a `WAITING` cuando llega la mascota.
4. Veterinario atiende y registra historia clínica.
5. Veterinario prescribe productos del inventario.
6. El backend descuenta stock automáticamente dentro de una transacción.
7. Caja procesa venta y comprobante.
8. El historial clínico queda asociado a la mascota.
