import { expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PricingTable } from '@/components/dashboard/PricingTable';

it('selects one billing interval by keyboard and preserves the annual purchase arguments', async () => {
  const user = userEvent.setup();
  const select = vi.fn();
  render(<PricingTable currentTier="pro" currentInterval="monthly" onSelectTier={select} />);

  const monthly = within(screen.getByRole('group', { name: 'Billing interval' })).getByRole('radio', { name: 'Monthly' });
  const annual = screen.getByRole('radio', { name: /Annual/ });
  expect(monthly).toBeChecked();
  expect(annual).not.toBeChecked();
  monthly.focus();
  await user.keyboard('{ArrowRight}');
  expect(annual).toHaveFocus();
  expect(annual).toBeChecked();
  expect(monthly).not.toBeChecked();
  expect(screen.getByText('Billed $278.4/year')).toBeVisible();
  expect(select).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Change Pro billing' }));
  expect(select).toHaveBeenCalledExactlyOnceWith('pro', 'annual');
});

it('makes unavailable features explicit and keeps the current plan identifiable', () => {
  render(<PricingTable currentTier="free" onSelectTier={vi.fn()} />);

  const free = screen.getByRole('article', { name: 'Free' });
  const features = within(free).getAllByRole('listitem');
  expect(features).toHaveLength(9);
  expect(features.every(feature => /Included|Not included/.test(feature.textContent ?? ''))).toBe(true);
  expect(within(free).getAllByText('Not included', { exact: true })).toHaveLength(3);
  expect(within(free).getByText('Current Plan')).toBeVisible();
  expect(screen.getAllByText('Current Plan')).toHaveLength(1);
});

it.each(['pro', 'clinic'] as const)('preserves the current %s plan and disables purchases during loading', async tier => {
  const select = vi.fn();
  const user = userEvent.setup();
  render(<PricingTable currentTier={tier} currentInterval="annual" loading onSelectTier={select} />);

  expect(screen.getByRole('radio', { name: /Annual/ })).toBeChecked();
  expect(within(screen.getByRole('article', { name: tier === 'pro' ? 'Pro' : 'Clinic' })).getByText('Current Plan')).toBeVisible();
  const purchase = screen.getByRole('button', { name: tier === 'pro' ? 'Switch to Clinic' : 'Switch to Pro' });
  expect(purchase).toBeDisabled();
  await user.click(purchase);
  expect(select).not.toHaveBeenCalled();
});
