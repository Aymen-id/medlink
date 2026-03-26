import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/supabase/context';
import { ExportService } from '@/lib/services/export.service';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const patientId = params.id;
  const context = await getUserContext();
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient();
  const exportService = new ExportService(supabase, context.ownerId);

  const result = await exportService.exportPatientFiles(patientId);

  if (result.error || !result.data) {
    const status = result.error === 'No files to export' ? 404 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  const headers = new Headers();
  headers.set('Content-Type', 'application/zip');
  headers.set('Content-Disposition', `attachment; filename="patient_${patientId}_files.zip"`);

  return new NextResponse(result.data, { headers, status: 200 });
}
