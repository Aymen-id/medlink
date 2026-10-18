import { expect,it,vi } from 'vitest';
import { fireEvent,render,screen } from '@testing-library/react';
import { ConfirmAction } from '@/components/ui/confirm-action';
it('requires an explicit dialog confirmation and keeps failed actions recoverable',async()=>{
  const remove=vi.fn().mockResolvedValue({ error:'Deletion unavailable' });
  render(<ConfirmAction triggerLabel="Delete example" title="Delete patient?" description="This permanently removes the record." onConfirm={remove} />);
  fireEvent.click(screen.getByRole('button',{ name:'Delete example' }));
  expect(remove).not.toHaveBeenCalled();expect(screen.getByRole('dialog')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{ name:'Confirm deletion' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Deletion unavailable');
  expect(screen.getByRole('button',{ name:'Cancel' })).toBeEnabled();
});
