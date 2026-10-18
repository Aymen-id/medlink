import { beforeEach, expect, it, vi } from 'vitest';
const { selected, from, getUser, chain } = vi.hoisted(() => ({
  selected: { value: undefined as string | undefined },
  from: vi.fn(), getUser: vi.fn(),
  chain: { select: vi.fn(), eq: vi.fn(), order: vi.fn(), single: vi.fn() },
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => selected.value ? { value: selected.value } : undefined }) }));
vi.mock('./../server', () => ({ createClient: async () => ({ from, auth: { getUser } }) }));
import { getUserContext } from '../context';
const own = '00000000-0000-4000-8000-000000000001';
const invited = '00000000-0000-4000-8000-000000000002';
const rows = [
  { workspace_id: own, user_id: own, role: 'owner', permissions: 'edit', physician_workspaces: { id: own, owner_user_id: own, billing_account_id: '10000000-0000-4000-8000-000000000001', doctor_profiles: { display_name: 'Personal', avatar_url: null } } },
  { workspace_id: invited, user_id: own, role: 'assistant', permissions: 'view', physician_workspaces: { id: invited, owner_user_id: invited, billing_account_id: '10000000-0000-4000-8000-000000000002', doctor_profiles: { display_name: 'Invited', avatar_url: null } } },
];
beforeEach(() => {
  vi.clearAllMocks(); selected.value = undefined;
  getUser.mockResolvedValue({ data: { user: { id: own, email: 'synthetic@example.test' } } });
  from.mockReturnValue(chain); chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain);
  chain.order.mockResolvedValue({ data: rows, error: null });
  chain.single.mockResolvedValue({ data: { id: own, display_name: 'Personal', avatar_url: null }, error: null });
});
it('allows selecting an invited workspace even when the user owns a personal profile', async () => {
  selected.value = invited;
  const context = await getUserContext();
  expect(context?.ownerId).toBe(invited);
  expect(context?.role).toBe('assistant');
  expect(context?.permissions).toBe('view');
});
it('rejects a workspace cookie that is not one of the verified memberships', async () => {
  selected.value = '00000000-0000-4000-8000-000000000099';
  expect(await getUserContext()).toBeNull();
});
it('defaults to the personal workspace when no selection was made', async () => {
  expect((await getUserContext())?.ownerId).toBe(own);
});
