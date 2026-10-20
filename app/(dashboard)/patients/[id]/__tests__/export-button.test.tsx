import { expect,it,vi } from 'vitest';
import { fireEvent,render,screen } from '@testing-library/react';
import { ExportButton } from '../ExportButton';
it('shows an export failure instead of silently downloading error JSON',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({ error:'A source document is missing' }),{ status:502 })));
  render(<ExportButton patientId="patient" />);
  fireEvent.click(screen.getByRole('button',{ name:'Export all files (ZIP)' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('A source document is missing');
  vi.unstubAllGlobals();
});
