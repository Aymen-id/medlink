import { redirect } from 'next/navigation';
import { getUserContext } from '@/lib/supabase/context';
import { createClient } from '@/lib/supabase/server';
import { PatientRepository } from '@/lib/repositories/patient.repository';
import { FileRepository } from '@/lib/repositories/file.repository';
import { searchQuerySchema } from '@/lib/schemas/search.schema';
import { SearchResults } from '@/components/dashboard/SearchResults';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { z } from 'zod';

export const metadata = {
  title: 'Search | MediLink',
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string;filePage?:string;patientPage?:string }>;
}) {
  const context = await getUserContext();
  if (!context) redirect('/login');

  const query=await searchParams;
  const parsed = searchQuerySchema.safeParse({ q: query.q ?? '' });
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

  const supabase = await createClient();
  const patientRepo = new PatientRepository(supabase, context.ownerId);
  const fileRepo = new FileRepository(supabase, context.ownerId);

  const page=(value:string | undefined)=>z.coerce.number().int().min(1).max(100000).catch(1).parse(value ?? 1);
  const filePage=page(query.filePage),patientPage=page(query.patientPage);
  const [patientResult,fileResult] = await Promise.all([
    patientRepo.search(parsed.data.q,patientPage,20),
    fileRepo.search(parsed.data.q,filePage,20),
  ]);
  const patients=patientResult.data ?? [],files=fileResult.data ?? [];
  const href=(key:string,value:number)=>`/search?${new URLSearchParams({ q:parsed.data.q,filePage:String(filePage),patientPage:String(patientPage),[key]:String(value) })}`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <h1 className="text-xl font-semibold mb-1">
        Results for “{parsed.data.q}”
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Patient and document names in the selected workspace. Document search ignores accents and also matches partial names.
      </p>
      {(patientResult.error || fileResult.error) && <p role="alert" className="mb-4 text-destructive">Search could not load all results: {patientResult.error || fileResult.error}. Reload to retry.</p>}
      {(!patientResult.error || !fileResult.error) && <SearchResults query={parsed.data.q} patients={patients.slice(0,20)} files={files.slice(0,20)} />}
      <div className="mt-6 flex flex-wrap gap-6">
        {([['filePage','Documents',filePage,files.length>20],['patientPage','Patients',patientPage,patients.length>20]] as const).map(([key,label,current,more])=><nav aria-label={`${label} search pages`} key={key} className="flex items-center gap-3 text-sm">{current>1 && <Link className="underline" href={href(key,current-1)}>Previous {label.toLowerCase()}</Link>}<span>{label} page {current}</span>{more && <Link className="underline" href={href(key,current+1)}>Next {label.toLowerCase()}</Link>}</nav>)}
      </div>
    </div>
  );
}
