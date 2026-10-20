import Link from 'next/link';
import { SearchX } from 'lucide-react';
import type { Patient, PatientFile } from '@/types';
import { EmptyState } from '@/components/ui/EmptyState';

type SearchResultsProps = {
  query: string;
  patients: Patient[];
  files: PatientFile[];
};

export function SearchResults({ query, patients, files }: SearchResultsProps) {
  if (patients.length === 0 && files.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title="No results"
        description={`Nothing matched “${query}”. Try a different term.`}
      />
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {patients.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">
            Patients ({patients.length})
          </h2>
          <ul className="divide-y divide-border rounded-md border border-border bg-card">
            {patients.map(p => (
              <li key={p.id}>
                <Link
                  href={`/patients/${p.id}`}
                  className="block px-4 py-3 text-sm hover:bg-accent/40"
                >
                  {[p.firstName, p.lastName].filter(Boolean).join(' ')}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {files.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">
            Documents ({files.length})
          </h2>
          <ul className="divide-y divide-border rounded-md border border-border bg-card">
            {files.map(f => (
              <li key={f.id}>
                <Link
                  href={`/patients/${f.patientId}${f.folderId ? `?folderId=${encodeURIComponent(f.folderId)}`:''}`}
                  className="block px-4 py-3 text-sm hover:bg-accent/40"
                >
                  {f.fileName}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
