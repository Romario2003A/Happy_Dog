import { stripSensitiveFields } from './sensitive-fields.interceptor';

describe('stripSensitiveFields', () => {
  it('removes password hashes recursively', () => {
    expect(stripSensitiveFields({
      id: 'client-1',
      passwordHash: 'never-return-this',
      appointments: [{ client: { email: 'client@example.com', passwordHash: 'nested-secret' } }],
    })).toEqual({
      id: 'client-1',
      appointments: [{ client: { email: 'client@example.com' } }],
    });
  });
});
