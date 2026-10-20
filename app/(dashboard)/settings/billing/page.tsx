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
  if(account.error) return <p role="alert" className="text-destructive">Could not load billing. Reload to retry.</p>;
  if(!account.data) return <p className="text-muted-foreground">Your Clinic billing account admin manages this subscription.</p>;
  const repo = new SubscriptionRepository(supabase, context.userId,context.billingAccountId);

  const { data: subscription,error } = await repo.findByUserId();
  if(error) return <p role="alert" className="text-destructive">Could not load subscription. Reload to retry.</p>;
  const effectiveTier=await repo.getTier();

  return <BillingClient subscription={subscription} effectiveTier={effectiveTier} />;
}
