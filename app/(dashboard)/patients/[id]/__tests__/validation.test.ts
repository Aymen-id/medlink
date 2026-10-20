// @vitest-environment node
import { beforeEach,expect,it,vi } from 'vitest';
const { folderCreate,noteCreate }=vi.hoisted(()=>({ folderCreate:vi.fn(),noteCreate:vi.fn() }));
vi.mock('next/cache',()=>({ revalidatePath:vi.fn() }));
vi.mock('@/lib/supabase/context',()=>({ getUserContext:async()=>({ userId:'user',ownerId:'owner',permissions:'edit' }) }));
vi.mock('@/lib/supabase/server',()=>({ createClient:async()=>({}) }));
vi.mock('@/lib/supabase/admin',()=>({ createAdminClient:()=>({}) }));
vi.mock('@/lib/repositories/folder.repository',()=>({ FolderRepository:class { create=folderCreate; } }));
vi.mock('@/lib/repositories/note.repository',()=>({ NoteRepository:class { create=noteCreate; } }));
import { createFolder,addNote,deleteFile } from '../actions';
const patientId='00000000-0000-4000-8000-000000000001';
beforeEach(()=>{ vi.clearAllMocks();folderCreate.mockResolvedValue({ data:{ id:'folder' },error:null });noteCreate.mockResolvedValue({ data:{ id:'note' },error:null }); });
it('validates folder mutations and trims valid names before persistence',async()=>{
  expect((await createFolder({ patientId,name:'<script>',parentId:null })).error).toBeTruthy();
  expect(folderCreate).not.toHaveBeenCalled();
  await createFolder({ patientId,name:'  Reports  ',parentId:null });
  expect(folderCreate).toHaveBeenCalledWith({ patientId,name:'Reports',parentId:null });
});
it('rejects blank notes before persistence',async()=>{
  expect((await addNote({ patientId,content:'   ' })).error).toBeTruthy();
  expect(noteCreate).not.toHaveBeenCalled();
});
it('rejects malformed identifiers before file mutation',async()=>{
  expect((await deleteFile('not-an-id',patientId)).error).toBeTruthy();
});
