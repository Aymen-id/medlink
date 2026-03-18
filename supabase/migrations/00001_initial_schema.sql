-- 1. Create a custom function to update the 'updated_at' timestamp
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create the Doctor Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.doctor_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  specialty TEXT,
  credentials TEXT,
  clinic_address TEXT,
  consultation_hours JSONB,
  contact_cta TEXT,
  booking_cta TEXT,
  avatar_url TEXT,
  bio TEXT,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER handle_doctor_profiles_updated_at
BEFORE UPDATE ON public.doctor_profiles
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- 3. Create the Subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.doctor_profiles(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  tier TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER handle_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- 4. Create the Staff Access table
CREATE TABLE IF NOT EXISTS public.staff_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.doctor_profiles(id) ON DELETE CASCADE,
  staff_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('receptionist', 'assistant')),
  permissions TEXT NOT NULL CHECK (permissions IN ('view', 'edit')),
  granted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(owner_id, staff_user_id)
);

-- 5. Create Patients table
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.doctor_profiles(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  gender TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER handle_patients_updated_at
BEFORE UPDATE ON public.patients
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- 6. Create Folders table
CREATE TABLE IF NOT EXISTS public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 7. Create Patient Files table
CREATE TABLE IF NOT EXISTS public.patient_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 8. Create Appointment Notes table
CREATE TABLE IF NOT EXISTS public.appointment_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 9. Create Profile Analytics table
CREATE TABLE IF NOT EXISTS public.profile_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.doctor_profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  referral_source TEXT,
  link_clicked TEXT,
  user_agent TEXT,
  ip_hash TEXT
);

-- 10. Configure Row Level Security (RLS) policies

ALTER TABLE public.doctor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_analytics ENABLE ROW LEVEL SECURITY;

-- Helper function to check if a user is staff for a specific owner
CREATE OR REPLACE FUNCTION is_staff_for_owner(check_owner_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.staff_access
    WHERE owner_id = check_owner_id AND staff_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Doctor Profiles: public can read if published, owner can CRUD
CREATE POLICY "Public profiles are viewable by everyone" ON public.doctor_profiles
  FOR SELECT USING (is_published = TRUE);

CREATE POLICY "Owners can view own profile" ON public.doctor_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Owners can update own profile" ON public.doctor_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Owners can insert own profile" ON public.doctor_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Subscriptions: owner only
CREATE POLICY "Owners can view own subscription" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Staff Access: owner only
CREATE POLICY "Owners can manage staff" ON public.staff_access
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "Staff can view their own access" ON public.staff_access
  FOR SELECT USING (auth.uid() = staff_user_id);

-- Patients: owner and authorized staff
CREATE POLICY "Owners can CRUD patients" ON public.patients
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "Staff can SELECT patients" ON public.patients
  FOR SELECT USING (is_staff_for_owner(owner_id));

CREATE POLICY "Staff can insert patients if edit permission" ON public.patients
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.staff_access WHERE owner_id = patients.owner_id AND staff_user_id = auth.uid() AND permissions = 'edit')
  );

CREATE POLICY "Staff can update patients if edit permission" ON public.patients
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.staff_access WHERE owner_id = patients.owner_id AND staff_user_id = auth.uid() AND permissions = 'edit')
  );

-- Function to get owner_id for a patient
CREATE OR REPLACE FUNCTION get_patient_owner(check_patient_id UUID)
RETURNS UUID AS $$
  SELECT owner_id FROM public.patients WHERE id = check_patient_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Patient Files: owner and authorized staff
CREATE POLICY "Owners can CRUD patient files" ON public.patient_files
  FOR ALL USING (auth.uid() = get_patient_owner(patient_id));

CREATE POLICY "Staff can SELECT patient files" ON public.patient_files
  FOR SELECT USING (is_staff_for_owner(get_patient_owner(patient_id)));

CREATE POLICY "Staff can INSERT patient files if edit permission" ON public.patient_files
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.staff_access WHERE owner_id = get_patient_owner(patient_id) AND staff_user_id = auth.uid() AND permissions = 'edit')
  );

CREATE POLICY "Staff can UPDATE patient files if edit permission" ON public.patient_files
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.staff_access WHERE owner_id = get_patient_owner(patient_id) AND staff_user_id = auth.uid() AND permissions = 'edit')
  );

-- Folders: same as patient files
CREATE POLICY "Owners can CRUD folders" ON public.folders
  FOR ALL USING (auth.uid() = get_patient_owner(patient_id));

CREATE POLICY "Staff can SELECT folders" ON public.folders
  FOR SELECT USING (is_staff_for_owner(get_patient_owner(patient_id)));

CREATE POLICY "Staff can INSERT/UPDATE folders if edit permission" ON public.folders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.staff_access WHERE owner_id = get_patient_owner(patient_id) AND staff_user_id = auth.uid() AND permissions = 'edit')
  );

-- Notes: owner and authorized staff
CREATE POLICY "Owners can CRUD notes" ON public.appointment_notes
  FOR ALL USING (auth.uid() = get_patient_owner(patient_id));

CREATE POLICY "Staff can SELECT notes" ON public.appointment_notes
  FOR SELECT USING (is_staff_for_owner(get_patient_owner(patient_id)));

CREATE POLICY "Staff can INSERT notes" ON public.appointment_notes
  FOR INSERT WITH CHECK (is_staff_for_owner(get_patient_owner(patient_id)));

-- Analytics: public insert, owner select
CREATE POLICY "Anyone can insert analytics" ON public.profile_analytics
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Owners can view own analytics" ON public.profile_analytics
  FOR SELECT USING (auth.uid() = profile_id);

-- Storage bucket for patient files (this must be run manually or via Supabase dashboard if buckets are missing)
-- Insert standard storage RLS below:
-- Ensure storage extension and buckets exist (assuming Supabase Storage is configured)
