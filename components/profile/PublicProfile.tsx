'use client';

import type { DoctorProfile } from '@/types';
import { ConsultationHours } from './ConsultationHours';
import { ContactCTA } from './ContactCTA';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { MapPin, Award, Stethoscope } from 'lucide-react';

type PublicProfileProps = {
  profile: DoctorProfile;
};

export function PublicProfile({ profile }: PublicProfileProps) {
  const initials = profile.displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-blue-800 to-blue-900 text-white">
        <div className="max-w-3xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-28 w-28 border-4 border-white/20 shadow-lg mb-6">
              {profile.avatarUrl && (
                <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
              )}
              <AvatarFallback className="bg-blue-600 text-white text-2xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>

            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              {profile.displayName}
            </h1>

            {profile.specialty && (
              <div className="flex items-center gap-2 mt-3 text-blue-100">
                <Stethoscope className="h-4 w-4" />
                <span className="text-lg">{profile.specialty}</span>
              </div>
            )}

            {profile.credentials && (
              <div className="flex items-center gap-2 mt-2 text-blue-200">
                <Award className="h-4 w-4" />
                <span className="text-sm">{profile.credentials}</span>
              </div>
            )}

            {profile.clinicAddress && (
              <div className="flex items-center gap-2 mt-3 text-blue-200">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">{profile.clinicAddress}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-3xl mx-auto px-4 py-10 sm:px-6 lg:px-8 space-y-8">
        {/* CTAs */}
        <ContactCTA
          contactCTA={profile.contactCTA}
          bookingCTA={profile.bookingCTA}
        />

        {/* Bio */}
        {profile.bio && (
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">About</h2>
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                {profile.bio}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Consultation Hours */}
        {profile.consultationHours &&
          Object.keys(profile.consultationHours).length > 0 && (
            <>
              <Separator />
              <ConsultationHours hours={profile.consultationHours} />
            </>
          )}

        {/* Footer badge */}
        <div className="text-center pt-6">
          <Badge variant="secondary" className="text-xs text-gray-400">
            Powered by MediLink
          </Badge>
        </div>
      </div>
    </div>
  );
}
