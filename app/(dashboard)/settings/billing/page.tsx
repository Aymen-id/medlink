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

  const supabase = createClient();
  const repo = new SubscriptionRepository(supabase, context.ownerId);

  const { data: subscription } = await repo.findByUserId();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Billing & Plans</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your subscription and billing settings.
        </p>
      </div>
      <BillingClient subscription={subscription} />
    </div>
  );
}
