import { expect,it,vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { FileRepository } from '../file.repository';
import { FolderRepository } from '../folder.repository';
it('requests bounded later pages of both file and folder lists',async()=>{
  const chain={ select:vi.fn(),eq:vi.fn(),order:vi.fn(),range:vi.fn().mockResolvedValue({ data:[],error:null }) };
  chain.select.mockReturnValue(chain);chain.eq.mockReturnValue(chain);chain.order.mockReturnValue(chain);
  const client={ from:()=>chain } as unknown as SupabaseClient;
  await new FileRepository(client,'owner').listByPatient('patient',{ page:3,limit:50 });
  expect(chain.range).toHaveBeenLastCalledWith(100,150);
  await new FolderRepository(client,'owner').listByPatient('patient',{ page:2,limit:50 });
  expect(chain.range).toHaveBeenLastCalledWith(50,100);
});
