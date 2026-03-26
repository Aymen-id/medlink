import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/supabase/context';
import { PatientRepository } from '@/lib/repositories/patient.repository';
import { getFiles, getFolders } from './actions';
import { NoteRepository } from '@/lib/repositories/note.repository';
import { PatientDetailViews } from './ClientViews';

export const metadata = {
  title: 'Patient Details | MediLink',
};

type Props = {
  params: { id: string };
  searchParams: { folderId?: string };
};

export default async function PatientDetailPage({ params, searchParams }: Props) {
  const context = await getUserContext();
  if (!context) redirect('/login');

  const supabase = createClient();
  const patientRepo = new PatientRepository(supabase, context.ownerId);

  // Fetch patient
  const { data: patient, error: patientError } = await patientRepo.getById(params.id);
  if (patientError || !patient) {
    return (
      <div className="p-8 text-center text-red-500">
        <h2 className="text-xl font-bold">Patient Not Found</h2>
        <p className="mt-2">{patientError || "We couldn't find this patient record."}</p>
      </div>
    );
  }

  // Fetch folders and files for the current folder view
  const currentFolderId = searchParams.folderId ?? null;
  const [{ data: folders }, { data: files }] = await Promise.all([
    getFolders(patient.id, currentFolderId),
    getFiles(patient.id, currentFolderId),
  ]);

  // Fetch appointment notes
  const noteRepo = new NoteRepository(supabase, context.userId, context.ownerId);
  const { data: notes } = await noteRepo.listByPatient(patient.id, { limit: 100 });

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
          <a
            href={`/api/patients/${patient.id}/export`}
            download
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
          >
            Export All Files (ZIP)
          </a>
        </div>
      </div>

      <PatientDetailViews
        patientId={patient.id}
        currentFolderId={currentFolderId}
        folders={folders ?? []}
        files={files ?? []}
        notes={notes ?? []}
        permissions={context.permissions ?? 'edit'} // owners are mapped without 'permissions', assuming edit
      />
    </div>
  );
}
