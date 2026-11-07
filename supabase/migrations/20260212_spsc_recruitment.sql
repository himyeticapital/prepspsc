-- SPSC Recruitment Form Automation Tables
-- Phase 1: Database foundation for form-filling bot

-- ============================================
-- 1. Recruitments table (must be created first due to FK references)
-- ============================================
CREATE TABLE IF NOT EXISTS spsc_recruitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  post_name TEXT,
  department TEXT,
  notification_url TEXT,
  application_url TEXT,
  published_date DATE,
  last_date_apply DATE,
  exam_date DATE,
  min_qualification TEXT,
  age_limit_min INTEGER,
  age_limit_max INTEGER,
  eligible_categories TEXT[],
  total_vacancies INTEGER,
  pay_scale TEXT,
  raw_html TEXT,
  is_active BOOLEAN DEFAULT true,
  scraped_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(notification_url)
);

CREATE INDEX idx_spsc_recruitments_active ON spsc_recruitments(is_active, last_date_apply);
ALTER TABLE spsc_recruitments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read recruitments" ON spsc_recruitments FOR SELECT USING (true);
CREATE POLICY "Service role can manage recruitments" ON spsc_recruitments FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 2. Form applications table
-- ============================================
CREATE TABLE IF NOT EXISTS spsc_form_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  portal_email_encrypted TEXT,
  portal_password_encrypted TEXT,
  full_name TEXT,
  father_name TEXT,
  mother_name TEXT,
  date_of_birth DATE,
  gender TEXT,
  marital_status TEXT,
  nationality TEXT DEFAULT 'Indian',
  religion TEXT,
  category TEXT,
  sub_category TEXT,
  is_pwd BOOLEAN DEFAULT false,
  pwd_type TEXT,
  permanent_address JSONB,
  correspondence_address JSONB,
  phone TEXT,
  alt_phone TEXT,
  email TEXT,
  qualifications JSONB DEFAULT '[]',
  work_experience JSONB DEFAULT '[]',
  passport_photo_path TEXT,
  signature_path TEXT,
  id_proof_path TEXT,
  education_certificates JSONB DEFAULT '[]',
  category_certificate_path TEXT,
  experience_certificates JSONB DEFAULT '[]',
  target_recruitment_id UUID REFERENCES spsc_recruitments(id),
  target_post_name TEXT,
  status TEXT DEFAULT 'collecting_data',
  current_step TEXT,
  automation_session_id TEXT,
  last_error TEXT,
  retry_count INTEGER DEFAULT 0,
  screenshots JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_spsc_apps_user ON spsc_form_applications(user_id);
CREATE INDEX idx_spsc_apps_status ON spsc_form_applications(status);

ALTER TABLE spsc_form_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on spsc_apps"
  ON spsc_form_applications FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own applications"
  ON spsc_form_applications FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================
-- 3. Form collection table (conversational data gathering)
-- ============================================
CREATE TABLE IF NOT EXISTS spsc_form_collection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  platform_user_id TEXT NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  collection_step TEXT DEFAULT 'start',
  collected_data JSONB DEFAULT '{}',
  sub_step TEXT,
  sub_step_index INTEGER DEFAULT 0,
  target_recruitment_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours'),
  UNIQUE(platform, platform_user_id)
);

CREATE INDEX idx_spsc_collection_lookup ON spsc_form_collection(platform, platform_user_id);
ALTER TABLE spsc_form_collection ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on spsc_collection" ON spsc_form_collection FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 4. User preferences table
-- ============================================
CREATE TABLE IF NOT EXISTS spsc_user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  highest_qualification TEXT,
  category TEXT,
  age INTEGER,
  notify_new_recruitments BOOLEAN DEFAULT true,
  notify_deadline_reminders BOOLEAN DEFAULT true,
  preferred_departments TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE spsc_user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on spsc_prefs" ON spsc_user_preferences FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 5. Storage bucket for documents
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('spsc-documents', 'spsc-documents', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Service role manages spsc documents" ON storage.objects FOR ALL USING (bucket_id = 'spsc-documents' AND auth.role() = 'service_role');
