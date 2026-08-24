import { redirect } from 'next/navigation';
import { getUserContext } from '@/lib/supabase/context';
import { createClient } from '@/lib/supabase/server';
import { PatientRepository } from '@/lib/repositories/patient.repository';
import { FileRepository } from '@/lib/repositories/file.repository';
import { searchQuerySchema } from '@/lib/schemas/search.schema';
import { SearchResults } from '@/components/dashboard/SearchResults';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchX } from 'lucide-react';

export const metadata = {
  title: 'Search | MediLink',
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const context = await getUserContext();
  if (!context) redirect('/login');

  const parsed = searchQuerySchema.safeParse({ q: searchParams.q ?? '' });
  if (!parsed.success) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <EmptyState
          icon={SearchX}
          title="Invalid search"
          description={"Use 1–100 characters; ; ' \" \\ % are not allowed."}
        />
      </div>
    );
  }

  const supabase = createClient();
  const patientRepo = new PatientRepository(supabase, context.ownerId);
  const fileRepo = new FileRepository(supabase, context.ownerId);

  const [{ data: patients }, { data: files }] = await Promise.all([
    patientRepo.search(parsed.data.q),
    fileRepo.search(parsed.data.q),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <h1 className="text-xl font-semibold mb-1">
        Results for “{parsed.data.q}”
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Patient names and document names you own.
      </p>
      <SearchResults query={parsed.data.q} patients={patients ?? []} files={files ?? []} />
    </div>
  );
}
