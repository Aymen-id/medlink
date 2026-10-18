// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const { memberships, getUser } = vi.hoisted(() => ({ memberships: vi.fn(), getUser: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser } }) }));
vi.mock('@/lib/supabase/workspaces', () => ({ WORKSPACE_COOKIE: 'medilink-workspace', getAccessibleWorkspaces: memberships }));
import { POST } from '../route';
const workspace = '00000000-0000-4000-8000-000000000001';
const request = () => new NextRequest('https://app.example/api/workspaces/select', { method:'POST', body:JSON.stringify({ workspaceId:workspace }) });
beforeEach(() => { vi.clearAllMocks(); getUser.mockResolvedValue({ data:{ user:{ id:'user-1' } } }); });
it('rejects a forged workspace selection without setting a cookie', async () => {
  memberships.mockResolvedValue([]);
  const response = await POST(request());
  expect(response.status).toBe(403); expect(response.cookies.getAll()).toHaveLength(0);
});
it('sets an HttpOnly preference only after verifying current membership', async () => {
  memberships.mockResolvedValue([{ workspace_id:workspace }]);
  const response = await POST(request());
  expect(response.status).toBe(200); expect(response.cookies.get('medilink-workspace')?.httpOnly).toBe(true);
});
