import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TeamManager } from '../TeamManager';
import type { StaffAccess } from '@/types';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: push, push: vi.fn() }),
}));

const fetchMock = vi.fn();
const row = (over: Partial<StaffAccess>): StaffAccess => ({
  id: 'sa-1',
  ownerId: 'owner-1',
  staffUserId: 'user-abc12345',
  role: 'receptionist',
  permissions: 'view',
  grantedAt: '2026-08-01T00:00:00Z',
  ...over,
});

describe('TeamManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: null, error: null }),
    });
  });

  it('lists existing members with role and permission', () => {
    render(<TeamManager initialStaff={[row({})]} />);
    // staff_access carries no email yet — rows display the truncated member id
    expect(screen.getByText(/member user-abc/i)).toBeInTheDocument();
    expect(screen.getByText(/receptionist · view · since/i)).toBeInTheDocument();
  });

  it('submits an invite with the form values', async () => {
    render(<TeamManager initialStaff={[]} />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'nurse@clinic.ma' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^invite$/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/staff');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      email: 'nurse@clinic.ma',
      role: 'receptionist',
      permissions: 'view',
    });
  });

  it('surfaces API errors instead of failing silently', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Your plan does not include team seats.' }),
    });
    render(<TeamManager initialStaff={[]} />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'nurse@clinic.ma' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^invite$/i }));

    expect(await screen.findByText(/team seats/i)).toBeInTheDocument();
  });

  it('revokes after confirmation', async () => {
    render(<TeamManager initialStaff={[row({ id: 'sa-9' })]} />);

    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    fireEvent.click(screen.getByRole('button',{ name:'Confirm deletion' }));

    await waitFor(() => {
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/staff/sa-9');
      expect(init.method).toBe('DELETE');
    });
  });
});
