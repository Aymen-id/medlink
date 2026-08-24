import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadFileAction } from '../actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/supabase/context', () => ({
  getUserContext: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({})),
}));

const countByOwner = vi.fn();
const upload = vi.fn();
vi.mock('@/lib/repositories/file.repository', () => ({
  FileRepository: vi.fn(function FileRepositoryMock() {
    return { countByOwner, upload };
  }),
}));

const getTier = vi.fn();
vi.mock('@/lib/repositories/subscription.repository', () => ({
  SubscriptionRepository: vi.fn(function SubscriptionRepoMock() {
    return { getTier };
  }),
}));

import { getUserContext } from '@/lib/supabase/context';

function makeForm(): FormData {
  const fd = new FormData();
  fd.append('file', new File(['x'], 'chart.pdf', { type: 'application/pdf' }));
  return fd;
}

describe('uploadFileAction tier gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserContext).mockResolvedValue({
      userId: 'user-1',
      email: 'dr@example.com',
      role: 'owner',
      ownerId: 'owner-1',
      permissions: undefined,
    });
    upload.mockResolvedValue({ data: { id: 'file-1' }, error: null });
  });

  it('blocks the upload when a free-tier owner hits the 10-file cap', async () => {
    getTier.mockResolvedValue('free');
    countByOwner.mockResolvedValue({ data: 10, error: null });

    const result = await uploadFileAction('patient-1', null, makeForm());

    expect(result.error).toMatch(/limit reached/i);
    expect(upload).not.toHaveBeenCalled();
  });

  it('allows the upload below the cap', async () => {
    getTier.mockResolvedValue('free');
    countByOwner.mockResolvedValue({ data: 9, error: null });

    const result = await uploadFileAction('patient-1', null, makeForm());

    expect(result.error).toBeNull();
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0][0]).toMatchObject({
      patientId: 'patient-1',
      folderId: null,
    });
  });

  it('never blocks unlimited tiers regardless of count', async () => {
    getTier.mockResolvedValue('pro');
    countByOwner.mockResolvedValue({ data: 500, error: null });

    const result = await uploadFileAction('patient-1', null, makeForm());

    expect(result.error).toBeNull();
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('still denies view-only staff before any cap logic runs', async () => {
    vi.mocked(getUserContext).mockResolvedValue({
      userId: 'user-2',
      email: 'reception@example.com',
      role: 'receptionist',
      ownerId: 'owner-1',
      permissions: 'view',
    });
    getTier.mockResolvedValue('free');
    countByOwner.mockResolvedValue({ data: 3, error: null });

    const result = await uploadFileAction('patient-1', null, makeForm());

    expect(result.error).toMatch(/permission denied/i);
    expect(countByOwner).not.toHaveBeenCalled();
  });
});
