import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { ProfileRepository } from '@/lib/repositories/profile.repository';
import { PublicProfile } from '@/components/profile/PublicProfile';
import { headers } from 'next/headers';
import { createHash } from 'crypto';

type Props = {
  params: { drname: string };
};

/**
 * Generate dynamic SEO metadata for the public profile page.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient();
  const repo = new ProfileRepository(supabase, '');
  const { data: profile } = await repo.findBySlug(params.drname);

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
async function recordView(
  supabase: ReturnType<typeof createClient>,
  profileId: string,
): Promise<void> {
  const headersList = headers();
  const userAgent = headersList.get('user-agent') ?? null;
  const referer = headersList.get('referer') ?? null;
  const forwarded = headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip') ?? '';

  // Hash the IP — never store raw IP (privacy/HIPAA)
  const ipHash = forwarded
    ? createHash('sha256').update(forwarded.split(',')[0].trim()).digest('hex').slice(0, 16)
    : null;

  await supabase.from('profile_analytics').insert({
    profile_id: profileId,
    referral_source: referer,
    user_agent: userAgent,
    ip_hash: ipHash,
  });
}

/**
 * Public profile page — SSR, no auth required.
 */
export default async function PublicProfilePage({ params }: Props) {
  const supabase = createClient();
  const repo = new ProfileRepository(supabase, '');

  const { data: profile } = await repo.findBySlug(params.drname);

  if (!profile) {
    notFound();
  }

  // Record analytics view (fire-and-forget, non-blocking)
  void recordView(supabase, profile.id);

  const jsonLd = generateJsonLd(profile);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicProfile profile={profile} />
    </>
  );
}
