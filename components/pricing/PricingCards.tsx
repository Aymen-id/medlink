import type { ComponentProps, ReactNode } from 'react';
import { Check, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type PricingPlanPresentation = {
  id: string;
  name: string;
  description: string;
  price: number;
  billingNote?: string;
  features: readonly { label: string; included: boolean }[];
  action?: ReactNode;
  highlighted?: boolean;
  current?: boolean;
  badge?: string;
};

export function PricingAction({ emphasis = false, className, ...props }: ComponentProps<typeof Button> & { emphasis?: boolean }) {
  return (
    <Button
      variant={emphasis ? 'default' : 'outline'}
      className={cn(
        'h-auto min-h-11 w-full min-w-0 whitespace-normal px-4 py-2.5 text-sm leading-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 dark:disabled:border-border dark:disabled:bg-muted',
        emphasis ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border-primary bg-card text-primary hover:bg-accent hover:text-primary dark:border-primary dark:bg-card dark:hover:bg-accent',
        className,
      )}
      {...props}
    />
  );
}

export function CurrentPlanIndicator() {
  return <Badge className="min-h-11 w-full justify-center rounded-lg border-primary bg-accent px-4 py-2.5 text-sm leading-5 whitespace-normal text-primary">Current Plan</Badge>;
}

export function PricingCards({ plans, idPrefix }: { plans: readonly PricingPlanPresentation[]; idPrefix: string }) {
  const hasBadges = plans.some(plan => plan.badge);
  return (
    <div data-slot="pricing-cards" className="@container/pricing w-full min-w-0">
      <div className="grid min-w-0 grid-cols-1 gap-5 @[52rem]/pricing:grid-cols-3">
        {plans.map(plan => (
          <Card key={plan.id} role="article" aria-labelledby={`${idPrefix}-${plan.id}`} className={cn(
            'relative min-w-0 gap-0 border bg-card py-0 text-foreground ring-0',
            plan.highlighted && 'bg-accent/40',
            plan.current ? 'border-primary' : plan.highlighted ? 'border-primary/50' : 'border-border',
          )}>
            <CardHeader className="block px-5 pt-5">
              {hasBadges && <div className="mb-4 flex min-h-6 flex-wrap items-center gap-2 empty:hidden @[52rem]/pricing:empty:flex">
                {plan.badge && <Badge className="border-transparent bg-primary px-2.5 text-primary-foreground">{plan.badge}</Badge>}
              </div>}
              <h3 id={`${idPrefix}-${plan.id}`} className="text-xl leading-7 font-semibold tracking-tight">{plan.name}</h3>
              <p className="mt-2 min-h-10 text-sm leading-5 text-muted-foreground">{plan.description}</p>
            </CardHeader>
            <div className="space-y-2 px-5 pt-5 pb-6">
              <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-4xl leading-none font-semibold tracking-tight tabular-nums">${plan.price}</span>
                <span className="text-sm leading-5 text-muted-foreground">/ month</span>
              </p>
              <div className="min-h-5">{plan.billingNote && <p className="text-sm leading-5 text-muted-foreground">{plan.billingNote}</p>}</div>
            </div>
            <CardContent className="flex-1 px-5">
              <ul aria-label={`${plan.name} features`} className="space-y-3">
                {plan.features.map(feature => (
                  <li key={feature.label} className="flex items-start gap-2.5 text-sm leading-5">
                    {feature.included
                      ? <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                      : <Minus aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                    <span className={cn('min-w-0 break-words', !feature.included && 'text-muted-foreground')}>
                      {feature.included && <span className="sr-only">Included: </span>}
                      {feature.label}
                      {!feature.included && <span className="mt-0.5 block text-sm text-muted-foreground">Not included</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="mt-6 block bg-transparent p-5">{plan.action ?? <div aria-hidden="true" className="min-h-11" />}</CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
