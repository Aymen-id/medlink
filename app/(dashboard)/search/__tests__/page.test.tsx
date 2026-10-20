// @vitest-environment node
import { expect,it,vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
const { files,patients }=vi.hoisted(()=>({ files:vi.fn(),patients:vi.fn() }));
vi.mock('@/lib/supabase/context',()=>({ getUserContext:async()=>({ ownerId:'owner' }) }));
vi.mock('@/lib/supabase/server',()=>({ createClient:async()=>({}) }));
vi.mock('@/lib/repositories/file.repository',()=>({ FileRepository:class { search=files; } }));
vi.mock('@/lib/repositories/patient.repository',()=>({ PatientRepository:class { search=patients; } }));
import SearchPage from '../page';
it('loads requested independent search pages and exposes database errors',async()=>{
  files.mockResolvedValue({ data:[],error:'Search unavailable' });patients.mockResolvedValue({ data:[],error:null });
  const result=await SearchPage({ searchParams:Promise.resolve({ q:'echo',filePage:'3',patientPage:'2' }) });
  expect(files).toHaveBeenCalledWith('echo',3,20);expect(patients).toHaveBeenCalledWith('echo',2,20);
  expect(renderToStaticMarkup(result)).toContain('Search unavailable');
});
