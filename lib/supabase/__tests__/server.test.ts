import { beforeEach, describe, expect, it, vi } from 'vitest';

const { store, factory } = vi.hoisted(() => ({
  store: { getAll: vi.fn().mockReturnValue([{ name: 'sb-auth-token', value: 'session-token' }]), set: vi.fn() },
  factory: vi.fn(),
}));
vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue(store) }));
vi.mock('@supabase/ssr', () => ({ createServerClient: factory }));
import { createClient } from '../server';

describe('server Supabase client on async Next.js request APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'synthetic-anon-key');
  });

  it('awaits cookies before reading the incoming auth token', async () => {
    await createClient();
    const options = factory.mock.calls[0][2];
    expect(options.cookies.getAll()).toEqual([{ name: 'sb-auth-token', value: 'session-token' }]);
    expect(store.getAll).toHaveBeenCalled();
  });
});
