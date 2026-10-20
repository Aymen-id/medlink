import { beforeEach,expect,it,vi } from 'vitest';
const { upload,fetcher }=vi.hoisted(()=>({ upload:vi.fn(),fetcher:vi.fn() }));
vi.mock('@/lib/supabase/client',()=>({ createClient:()=>({ storage:{ from:()=>({ upload }) } }) }));
import { uploadPatientDocument } from '../client';
const patient='00000000-0000-4000-8000-000000000001';
const reservation='00000000-0000-4000-8000-000000000002';
beforeEach(()=>{ vi.clearAllMocks();vi.stubGlobal('fetch',fetcher); });
it('transports file bytes directly to Storage and only JSON through the app',async()=>{
  const file=new File(['pdf'],'report.pdf',{ type:'application/pdf' });
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ data:{ id:reservation,storage_path:'workspace/patient/object' } }),{ status:201 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ success:true }),{ status:200 }));
  upload.mockResolvedValue({ error:null });
  expect(await uploadPatientDocument(patient,null,file,[])).toEqual({ error:null });
  expect(upload).toHaveBeenCalledWith('workspace/patient/object',file,{ contentType:'application/pdf',upsert:false });
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ patientId:patient,sizeBytes:3 });
  expect(fetcher.mock.calls[1][0]).toBe(`/api/uploads/${reservation}`);
});
it('cancels a reservation after a Storage failure',async()=>{
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ data:{ id:reservation,storage_path:'workspace/patient/object' } }),{ status:201 }))
    .mockResolvedValueOnce(new Response('{}'));
  upload.mockResolvedValue({ error:{ message:'Upload interrupted' } });
  expect((await uploadPatientDocument(patient,null,new File(['x'],'report.pdf',{ type:'application/pdf' }),[])).error).toContain('interrupted');
  expect(fetcher).toHaveBeenLastCalledWith(`/api/uploads/${reservation}`,{ method:'DELETE' });
});
