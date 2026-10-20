import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/supabase/context';
import { ExportService } from '@/lib/services/export.service';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';
export const runtime='nodejs';
export const maxDuration=60;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const patientId = (await params).id;
  if(!z.uuid().safeParse(patientId).success) return NextResponse.json({ error:'Invalid patient' },{ status:400 });
  const context = await getUserContext();
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = await createClient();
  const exportService = new ExportService(supabase, context.ownerId,createAdminClient());

  const result = await exportService.exportPatientFiles(patientId);

  if (result.error || !result.data) {
    const status = result.status ?? (result.error === 'No files to export' ? 404 : 500);
    return NextResponse.json({ error: result.error }, { status });
  }

  const headers = new Headers();
  headers.set('Content-Type', 'application/zip');
  headers.set('Content-Disposition', `attachment; filename="patient_${patientId}_files.zip"`);
  headers.set('Cache-Control','private, no-store');
  headers.set('X-Content-Type-Options','nosniff');

  return new NextResponse(result.data, { headers, status: 200 });
}
