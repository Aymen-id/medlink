import { expect,it,vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cleanupExpiredUploads } from '../cleanup';

function client(removeError:string | null) {
  const query={ select:vi.fn(),order:vi.fn(),limit:vi.fn(),delete:vi.fn(),in:vi.fn() };
  for(const method of ['select','order'] as const) query[method].mockReturnValue(query);
  query.limit.mockResolvedValue({ data:[{ storage_path:'workspace/patient/object' }],error:null });
  query.delete.mockReturnValue(query);query.in.mockResolvedValue({ error:null });
  const remove=vi.fn().mockResolvedValue({ error:removeError ? { message:removeError } : null });
  const rpc=vi.fn().mockResolvedValue({ error:null });
  return { supabase:{ from:()=>query,rpc,storage:{ from:()=>({ remove }) } } as unknown as SupabaseClient,query,remove,rpc };
}
it('marks cleanup complete only after Storage removal succeeds',async()=>{
  const mock=client(null);
  expect(await cleanupExpiredUploads(mock.supabase)).toEqual({ cleaned:1,error:null });
  expect(mock.remove).toHaveBeenCalledWith(['workspace/patient/object']);
  expect(mock.rpc).toHaveBeenCalledWith('queue_expired_uploads');
  expect(mock.query.delete).toHaveBeenCalled();
});
it('keeps failed removals available for retry',async()=>{
  const mock=client('Storage unavailable');
  expect((await cleanupExpiredUploads(mock.supabase)).error).toBeTruthy();
  expect(mock.query.delete).not.toHaveBeenCalled();
});
