import { expect,it,vi } from 'vitest';
import { render,screen,fireEvent } from '@testing-library/react';
import { BillingClient } from '../BillingClient';
import { PricingTable } from '../PricingTable';
it('shows rejected purchases and leaves retry available',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({ error:'Billing is busy. Retry shortly.' }),{ status:503 })));
  render(<BillingClient subscription={null} />);
  fireEvent.click(screen.getByRole('button',{ name:'Upgrade to Pro' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Billing is busy');
  expect(screen.getByRole('button',{ name:'Upgrade to Pro' })).toBeEnabled();
  vi.unstubAllGlobals();
});
it('allows changing the billing interval of the current plan',()=>{
  const select=vi.fn();render(<PricingTable currentTier="pro" currentInterval="monthly" onSelectTier={select} />);
  fireEvent.click(screen.getByRole('radio',{ name:/Annual/ }));
  fireEvent.click(screen.getByRole('button',{ name:'Change Pro billing' }));
  expect(select).toHaveBeenCalledWith('pro','annual');
});
