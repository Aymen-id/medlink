// @vitest-environment node
import { beforeEach,expect,it,vi } from 'vitest';
const { create,update,list }=vi.hoisted(()=>({ create:vi.fn(),update:vi.fn(),list:vi.fn() }));
vi.mock('next/cache',()=>({ revalidatePath:vi.fn() }));
vi.mock('@/lib/supabase/context',()=>({ getUserContext:async()=>({ userId:'user',ownerId:'owner',permissions:'edit' }) }));
vi.mock('@/lib/supabase/server',()=>({ createClient:async()=>({}) }));
vi.mock('@/lib/supabase/admin',()=>({ createAdminClient:()=>({}) }));
vi.mock('@/lib/repositories/patient.repository',()=>({ PatientRepository:class { create=create;update=update;list=list; } }));
import { createPatient,updatePatient,getPatients } from '../actions';
beforeEach(()=>{ vi.clearAllMocks();create.mockResolvedValue({ data:{ id:'patient' },error:null }); });
it('rejects invalid patient input on the server before persistence',async()=>{
  expect((await createPatient({ firstName:'A',lastName:'Valid' })).error).toBeTruthy();
  expect(create).not.toHaveBeenCalled();
});
it('normalizes an empty optional date to null before persistence',async()=>{
  await createPatient({ firstName:'Synthetic',lastName:'Patient',dateOfBirth:'' });
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ dateOfBirth:null }));
});
it('rejects malformed IDs and pagination outside the bounded range',async()=>{
  expect((await updatePatient('not-an-id',{ firstName:'Synthetic' })).error).toBeTruthy();
  expect((await getPatients(0,5000)).error).toBeTruthy();
  expect(update).not.toHaveBeenCalled();expect(list).not.toHaveBeenCalled();
});
