import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/supabase/context';
import { PatientRepository } from '@/lib/repositories/patient.repository';
import { getFiles, getFolders } from './actions';
import { NoteRepository } from '@/lib/repositories/note.repository';
import { PatientDetailViews } from './ClientViews';
import { PatientControls } from './PatientControls';
import { z } from 'zod';
import { getWorkspaceTier } from '@/lib/supabase/entitlements';
import { ExportButton } from './ExportButton';

export const metadata = {
  title: 'Patient Details | MediLink',
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ folderId?: string;filePage?:string;folderPage?:string;notesPage?:string }>;
};

export default async function PatientDetailPage({ params, searchParams }: Props) {
  const context = await getUserContext();
  if (!context) redirect('/login');

  const supabase = await createClient();
  const patientRepo = new PatientRepository(supabase, context.ownerId);

  // Fetch patient
  const { data: patient, error: patientError } = await patientRepo.getById((await params).id);
  if (patientError || !patient) {
    return (
      <div className="p-8 text-center text-red-500">
        <h2 className="text-xl font-bold">Patient Not Found</h2>
        <p className="mt-2">{patientError || "We couldn't find this patient record."}</p>
      </div>
    );
  }

  // Fetch folders and files for the current folder view
  const query=await searchParams;
  const currentFolderId = query.folderId ?? null;
  const page=(value:string | undefined)=>z.coerce.number().int().min(1).max(100000).catch(1).parse(value ?? 1);
  const filePage=page(query.filePage),folderPage=page(query.folderPage);
  const [folderResult,fileResult] = await Promise.all([
    getFolders(patient.id, currentFolderId,folderPage),
    getFiles(patient.id, currentFolderId,filePage),
  ]);
  const folders=folderResult.data ?? [],files=fileResult.data ?? [];

  // Fetch appointment notes
  const noteRepo = new NoteRepository(supabase, context.userId, context.ownerId);
  const notesPage=page(query.notesPage);
  const [noteResult,tier]=await Promise.all([noteRepo.listByPatient(patient.id, { page:notesPage,limit:25 }),getWorkspaceTier(supabase,context.workspaceId)]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6">
      {/* Patient Header */}
      <div className="bg-white p-6 rounded-lg border shadow-sm flex flex-col md:flex-row md:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {patient.firstName} {patient.lastName}
          </h1>
          <div className="mt-2 text-sm text-gray-500 space-x-4 flex flex-col md:flex-row md:items-center">
            {patient.dateOfBirth && (
              <span className="inline-block py-1">
                <strong>DOB:</strong> {patient.dateOfBirth}
              </span>
            )}
            {patient.phone && (
              <span className="inline-block py-1">
                <strong>Phone:</strong> {patient.phone}
              </span>
            )}
            {patient.email && (
              <span className="inline-block py-1">
                <strong>Email:</strong> {patient.email}
              </span>
            )}
          </div>
        </div>
        <div className="mt-4 md:mt-0">
          {context.permissions!=='view' && <PatientControls patient={patient} />}
          <ExportButton patientId={patient.id} />
        </div>
      </div>

      <PatientDetailViews
        patientId={patient.id}
        currentFolderId={currentFolderId}
        folders={folders.slice(0,50)}
        files={files.slice(0,50)}
        filePage={filePage} folderPage={folderPage} moreFiles={files.length>50} moreFolders={folders.length>50}
        loadError={folderResult.error || fileResult.error}
        notes={noteResult.data ?? []}
        currentUserId={context.userId} canWriteNotes={!tier.error && tier.data!=='free'}
        notesPage={notesPage} notesTotalPages={noteResult.meta?.totalPages ?? 1} notesError={noteResult.error || tier.error}
        permissions={context.permissions ?? 'edit'} // owners are mapped without 'permissions', assuming edit
      />
    </div>
  );
}
