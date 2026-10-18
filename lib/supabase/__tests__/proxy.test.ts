// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const { factory, getUser } = vi.hoisted(() => ({ factory: vi.fn(), getUser: vi.fn() }));
vi.mock('@supabase/ssr', () => ({ createServerClient: factory }));
import { proxy } from '@/proxy';

describe('session proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'synthetic-anon');
    factory.mockReturnValue({ auth: { getUser } });
    getUser.mockResolvedValue({ data: { user: null } });
  });

  it('keeps all refreshed cookie chunks and cache headers on an auth redirect', async () => {
    getUser.mockImplementation(async () => {
      factory.mock.calls[0][2].cookies.setAll([
        { name: 'sb-token.0', value: 'chunk-0', options: { httpOnly: true } },
        { name: 'sb-token.1', value: 'chunk-1', options: { httpOnly: true } },
      ]);
      return { data: { user: { id: 'user-1' } } };
    });
    const result = await proxy(new NextRequest('https://app.example/login'));
    expect(result.headers.get('location')).toBe('https://app.example/patients');
    expect(result.cookies.get('sb-token.0')?.value).toBe('chunk-0');
    expect(result.cookies.get('sb-token.1')?.value).toBe('chunk-1');
    expect(result.headers.get('cache-control')).toContain('no-store');
  });

  it('protects search as well as other dashboard routes', async () => {
    const result = await proxy(new NextRequest('https://app.example/search?q=synthetic'));
    expect(result.headers.get('location')).toBe('https://app.example/login?next=%2Fsearch%3Fq%3Dsynthetic');
  });

  it('keeps the password update page accessible for an authenticated recovery session', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const result = await proxy(new NextRequest('https://app.example/reset-password/update'));
    expect(result.headers.get('location')).toBeNull();
  });
});
