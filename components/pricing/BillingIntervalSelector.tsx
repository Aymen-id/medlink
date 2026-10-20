'use client';

import { useId } from 'react';
import { Label } from '@/components/ui/label';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type BillingInterval = 'monthly' | 'annual';

export function BillingIntervalSelector({ value, onChange }: { value: BillingInterval; onChange: (value: BillingInterval) => void }) {
  const name = useId();
  return (
    <fieldset className="relative min-w-0">
      <legend className="sr-only">Billing interval</legend>
      <div className="mx-auto flex w-full max-w-xs gap-1 rounded-xl border border-border bg-card p-1">
        {(['monthly', 'annual'] as const).map(interval => (
          <Label key={interval} className="relative min-w-0 flex-1 cursor-pointer">
            <input type="radio" name={name} value={interval} checked={value === interval} onChange={() => onChange(interval)} className="peer sr-only" />
            <span className={cn(
              buttonVariants({ variant: 'ghost' }),
              'h-auto min-h-11 w-full min-w-0 gap-2 px-3 py-2.5 text-primary transition-none hover:bg-accent hover:text-primary dark:hover:bg-accent peer-checked:bg-primary peer-checked:text-primary-foreground peer-checked:hover:bg-primary peer-checked:hover:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
            )}>
              {interval === 'monthly' ? 'Monthly' : <>Annual <span className="text-xs font-semibold">-20%</span></>}
            </span>
          </Label>
        ))}
      </div>
    </fieldset>
  );
}
