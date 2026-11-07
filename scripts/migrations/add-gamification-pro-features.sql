-- Gamification & Pro Features Migration
-- Run this migration to add XP system, achievements, streak shields, study goals, and profile customization

-- ============================================
-- 1. Extend profiles table with gamification fields
-- ============================================
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS xp_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS xp_level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS streak_shields_remaining INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS streak_shields_reset_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS profile_frame TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS study_goal_weekly_minutes INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS study_goal_monthly_minutes INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- ============================================
-- 2. Create achievements table
-- ============================================
CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('streak', 'study_time', 'tests', 'special')),
  xp_reward INTEGER DEFAULT 0,
  is_pro_only BOOLEAN DEFAULT false,
  requirement_value INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. Create user_achievements table
-- ============================================
CREATE TABLE IF NOT EXISTS user_achievements (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id INTEGER REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);

-- ============================================
-- 4. Create profile_frames table
-- ============================================
CREATE TABLE IF NOT EXISTS profile_frames (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  preview_url TEXT,
  css_class TEXT NOT NULL,
  is_pro_only BOOLEAN DEFAULT true,
  unlock_condition TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 5. Create study_goals table
-- ============================================
CREATE TABLE IF NOT EXISTS study_goals (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('weekly', 'monthly')),
  target_minutes INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  progress_minutes INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, goal_type, start_date)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_study_goals_user_id ON study_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_study_goals_status ON study_goals(status);

-- ============================================
-- 6. Create xp_transactions table
-- ============================================
CREATE TABLE IF NOT EXISTS xp_transactions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  multiplier NUMERIC DEFAULT 1,
  reference_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_xp_transactions_user_id ON xp_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_created_at ON xp_transactions(created_at DESC);

-- ============================================
-- 7. Create study_sessions table (for session history)
-- ============================================
CREATE TABLE IF NOT EXISTS study_sessions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
  duration_seconds INTEGER NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('pomodoro', 'stopwatch', 'countdown')),
  xp_earned INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- Create indexes for session history
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id ON study_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_ended_at ON study_sessions(ended_at DESC);

-- ============================================
-- 8. Seed default achievements
-- ============================================
INSERT INTO achievements (slug, name, description, icon, category, xp_reward, is_pro_only, requirement_value, sort_order) VALUES
-- Streak achievements
('streak_3', 'Getting Started', 'Study for 3 days in a row', 'flame', 'streak', 50, false, 3, 1),
('streak_7', 'Week Warrior', 'Maintain a 7-day study streak', 'flame', 'streak', 100, false, 7, 2),
('streak_14', 'Fortnight Fighter', '14 days of consistent study', 'flame', 'streak', 200, false, 14, 3),
('streak_30', 'Monthly Master', '30 days without missing a day', 'flame', 'streak', 500, true, 30, 4),
('streak_100', 'Centurion', 'Legendary 100-day streak', 'crown', 'streak', 1000, true, 100, 5),

-- Study time achievements
('study_1h', 'First Hour', 'Study for 1 hour total', 'clock', 'study_time', 25, false, 60, 10),
('study_10h', 'Dedicated Learner', '10 hours of study', 'clock', 'study_time', 100, false, 600, 11),
('study_50h', 'Knowledge Seeker', '50 hours of study', 'book-open', 'study_time', 300, false, 3000, 12),
('study_100h', 'Study Champion', '100 hours of focused study', 'trophy', 'study_time', 500, false, 6000, 13),
('study_500h', 'Grand Scholar', '500 hours of mastery', 'star', 'study_time', 2000, true, 30000, 14),

-- Test achievements
('first_test', 'Test Taker', 'Complete your first test', 'check-circle', 'tests', 50, false, 1, 20),
('tests_10', 'Quiz Master', 'Complete 10 tests', 'target', 'tests', 150, false, 10, 21),
('tests_50', 'Exam Expert', 'Complete 50 tests', 'award', 'tests', 400, false, 50, 22),
('perfect_score', 'Perfect Score', 'Score 100% on any test', 'star', 'tests', 200, false, 100, 23),
('pass_streak_5', 'On Fire', 'Pass 5 tests in a row', 'zap', 'tests', 250, true, 5, 24),

-- Special achievements
('early_bird', 'Early Bird', 'Study before 6 AM', 'sunrise', 'special', 100, false, NULL, 30),
('night_owl', 'Night Owl', 'Study after midnight', 'moon', 'special', 100, false, NULL, 31),
('weekend_warrior', 'Weekend Warrior', 'Study both Saturday and Sunday', 'calendar', 'special', 75, false, NULL, 32),
('pro_member', 'Pro Member', 'Upgrade to Pro membership', 'crown', 'special', 500, true, NULL, 33)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 9. Seed default profile frames
-- ============================================
INSERT INTO profile_frames (slug, name, css_class, is_pro_only, unlock_condition, sort_order) VALUES
('default', 'Default', 'ring-2 ring-white/20', false, NULL, 0),
('gold_ring', 'Golden Champion', 'ring-4 ring-yellow-500 shadow-lg shadow-yellow-500/30', true, 'pro_member', 1),
('fire_border', 'Blazing Streak', 'ring-4 ring-orange-500 animate-pulse', true, 'achievement:streak_30', 2),
('diamond', 'Diamond Elite', 'ring-4 ring-cyan-400 shadow-lg shadow-cyan-400/40', true, 'achievement:study_100h', 3),
('rainbow', 'Rainbow Master', 'ring-4 ring-purple-500 shadow-lg shadow-purple-500/30', true, 'achievement:streak_100', 4),
('neon_green', 'Neon Focus', 'ring-4 ring-green-400 shadow-lg shadow-green-400/30', true, 'pro_member', 5)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 10. Create RLS policies
-- ============================================

-- Enable RLS on new tables
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;

-- Achievements: Everyone can read, nobody can modify (admin only via service role)
CREATE POLICY "Achievements are viewable by everyone" ON achievements
  FOR SELECT USING (true);

-- User achievements: Users can read all, but only insert their own
CREATE POLICY "Users can view all achievements" ON user_achievements
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own achievements" ON user_achievements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Profile frames: Everyone can read
CREATE POLICY "Profile frames are viewable by everyone" ON profile_frames
  FOR SELECT USING (true);

-- Study goals: Users can only manage their own
CREATE POLICY "Users can manage their own study goals" ON study_goals
  FOR ALL USING (auth.uid() = user_id);

-- XP transactions: Users can read their own, insert handled by functions
CREATE POLICY "Users can view their own XP transactions" ON xp_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own XP transactions" ON xp_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Study sessions: Users can manage their own
CREATE POLICY "Users can manage their own study sessions" ON study_sessions
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 11. Create helper functions
-- ============================================

-- Function to award XP and update profile
CREATE OR REPLACE FUNCTION award_xp(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_reference_id TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_multiplier NUMERIC;
  v_final_amount INTEGER;
  v_new_total INTEGER;
  v_new_level INTEGER;
BEGIN
  -- Check if user is Pro for multiplier
  SELECT CASE WHEN is_pro_member THEN 1.5 ELSE 1.0 END INTO v_multiplier
  FROM profiles WHERE id = p_user_id;

  v_final_amount := FLOOR(p_amount * v_multiplier);

  -- Insert XP transaction
  INSERT INTO xp_transactions (user_id, amount, reason, multiplier, reference_id)
  VALUES (p_user_id, v_final_amount, p_reason, v_multiplier, p_reference_id);

  -- Update profile XP
  UPDATE profiles
  SET xp_points = xp_points + v_final_amount,
      updated_at = NOW()
  WHERE id = p_user_id
  RETURNING xp_points INTO v_new_total;

  -- Calculate new level (using formula: level = floor(sqrt(xp/100)) + 1)
  v_new_level := GREATEST(1, FLOOR(SQRT(v_new_total::NUMERIC / 100)) + 1);

  -- Update level if changed
  UPDATE profiles SET xp_level = v_new_level WHERE id = p_user_id AND xp_level != v_new_level;

  RETURN v_final_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to use a streak shield
CREATE OR REPLACE FUNCTION use_streak_shield(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_shields INTEGER;
  v_is_pro BOOLEAN;
BEGIN
  SELECT streak_shields_remaining, is_pro_member INTO v_shields, v_is_pro
  FROM profiles WHERE id = p_user_id;

  -- Only Pro members can have shields
  IF NOT v_is_pro THEN
    RETURN FALSE;
  END IF;

  -- Check if shields available
  IF v_shields <= 0 THEN
    RETURN FALSE;
  END IF;

  -- Use shield
  UPDATE profiles
  SET streak_shields_remaining = streak_shields_remaining - 1,
      updated_at = NOW()
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset monthly streak shields for Pro users
CREATE OR REPLACE FUNCTION reset_monthly_streak_shields()
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET streak_shields_remaining = 3,
      streak_shields_reset_at = NOW(),
      updated_at = NOW()
  WHERE is_pro_member = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION award_xp TO authenticated;
GRANT EXECUTE ON FUNCTION use_streak_shield TO authenticated;
