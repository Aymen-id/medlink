import { expect,it,vi } from 'vitest';
import { fireEvent,render,screen,waitFor,cleanup } from '@testing-library/react';
import { PatientDetailViews } from '../ClientViews';
const { remove,push }=vi.hoisted(()=>({ remove:vi.fn(),push:vi.fn() }));
vi.mock('next/navigation',()=>({ useRouter:()=>({ refresh:vi.fn(),push }),useSearchParams:()=>new URLSearchParams() }));
vi.mock('../actions',()=>({ deleteFile:remove,deleteFolder:remove,createFolder:vi.fn(),addNote:vi.fn(),deleteNote:vi.fn(),getSignedUrl:vi.fn(),renameFolder:vi.fn(),updateFile:vi.fn() }));
const file={ id:'file',patientId:'patient',folderId:null,fileName:'Report.pdf',storagePath:'path',mimeType:'application/pdf',sizeBytes:3,tags:[],createdAt:'2026-10-17' };
const folder={ id:'folder',patientId:'patient',parentId:null,name:'Reports',createdAt:'2026-10-17' };
it('shows failed deletion and preserves pagination access beyond the current page',async()=>{
  remove.mockResolvedValue({ error:'Storage request failed' });
  render(<PatientDetailViews patientId="patient" currentFolderId={null} folders={[folder]} files={[file]} notes={[]} permissions="edit" moreFiles filePage={2} />);
  expect(screen.getByRole('button',{ name:'Move / tags' })).toBeVisible();
  fireEvent.click(screen.getByRole('button',{ name:'Delete file Report.pdf' }));
  fireEvent.click(screen.getByRole('button',{ name:'Confirm deletion' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Storage request failed');
  fireEvent.click(screen.getByRole('button',{ name:'Cancel' }));
  fireEvent.click(screen.getByRole('button',{ name:'Next files' }));
  expect(push).toHaveBeenCalledWith('?filePage=3');
  fireEvent.click(screen.getByRole('button',{ name:'Delete folder Reports' }));
  await waitFor(()=>expect(screen.getByText(/Files are preserved/)).toBeVisible());
  cleanup();
});
it('hides file mutations from viewers',()=>{
  render(<PatientDetailViews patientId="patient" currentFolderId={null} folders={[folder]} files={[file]} notes={[]} permissions="view" />);
  expect(screen.queryByRole('button',{ name:'Move / tags' })).toBeNull();
  expect(screen.queryByRole('button',{ name:'Rename' })).toBeNull();
});
