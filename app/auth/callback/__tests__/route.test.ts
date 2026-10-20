// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const { exchange, verify } = vi.hoisted(() => ({ exchange: vi.fn(), verify: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({ auth: { exchangeCodeForSession: exchange, verifyOtp: verify } })) }));
import { GET } from '../route';

describe('authentication callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example');
    exchange.mockResolvedValue({ data: {}, error: null });
    verify.mockResolvedValue({ data: {}, error: null });
  });

  it('exchanges a PKCE code and rejects external return destinations', async () => {
    const response = await GET(new NextRequest('https://untrusted-host.example/auth/callback?code=synthetic&next=https://evil.example'));
    expect(exchange).toHaveBeenCalledWith('synthetic');
    expect(response.headers.get('location')).toBe('https://app.example/patients');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('verifies a recovery token and opens the password update page', async () => {
    const response = await GET(new NextRequest('https://app.example/auth/callback?token_hash=synthetic&type=recovery'));
    expect(verify).toHaveBeenCalledWith({ token_hash: 'synthetic', type: 'recovery' });
    expect(response.headers.get('location')).toBe('https://app.example/reset-password/update');
  });
  it('verifies an invitation token and requires password setup before Team Access',async()=>{
    const response=await GET(new NextRequest('https://app.example/auth/callback?token_hash=synthetic&type=invite&next=%2Fsettings%2Fteam'));
    expect(verify).toHaveBeenCalledWith({token_hash:'synthetic',type:'invite'});
    expect(response.headers.get('location')).toBe('https://app.example/reset-password/update?next=%2Fsettings%2Fteam');
  });

  it('shows an expired-link destination on recovery failure without echoing tokens', async () => {
    verify.mockResolvedValue({ data: {}, error: { message: 'Token expired' } });
    const response = await GET(new NextRequest('https://app.example/auth/callback?token_hash=private-token&type=recovery'));
    expect(response.headers.get('location')).toBe('https://app.example/reset-password/update?error=expired');
  });

  it('rejects unrecognized OTP types without contacting Auth', async () => {
    await GET(new NextRequest('https://app.example/auth/callback?token_hash=synthetic&type=admin'));
    expect(verify).not.toHaveBeenCalled();
    expect(exchange).not.toHaveBeenCalled();
  });
});
