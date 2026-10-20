import { expect,it,vi } from 'vitest';
import { fireEvent,render,screen,waitFor } from '@testing-library/react';
import { PatientControls } from '../PatientControls';
const { update,remove }=vi.hoisted(()=>({ update:vi.fn(),remove:vi.fn() }));
vi.mock('../../actions',()=>({ updatePatient:update,deletePatient:remove }));
vi.mock('next/navigation',()=>({ useRouter:()=>({ refresh:vi.fn(),push:vi.fn() }) }));
const patient={ id:'10000000-0000-4000-8000-000000000001',ownerId:'owner',firstName:'Original',lastName:'Patient',dateOfBirth:null,gender:null,phone:null,email:null,createdAt:'2026-10-17',updatedAt:'2026-10-17' };
it('edits an existing patient and displays persistence failures',async()=>{
  update.mockResolvedValue({ error:'Update failed' });
  render(<PatientControls patient={patient} />);
  fireEvent.click(screen.getByRole('button',{ name:'Edit patient' }));
  fireEvent.change(screen.getByLabelText('First name'),{ target:{ value:'Updated' } });
  fireEvent.click(screen.getByRole('button',{ name:'Save changes' }));
  await waitFor(()=>expect(update).toHaveBeenCalledWith(patient.id,expect.objectContaining({ firstName:'Updated',dateOfBirth:'' })));
  expect(await screen.findByRole('alert')).toHaveTextContent('Update failed');
});
