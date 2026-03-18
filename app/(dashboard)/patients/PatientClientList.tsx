'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { createPatientSchema, type CreatePatientInput } from '@/lib/schemas/patient.schema';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/EmptyState';
import { FileText, Users, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { createPatient } from './actions';
import { useRouter } from 'next/navigation';
import type { Patient } from '@/types';

function NewPatientDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (o: boolean) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreatePatientInput>({
    resolver: zodResolver(createPatientSchema),
  });

  const onSubmit = async (data: CreatePatientInput) => {
    setIsSubmitting(true);
    setError(null);
    const result = await createPatient(data);
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
    } else {
      reset();
      onOpenChange(false);
      // Wait a moment for revalidatePath to trigger
      setTimeout(() => {
        router.refresh();
      }, 100);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button className="bg-blue-800 hover:bg-blue-900 text-white" />}>
        <Plus className="mr-2 h-4 w-4" /> New Patient
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Patient</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" {...register('firstName')} />
              {errors.firstName && <p className="text-sm text-red-500">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" {...register('lastName')} />
              {errors.lastName && <p className="text-sm text-red-500">{errors.lastName.message}</p>}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">Date of Birth (YYYY-MM-DD)</Label>
            <Input id="dateOfBirth" placeholder="1990-01-01" {...register('dateOfBirth')} />
            {errors.dateOfBirth && <p className="text-sm text-red-500">{errors.dateOfBirth.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" type="tel" {...register('phone')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Input id="gender" {...register('gender')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="patient@example.com" {...register('email')} />
            {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
          </div>

          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
          
          <div className="pt-4 flex items-center justify-end">
            <Button
              type="button"
              variant="outline"
              className="mr-2"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-800 hover:bg-blue-900 text-white">
              {isSubmitting ? 'Saving...' : 'Save Patient'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PatientList({ initialPatients }: { initialPatients: Patient[] }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Patients</h2>
          <p className="text-sm text-gray-500">Manage your patient roster and access their encrypted files.</p>
        </div>
        <NewPatientDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
      </div>

      {initialPatients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No patients found"
          description="It looks like you haven't added any patients yet. Start by adding a new patient to manage their files and notes."
          actionLabel="Add your first patient"
          onAction={() => setIsDialogOpen(true)}
        />
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 text-gray-600 font-medium">
                <TableHead>Name</TableHead>
                <TableHead>Date of Birth</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialPatients.map((patient) => (
                <TableRow 
                  key={patient.id} 
                  className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/patients/${patient.id}`)}
                >
                  <TableCell className="font-medium text-gray-900 p-4">
                    {patient.lastName}, {patient.firstName}
                  </TableCell>
                  <TableCell className="text-gray-500">{patient.dateOfBirth || '-'}</TableCell>
                  <TableCell className="text-gray-500">{patient.phone || '-'}</TableCell>
                  <TableCell className="text-gray-500">
                    {new Date(patient.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800 hover:bg-blue-100">
                      <FileText className="h-4 w-4 mr-2" /> View File
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
