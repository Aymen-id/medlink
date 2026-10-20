import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TeamManager } from '../TeamManager';
vi.mock('next/navigation', () => ({ useRouter:() => ({ refresh:vi.fn() }) }));
it('shows refreshed server membership data instead of retaining the first list', () => {
  const member = { id:'access-1',ownerId:'owner-1',staffUserId:'staff-one',role:'assistant' as const,permissions:'view' as const,grantedAt:'2026-10-17' };
  const { rerender } = render(<TeamManager initialStaff={[member]} />);
  rerender(<TeamManager initialStaff={[{ ...member,staffUserId:'staff-two' }]} />);
  expect(screen.getByTitle('staff-two')).toBeInTheDocument();
  expect(screen.queryByTitle('staff-one')).not.toBeInTheDocument();
});
