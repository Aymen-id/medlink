import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
const { signUp, push, refresh } = vi.hoisted(() => ({ signUp: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/repositories/auth.repository', () => ({ AuthRepository: class { signUp = signUp; } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));
import SignupPage from '../page';

beforeEach(() => vi.clearAllMocks());
it('shows an email confirmation message when signup returns no session', async () => {
  signUp.mockResolvedValue({ data: { user: { id: 'user-1' }, session: null }, error: null });
  render(<SignupPage />);
  fireEvent.change(screen.getByLabelText('Full Name & Title'), { target: { value: 'Dr Synthetic' } });
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'synthetic@example.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Synthetic123!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
  await waitFor(() => expect(signUp).toHaveBeenCalled());
  expect(await screen.findByRole('status')).toHaveTextContent('Check your email');
  expect(push).not.toHaveBeenCalled();
});
