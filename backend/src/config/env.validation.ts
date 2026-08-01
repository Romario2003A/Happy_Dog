const insecureJwtSecrets = new Set([
  'dev_secret',
  'change_this_secret_for_production',
  'secret',
]);

export function validateEnvironment(config: Record<string, unknown>) {
  const isProduction = String(config.NODE_ENV || '').toLowerCase() === 'production'
    || String(config.RENDER || '').toLowerCase() === 'true';
  const jwtSecret = String(config.JWT_SECRET || '');
  const corsOrigin = String(config.CORS_ORIGIN || '');

  if (!jwtSecret) throw new Error('JWT_SECRET es obligatorio.');
  if (isProduction && (jwtSecret.length < 32 || insecureJwtSecrets.has(jwtSecret))) {
    throw new Error('JWT_SECRET debe ser unico y tener al menos 32 caracteres en produccion.');
  }
  if (isProduction && !corsOrigin.trim()) {
    throw new Error('CORS_ORIGIN es obligatorio en produccion.');
  }

  return config;
}
