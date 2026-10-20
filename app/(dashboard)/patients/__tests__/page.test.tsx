// @vitest-environment node
import { expect,it,vi } from 'vitest';
const { getPatients }=vi.hoisted(()=>({ getPatients:vi.fn() }));
vi.mock('../actions',()=>({ getPatients }));
vi.mock('@/lib/supabase/context',()=>({ getUserContext:async()=>({ permissions:'view' }) }));
vi.mock('../PatientClientList',()=>({ PatientList:()=>null }));
import PatientsPage from '../page';
it('loads the requested patient page so records beyond the first fifty remain reachable',async()=>{
  getPatients.mockResolvedValue({ data:[],error:null,meta:{ page:3,limit:50,total:120,totalPages:3 } });
  await PatientsPage({ searchParams:Promise.resolve({ page:'3' }) });
  expect(getPatients).toHaveBeenCalledWith(3,50);
});
