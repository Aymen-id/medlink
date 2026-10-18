// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const { getUser, updateUser } = vi.hoisted(() => ({ getUser: vi.fn(), updateUser: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser, updateUser } }) }));
import { updateRecoveredPassword } from '../actions';

beforeEach(() => vi.clearAllMocks());
const input = () => {
  const form = new FormData();
  form.set('password', 'SyntheticPassword123!');
  form.set('confirmPassword', 'SyntheticPassword123!');
  return form;
};
it('rejects expired or unauthenticated recovery sessions', async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await updateRecoveredPassword({}, input())).error).toContain('expired');
  expect(updateUser).not.toHaveBeenCalled();
});
it('validates matching passwords before changing credentials', async () => {
  const form = input(); form.set('confirmPassword', 'different');
  expect((await updateRecoveredPassword({}, form)).error).toBeTruthy();
  expect(updateUser).not.toHaveBeenCalled();
});
it('updates the password only for a verified user', async () => {
  getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  updateUser.mockResolvedValue({ error: null });
  expect(await updateRecoveredPassword({}, input())).toEqual({ success: true });
  expect(updateUser).toHaveBeenCalledWith({ password: 'SyntheticPassword123!' });
});
