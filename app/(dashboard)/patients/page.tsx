import { getPatients } from './actions';
import { PatientList } from './PatientClientList';
import { getUserContext } from '@/lib/supabase/context';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Patients | MediLink',
  description: 'Manage your patients and their medical files.',
};

export default async function PatientsPage() {
  const context = await getUserContext();
  if (!context) redirect('/login');

  const { data: initialPatients, error } = await getPatients(1, 50);

  if (error) {
    return (
      <div className="p-8 text-center text-red-500 bg-red-50 rounded-md">
        <h2 className="text-lg font-semibold mb-2">Error Loading Patients</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <PatientList initialPatients={initialPatients ?? []} />
    </div>
  );
}
