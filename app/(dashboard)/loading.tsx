import { PageLoadingSkeleton } from '@/components/ui/LoadingState';
export default function Loading() { return <div role="status" aria-label="Loading workspace" className="mx-auto w-full max-w-7xl space-y-6 p-6"><p className="text-muted-foreground">Loading your workspace…</p><PageLoadingSkeleton /></div>; }
