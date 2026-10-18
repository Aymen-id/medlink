import { expect,it } from 'vitest';
import { render,screen } from '@testing-library/react';
import { SearchResults } from '../SearchResults';
it('opens a matched document in its actual nested folder',()=>{
  render(<SearchResults query="echo" patients={[]} files={[{ id:'file',patientId:'patient',folderId:'nested-folder',fileName:'Échographie.pdf',storagePath:'path',mimeType:'application/pdf',sizeBytes:3,tags:[],createdAt:'2026-10-18' }]} />);
  expect(screen.getByRole('link',{ name:'Échographie.pdf' })).toHaveAttribute('href','/patients/patient?folderId=nested-folder');
});
