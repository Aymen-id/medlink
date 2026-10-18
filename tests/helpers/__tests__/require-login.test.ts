// @vitest-environment node
import { expect,it,vi } from 'vitest';
import { requireLogin } from '../require-login';
it('fails authentication setup when login never reaches the protected route',async()=>{
  const field={ fill:vi.fn(),click:vi.fn() };
  const page={ goto:vi.fn(),locator:()=>field,waitForURL:vi.fn().mockRejectedValue(new Error('Login rejected')) };
  await expect(requireLogin(page,{ email:'synthetic@test.example',password:'synthetic-password' })).rejects.toThrow('Login rejected');
});
it('fails clearly when test credentials are missing',async()=>{
  const page={ goto:vi.fn(),locator:()=>({ fill:vi.fn(),click:vi.fn() }),waitForURL:vi.fn() };
  await expect(requireLogin(page,{})).rejects.toThrow('TEST_USER_EMAIL');expect(page.goto).not.toHaveBeenCalled();
});
