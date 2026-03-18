import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/supabase/context';
import { FileRepository } from '@/lib/repositories/file.repository';
import JSZip from 'jszip';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const patientId = params.id;
    const context = await getUserContext();
    if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createClient();
    const repo = new FileRepository(supabase, context.ownerId);

    // Fetch all files across all folders for this patient
    const { data: files, error } = await repo.listByPatient(patientId);
    
    if (error || !files || files.length === 0) {
      return NextResponse.json({ error: 'No files to export.' }, { status: 404 });
    }

    // Zip generation
    const zip = new JSZip();

    // Iterate files and download them concurrently
    await Promise.all(
      files.map(async (f) => {
        // Download buffer directly from storage wrapper instead of public/signed URL to be efficient
        const { data: fileData } = await supabase.storage
          .from('patient-files')
          .download(f.storagePath);
        
        if (fileData) {
          // Add to zip. If we wanted folders mapped out, we could reconstruct the folder path,
          // but MVP export might just dump files or prefix them. Let's just prefix with ID to prevent name collisions
          zip.file(`${f.id}_${f.fileName}`, fileData);
        }
      })
    );

    // Generate zip blob for Web Response
    const zipData = await zip.generateAsync({ type: 'blob' });

    // Stream back to client
    const headers = new Headers();
    headers.set('Content-Type', 'application/zip');
    headers.set('Content-Disposition', `attachment; filename="patient_${patientId}_files.zip"`);

    return new NextResponse(zipData, { headers, status: 200 });
  } catch (err: unknown) {
    console.error('ZIP Export Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
