'use client';
import { Button } from '@/components/ui/button';
export default function WorkspaceError({ reset }:{ reset:()=>void }) {
  return <div role="alert" className="mx-auto w-full max-w-lg space-y-4 p-8"><h1 className="text-2xl font-semibold">The workspace could not load</h1><p className="text-muted-foreground">Check your connection and try again. If the problem continues, return to your patient list.</p><Button onClick={reset}>Try again</Button></div>;
}
