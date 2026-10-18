import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/supabase/context';
import { SubscriptionRepository } from '@/lib/repositories/subscription.repository';
import { BillingClient } from '@/components/dashboard/BillingClient';

export const metadata = {
  title: 'Billing & Plans | MediLink',
};

export default async function BillingPage() {
  const context = await getUserContext();
  if (!context) redirect('/login');

  const supabase = await createClient();
  const account=await supabase.from('billing_accounts').select('id').eq('id',context.billingAccountId).eq('billing_admin_id',context.userId).maybeSingle();
  if(account.error) return <p role="alert" className="p-6 text-destructive">Could not load billing. Reload to retry.</p>;
  if(!account.data) return <p className="p-6 text-muted-foreground">Your Clinic billing account admin manages this subscription.</p>;
  const repo = new SubscriptionRepository(supabase, context.userId,context.billingAccountId);

  const { data: subscription,error } = await repo.findByUserId();
  if(error) return <p role="alert" className="p-6 text-destructive">Could not load subscription. Reload to retry.</p>;
  const effectiveTier=await repo.getTier();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Billing & Plans</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your subscription and billing settings.
        </p>
      </div>
      <BillingClient subscription={subscription} effectiveTier={effectiveTier} />
    </div>
  );
}
