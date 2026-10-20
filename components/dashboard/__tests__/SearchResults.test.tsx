import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SearchResults } from '../SearchResults';
import type { Patient, PatientFile } from '@/types';

const patient = (over: Partial<Patient>): Patient => ({
  id: 'p-1',
  ownerId: 'owner-1',
  firstName: 'Amina',
  lastName: 'Bennani',
  dateOfBirth: null,
  gender: null,
  phone: null,
  email: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...over,
});

const file = (over: Partial<PatientFile>): PatientFile => ({
  id: 'f-1',
  patientId: 'p-1',
  folderId: null,
  fileName: 'bloodwork.pdf',
  storagePath: 'owner-1/p-1/bloodwork.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  tags: [],
  createdAt: '2026-01-01T00:00:00Z',
  ...over,
});

describe('SearchResults', () => {
  it('renders grouped patients and files with links', () => {
    render(
      <SearchResults
        query="ben"
        patients={[
          patient({}),
          patient({ id: 'p-2', firstName: 'Youssef', lastName: 'Alaoui' }),
        ]}
        files={[file({})]}
      />,
    );

    expect(screen.getByText(/patients \(2\)/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /amina bennani/i })[0]).toHaveAttribute(
      'href',
      '/patients/p-1',
    );
    expect(screen.getByText(/bloodwork\.pdf/i)).toBeInTheDocument();
  });

  it('shows the empty state when nothing matched', () => {
    render(<SearchResults query="zzz" patients={[]} files={[]} />);
    expect(screen.getByText(/no results/i)).toBeInTheDocument();
  });
});
