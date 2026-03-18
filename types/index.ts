export type UserRole = 'owner' | 'receptionist' | 'assistant';

export type User = {
  id: string; // from auth.users
  email: string;
  role: UserRole;
  createdAt: string;
};

export type Patient = {
  id: string;
  ownerId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PatientFile = {
  id: string;
  patientId: string;
  folderId: string | null;
  fileName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  tags: string[];
  createdAt: string;
};

export type Folder = {
  id: string;
  patientId: string;
  name: string;
  parentId: string | null;
  createdAt: string;
};

export type AppointmentNote = {
  id: string;
  patientId: string;
  content: string;
  authorId: string;
  createdAt: string;
};

export type DoctorProfile = {
  id: string;
  userId: string;
  slug: string;
  displayName: string;
  specialty: string | null;
  credentials: string | null;
  clinicAddress: string | null;
  consultationHours: Record<string, string> | null;
  contactCTA: string | null;
  bookingCTA: string | null;
  avatarUrl: string | null;
  bio: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProfileAnalytics = {
  id: string;
  profileId: string;
  viewedAt: string;
  referralSource: string | null;
  linkClicked: string | null;
  userAgent: string | null;
  ipHash: string | null;
};

export type StaffAccess = {
  id: string;
  ownerId: string;
  staffUserId: string;
  role: 'receptionist' | 'assistant';
  permissions: 'view' | 'edit';
  grantedAt: string;
};

export type SubscriptionTier = 'free' | 'pro' | 'clinic';

export type Subscription = {
  id: string;
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  tier: SubscriptionTier;
  status: string;
  currentPeriodEnd: string;
  createdAt: string;
  updatedAt: string;
};
