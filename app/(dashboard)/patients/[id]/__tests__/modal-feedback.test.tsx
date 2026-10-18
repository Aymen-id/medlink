import {beforeEach,expect,it,vi} from 'vitest';
import {fireEvent,render,screen,within,waitFor,cleanup} from '@testing-library/react';
const {folder,upload}=vi.hoisted(()=>({folder:vi.fn(),upload:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn(),push:vi.fn()}),useSearchParams:()=>new URLSearchParams()}));
vi.mock('../actions',()=>({createFolder:folder,deleteFile:vi.fn(),deleteFolder:vi.fn(),getSignedUrl:vi.fn(),renameFolder:vi.fn(),updateFile:vi.fn(),addNote:vi.fn(),updateNote:vi.fn(),deleteNote:vi.fn()}));
vi.mock('@/lib/uploads/client',()=>({uploadPatientDocument:upload}));
import {PatientDetailViews} from '../ClientViews';
beforeEach(()=>{cleanup();vi.clearAllMocks();});
const open=()=>render(<PatientDetailViews patientId="patient" currentFolderId={null} folders={[]} files={[]} notes={[]} permissions="edit"/>);
it('keeps folder errors inside the active dialog and closes it after a successful retry',async()=>{
  folder.mockResolvedValueOnce({error:'Folder creation failed'}).mockResolvedValueOnce({error:null});
  open();fireEvent.click(screen.getByRole('button',{name:'New Folder'}));
  const dialog=await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByRole('textbox',{name:'Folder name'}),{target:{value:'Reports'}});
  fireEvent.submit(within(dialog).getByRole('button',{name:'Create Folder'}).closest('form')!);
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Folder creation failed');
  fireEvent.submit(within(dialog).getByRole('button',{name:'Create Folder'}).closest('form')!);
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
});
it('keeps upload failure actionable inside its dialog and closes on successful retry',async()=>{
  upload.mockResolvedValueOnce({error:'Upload quota reached'}).mockResolvedValueOnce({error:null});
  open();fireEvent.click(screen.getByRole('button',{name:'Upload File'}));
  const dialog=await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Select File'),{target:{files:[new File(['pdf'],'report.pdf',{type:'application/pdf'})]}});
  fireEvent.submit(within(dialog).getByRole('button',{name:'Upload'}).closest('form')!);
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Upload quota reached');
  fireEvent.submit(within(dialog).getByRole('button',{name:'Upload'}).closest('form')!);
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
});
