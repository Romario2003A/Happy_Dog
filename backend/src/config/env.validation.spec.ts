import { validateEnvironment } from './env.validation';

describe('validateEnvironment', () => {
  it('rejects missing JWT secrets', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'development' })).toThrow('JWT_SECRET');
  });

  it('rejects weak production JWT secrets', () => {
    expect(() => validateEnvironment({
      NODE_ENV: 'production',
      JWT_SECRET: 'dev_secret',
      CORS_ORIGIN: 'https://happy-dog-pi.vercel.app',
    })).toThrow('32 caracteres');
  });

  it('requires an explicit production CORS origin', () => {
    expect(() => validateEnvironment({
      NODE_ENV: 'production',
      JWT_SECRET: 'a-secure-production-secret-with-more-than-32-characters',
    })).toThrow('CORS_ORIGIN');
  });

  it('accepts secure production configuration', () => {
    const config = {
      NODE_ENV: 'production',
      JWT_SECRET: 'a-secure-production-secret-with-more-than-32-characters',
      CORS_ORIGIN: 'https://happy-dog-pi.vercel.app',
    };
    expect(validateEnvironment(config)).toBe(config);
  });

  it('treats Render as production even without NODE_ENV', () => {
    expect(() => validateEnvironment({
      RENDER: 'true',
      JWT_SECRET: 'dev_secret',
      CORS_ORIGIN: 'https://happy-dog-pi.vercel.app',
    })).toThrow('32 caracteres');
  });
});
