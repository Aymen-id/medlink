// @vitest-environment node
import { beforeEach,expect,it,vi } from 'vitest';
import { NextRequest } from 'next/server';
const { context,download }=vi.hoisted(()=>({ context:vi.fn(),download:vi.fn() }));
vi.mock('@/lib/supabase/context',()=>({ getUserContext:context }));
vi.mock('@/lib/supabase/server',()=>({ createClient:async()=>({}) }));
vi.mock('@/lib/supabase/admin',()=>({ createAdminClient:()=>({}) }));
vi.mock('@/lib/repositories/file.repository',()=>({ FileRepository:class { downloadFile=download; } }));
import { GET } from '../route';
const id='00000000-0000-4000-8000-000000000001';
beforeEach(()=>vi.clearAllMocks());
it('does not fetch bytes for a revoked or unauthenticated workspace context',async()=>{
  context.mockResolvedValue(null);
  expect((await GET(new NextRequest(`https://app.example/api/files/${id}/download`),{ params:Promise.resolve({ id }) })).status).toBe(401);
  expect(download).not.toHaveBeenCalled();
});
it('returns authorized bytes as an uncacheable attachment',async()=>{
  context.mockResolvedValue({ workspaceId:id });
  download.mockResolvedValue({ data:{ blob:new Blob([new Uint8Array([0,128,255])]),fileName:'Synthetic report.pdf' },error:null });
  const response=await GET(new NextRequest(`https://app.example/api/files/${id}/download`),{ params:Promise.resolve({ id }) });
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([0,128,255]));
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(response.headers.get('content-disposition')).toContain('attachment');
});
