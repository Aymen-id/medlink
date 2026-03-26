'use client';

import { useState, useCallback } from 'react';
import type { DoctorProfile } from '@/types';
import { updateProfile, checkSlug } from '@/app/(dashboard)/settings/profile/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, ExternalLink, Save } from 'lucide-react';

type ProfileEditorProps = {
  profile: DoctorProfile | null;
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function ProfileEditor({ profile }: ProfileEditorProps) {
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [slug, setSlug] = useState(profile?.slug ?? '');
  const [specialty, setSpecialty] = useState(profile?.specialty ?? '');
  const [credentials, setCredentials] = useState(profile?.credentials ?? '');
  const [clinicAddress, setClinicAddress] = useState(profile?.clinicAddress ?? '');
  const [contactCTA, setContactCTA] = useState(profile?.contactCTA ?? '');
  const [bookingCTA, setBookingCTA] = useState(profile?.bookingCTA ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [isPublished, setIsPublished] = useState(profile?.isPublished ?? false);
  const [hours, setHours] = useState<Record<string, string>>(
    profile?.consultationHours ?? {},
  );

  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Debounced slug check
  const handleSlugChange = useCallback(async (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(cleaned);
    setSlugStatus('idle');

    if (cleaned.length < 3) return;

    setSlugStatus('checking');
    const result = await checkSlug(cleaned);
    setSlugStatus(result.available ? 'available' : 'taken');
  }, []);

  const handleHourChange = (day: string, value: string) => {
    setHours((prev) => {
      if (!value.trim()) {
        const next = { ...prev };
        delete next[day];
        return next;
      }
      return { ...prev, [day]: value };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);

    const result = await updateProfile({
      displayName,
      slug,
      specialty: specialty || null,
      credentials: credentials || null,
      clinicAddress: clinicAddress || null,
      consultationHours: Object.keys(hours).length > 0 ? hours : null,
      contactCTA: contactCTA || null,
      bookingCTA: bookingCTA || null,
      bio: bio || null,
      isPublished,
    });

    setSaving(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>
            Your public profile details visible to patients.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name *</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Dr. Jane Smith"
                required
                minLength={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="specialty">Specialty</Label>
              <Input
                id="specialty"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="Dermatology"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="credentials">Credentials</Label>
            <Input
              id="credentials"
              value={credentials}
              onChange={(e) => setCredentials(e.target.value)}
              placeholder="MD, FAAD, Board-Certified"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell patients about your experience and practice..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clinicAddress">Clinic Address</Label>
            <Input
              id="clinicAddress"
              value={clinicAddress}
              onChange={(e) => setClinicAddress(e.target.value)}
              placeholder="123 Medical Lane, Casablanca"
            />
          </div>
        </CardContent>
      </Card>

      {/* Profile URL */}
      <Card>
        <CardHeader>
          <CardTitle>Profile URL</CardTitle>
          <CardDescription>
            Your unique MediLink page URL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 whitespace-nowrap">medilink.io/</span>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="dr-smith"
              required
              minLength={3}
              className="flex-1"
            />
            {slugStatus === 'checking' && (
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            )}
            {slugStatus === 'available' && (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            )}
            {slugStatus === 'taken' && (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
          </div>
          {slugStatus === 'taken' && (
            <p className="text-sm text-red-500">This URL is already taken.</p>
          )}
          {isPublished && slug.length >= 3 && (
            <a
              href={`/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-800 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Preview your profile
            </a>
          )}
        </CardContent>
      </Card>

      {/* Contact CTAs */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Options</CardTitle>
          <CardDescription>
            How patients can reach you from your profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contactCTA">Phone / WhatsApp / Email</Label>
              <Input
                id="contactCTA"
                value={contactCTA}
                onChange={(e) => setContactCTA(e.target.value)}
                placeholder="+212 600 000 000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bookingCTA">Booking Link</Label>
              <Input
                id="bookingCTA"
                value={bookingCTA}
                onChange={(e) => setBookingCTA(e.target.value)}
                placeholder="https://cal.com/drsmith"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Consultation Hours */}
      <Card>
        <CardHeader>
          <CardTitle>Consultation Hours</CardTitle>
          <CardDescription>
            Leave a day blank if your practice is closed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {DAYS.map((day) => (
              <div key={day} className="flex items-center gap-3">
                <span className="w-24 text-sm font-medium text-gray-700">{day}</span>
                <Input
                  value={hours[day] ?? ''}
                  onChange={(e) => handleHourChange(day, e.target.value)}
                  placeholder="9:00 - 17:00"
                  className="flex-1"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Publish & Save */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-800 focus:ring-blue-800"
            />
            <span className="text-sm font-medium text-gray-700">Publish profile</span>
          </label>
          {isPublished ? (
            <Badge className="bg-green-100 text-green-800">Live</Badge>
          ) : (
            <Badge variant="secondary">Draft</Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-600">Profile saved!</p>
          )}
          <Button
            type="submit"
            disabled={saving || slugStatus === 'taken'}
            className="bg-blue-800 hover:bg-blue-700"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Profile
          </Button>
        </div>
      </div>
    </form>
  );
}
