import { expect,it } from 'vitest';
import { uploadMetadataSchema } from '../file.schema';
const input={ patientId:'00000000-0000-4000-8000-000000000001',fileName:'synthetic.pdf',mimeType:'application/pdf',sizeBytes:5*1024*1024 };
it('accepts an upload larger than Server Action transport limits within the configured cap',()=>{
  expect(uploadMetadataSchema.safeParse(input).success).toBe(true);
});
it('rejects oversized files and executable web document types',()=>{
  expect(uploadMetadataSchema.safeParse({ ...input,sizeBytes:51*1024*1024 }).success).toBe(false);
  expect(uploadMetadataSchema.safeParse({ ...input,mimeType:'text/html' }).success).toBe(false);
});
it('rejects path separators and excessive tags',()=>{
  expect(uploadMetadataSchema.safeParse({ ...input,fileName:'../../report.pdf' }).success).toBe(false);
  expect(uploadMetadataSchema.safeParse({ ...input,tags:Array(21).fill('tag') }).success).toBe(false);
});
