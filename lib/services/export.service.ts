import type { SupabaseClient } from '@supabase/supabase-js';
import { FileRepository } from '@/lib/repositories/file.repository';
import JSZip from 'jszip';
import { Readable } from 'node:stream';

export type ExportResult = {
  data: ReadableStream<Uint8Array> | null;
  error: string | null;
  fileCount: number;
  status?:number;
};

export class ExportService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly ownerId: string,
    private readonly storageClient: SupabaseClient = supabase,
  ) {}

  /**
   * Generates a ZIP file containing all files for a given patient.
   * Verifies ownership through the FileRepository (defense-in-depth).
   */
  async exportPatientFiles(patientId: string): Promise<ExportResult> {
    const repo = new FileRepository(this.supabase, this.ownerId);

    // Fetch all files across all folders for this patient
    const { data: files, error } = await repo.listByPatient(patientId,{ page:1,limit:500 });

    if (error) {
      return { data: null, error, fileCount: 0 };
    }

    if (!files || files.length === 0) {
      return { data: null, error: 'No files to export', fileCount: 0 };
    }

    const maxBytes=100*1024*1024;
    if(files.length>500 || files.reduce((sum,file)=>sum+file.sizeBytes,0)>maxBytes) {
      return { data:null,error:'This export exceeds the 100 MiB / 500 file synchronous export limit. Download individual files while a background export is arranged.',fileCount:0,status:413 };
    }

    const zip = new JSZip();
    let offset=0,totalBytes=0,failed=false;
    const deadline=Date.now()+45_000;
    async function bounded<T>(operation:PromiseLike<T>):Promise<T> {
      let timer:ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([operation,new Promise<never>((_,reject)=>{ timer=setTimeout(()=>reject(new Error('Export timed out')),Math.max(1,deadline-Date.now())); })]);
      } finally { clearTimeout(timer); }
    }
    const worker=async()=>{
      while(offset<files.length && !failed) {
        const file=files[offset++];
        try {
          const { data:blob,error:downloadError }=await bounded(this.storageClient.storage.from('patient-files').download(file.storagePath));
          if(downloadError || !blob || blob.size!==file.sizeBytes) { failed=true;return; }
          totalBytes+=blob.size;
          if(totalBytes>maxBytes) { failed=true;return; }
          const bytes=Buffer.from(await bounded(blob.arrayBuffer()));
          // IDs avoid collisions; sanitize legacy names to prevent ZIP path traversal.
          zip.file(`${file.id}_${file.fileName.replace(/[/\\\u0000-\u001f]/gu,'_')}`,bytes);
        } catch { failed=true;return; }
      }
    };
    await Promise.all(Array.from({ length:Math.min(3,files.length) },worker));
    if(failed) return { data:null,error:'Export failed: a source file is unavailable, changed, or timed out. No incomplete archive was returned. Retry or download files individually.',fileCount:0,status:502 };
    const stream=Readable.toWeb(new Readable().wrap(zip.generateNodeStream({ type:'nodebuffer',streamFiles:true,compression:'STORE' }))) as ReadableStream<Uint8Array>;
    return { data:stream,error:null,fileCount:files.length };
  }
}
