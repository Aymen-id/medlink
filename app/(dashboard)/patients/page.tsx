import { getPatients } from './actions';
import { PatientList } from './PatientClientList';
import { getUserContext } from '@/lib/supabase/context';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { z } from 'zod';

export const metadata = {
  title: 'Patients | MediLink',
  description: 'Manage your patients and their medical files.',
};

export default async function PatientsPage({ searchParams }:{ searchParams:Promise<{ page?:string }> }) {
  const context = await getUserContext();
  if (!context) redirect('/login');

  const parsed=z.coerce.number().int().min(1).max(100000).safeParse((await searchParams).page ?? 1);
  if(!parsed.success) return <div role="alert" className="flex flex-col gap-4 p-8"><p>Invalid patient page.</p><Link href="/patients">Return to the first page</Link></div>;
  const page=parsed.data;
  const { data: initialPatients, error,meta } = await getPatients(page, 50);
  if(meta && meta.totalPages>0 && page>meta.totalPages) redirect(`/patients?page=${meta.totalPages}`);

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
      <PatientList initialPatients={initialPatients ?? []} canEdit={context.permissions==='edit'} />
      {meta && <nav aria-label="Patient pagination" className="mt-6 flex items-center justify-between gap-4">
        <div>{page>1 && <Button variant="outline" render={<Link href={`/patients?page=${page-1}`} />}>Previous</Button>}</div>
        <p className="text-sm text-muted-foreground">Page {page} of {Math.max(1,meta.totalPages)} · {meta.total} patients</p>
        <div>{page<meta.totalPages && <Button variant="outline" render={<Link href={`/patients?page=${page+1}`} />}>Next</Button>}</div>
      </nav>}
    </div>
  );
}
