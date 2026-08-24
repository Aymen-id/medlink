import { describe, it, expect, vi, beforeEach } from 'vitest';

const inviteUserByEmail = vi.fn();
const listUsers = vi.fn();

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    auth: { admin: { inviteUserByEmail, listUsers } },
  })),
}));

import { resolveStaffUserIdByEmail } from '../staff-users';

describe('resolveStaffUserIdByEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the invited user id when invite succeeds', async () => {
    inviteUserByEmail.mockResolvedValue({
      data: { user: { id: 'new-user-1' } },
      error: null,
    });

    const result = await resolveStaffUserIdByEmail('new@clinic.ma');

    expect(result).toEqual({ id: 'new-user-1', error: null });
  });

  it('falls back to listing users when the email is already registered', async () => {
    inviteUserByEmail.mockResolvedValue({
      data: { user: null },
      error: { message: 'A user with this email address has already been registered' },
    });
    listUsers.mockResolvedValue({
      data: {
        users: [
          { id: 'u-other', email: 'someone@else.ma' },
          { id: 'u-match', email: 'Existing@Clinic.ma' },
        ],
      },
      error: null,
    });

    const result = await resolveStaffUserIdByEmail('existing@clinic.ma');

    expect(result).toEqual({ id: 'u-match', error: null });
  });

  it('errors when registered-but-unlisted', async () => {
    inviteUserByEmail.mockResolvedValue({
      data: { user: null },
      error: { message: 'A user with this email address has already been registered' },
    });
    listUsers.mockResolvedValue({ data: { users: [] }, error: null });

    const result = await resolveStaffUserIdByEmail('ghost@clinic.ma');

    expect(result.id).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it('propagates unrelated admin errors', async () => {
    inviteUserByEmail.mockResolvedValue({
      data: { user: null },
      error: { message: 'SMTP unavailable' },
    });

    const result = await resolveStaffUserIdByEmail('x@y.z');

    expect(result).toEqual({ id: null, error: 'SMTP unavailable' });
  });
});
