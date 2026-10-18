import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { ProfileRepository } from '@/lib/repositories/profile.repository';
import { PublicProfile } from '@/components/profile/PublicProfile';
import { headers } from 'next/headers';
import { after } from 'next/server';
import { trackProfileEvent } from '@/lib/analytics/track';
import { serializeJsonLd } from '@/lib/utils/json-ld';

type Props = {
  params: Promise<{ drname: string }>;
};

/**
 * Generate dynamic SEO metadata for the public profile page.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient();
  const repo = new ProfileRepository(supabase, '');
  const { data: profile } = await repo.findBySlug((await params).drname);

  if (!profile) {
    return {
      title: 'Profile Not Found | MediLink',
    };
  }

  const title = `${profile.displayName}${profile.specialty ? ` — ${profile.specialty}` : ''} | MediLink`;
  const description = profile.bio
    ? profile.bio.slice(0, 160)
    : `${profile.displayName} is a physician on MediLink. View their profile, credentials, and book an appointment.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      url: `https://medilink.io/${profile.slug}`,
      ...(profile.avatarUrl && { images: [{ url: profile.avatarUrl }] }),
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

/**
 * Generate JSON-LD structured data for the profile (MedicalBusiness schema).
 */
function generateJsonLd(profile: NonNullable<Awaited<ReturnType<ProfileRepository['findBySlug']>>['data']>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalBusiness',
    name: profile.displayName,
    description: profile.bio ?? undefined,
    ...(profile.specialty && { medicalSpecialty: profile.specialty }),
    ...(profile.clinicAddress && {
      address: {
        '@type': 'PostalAddress',
        streetAddress: profile.clinicAddress,
      },
    }),
    ...(profile.contactCTA && { telephone: profile.contactCTA }),
    ...(profile.bookingCTA && {
      url: profile.bookingCTA.startsWith('http')
        ? profile.bookingCTA
        : `https://${profile.bookingCTA}`,
    }),
    ...(profile.avatarUrl && { image: profile.avatarUrl }),
  };
}

/**
 * Records a profile view in profile_analytics.
 * Non-blocking — errors are silently swallowed to avoid impacting page render.
 */

/**
 * Public profile page — SSR, no auth required.
 */
export default async function PublicProfilePage({ params }: Props) {
  const supabase = await createClient();
  const repo = new ProfileRepository(supabase, '');

  const { data: profile } = await repo.findBySlug((await params).drname);

  if (!profile) {
    notFound();
  }

  // Record analytics view (fire-and-forget, non-blocking)
  const requestHeaders=await headers();
  after(() => trackProfileEvent(profile.id,{ type:'view' },requestHeaders).catch(() => undefined));

  const jsonLd = generateJsonLd(profile);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <PublicProfile profile={profile} />
    </>
  );
}
