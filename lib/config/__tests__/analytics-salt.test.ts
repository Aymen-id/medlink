import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { hashIp } from '@/lib/repositories/analytics.repository';

it('refuses visitor hashing without a configured salt', async () => {
  vi.stubEnv('IP_HASH_SALT', '');
  await expect(hashIp('192.0.2.1')).rejects.toThrow('IP_HASH_SALT');
});
