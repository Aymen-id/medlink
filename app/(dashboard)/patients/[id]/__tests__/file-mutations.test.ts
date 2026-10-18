// @vitest-environment node
import { expect,it,vi } from 'vitest';
const { rename,tags,move,context }=vi.hoisted(()=>({ rename:vi.fn(),tags:vi.fn(),move:vi.fn(),context:vi.fn() }));
vi.mock('next/cache',()=>({ revalidatePath:vi.fn() }));
vi.mock('@/lib/supabase/context',()=>({ getUserContext:context }));
vi.mock('@/lib/supabase/server',()=>({ createClient:async()=>({}) }));
vi.mock('@/lib/supabase/admin',()=>({ createAdminClient:()=>({}) }));
vi.mock('@/lib/repositories/folder.repository',()=>({ FolderRepository:class { rename=rename; } }));
vi.mock('@/lib/repositories/file.repository',()=>({ FileRepository:class { updateMetadata=tags;moveToFolder=move; } }));
import { renameFolder,updateFile } from '../actions';
const id='10000000-0000-4000-8000-000000000001';
it('rejects invalid folders/tags and viewer mutations before persistence',async()=>{
  context.mockResolvedValue({ permissions:'view' });
  expect((await renameFolder(id,id,'Reports')).error).toBeTruthy();
  expect((await updateFile(id,id,null,['tag'])).error).toBeTruthy();
  expect(rename).not.toHaveBeenCalled();expect(tags).not.toHaveBeenCalled();
  context.mockResolvedValue({ ownerId:'owner',permissions:'edit' });
  expect((await updateFile(id,id,'invalid',['tag'])).error).toBeTruthy();
  expect((await updateFile(id,id,null,Array(21).fill('tag'))).error).toBeTruthy();
  expect(move).not.toHaveBeenCalled();
});
it('trims and persists permitted folder names and file metadata',async()=>{
  context.mockResolvedValue({ ownerId:'owner',permissions:'edit' });
  rename.mockResolvedValue({ error:null });move.mockResolvedValue({ error:null });tags.mockResolvedValue({ error:null });
  await renameFolder(id,id,'  Reports  ');
  expect(rename).toHaveBeenCalledWith(id,'Reports');
  await updateFile(id,id,null,[' urgent ']);
  expect(tags).toHaveBeenCalledWith(id,{ tags:['urgent'],folderId:null });
});
