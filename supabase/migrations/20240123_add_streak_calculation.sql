-- Migration: Add streak calculation function
-- This function calculates and updates user streaks based on daily_study_logs

-- Function to calculate and update streak for a user
create or replace function calculate_streak(p_user_id uuid)
returns table(current_streak integer, max_streak integer) as $$
declare
  v_current_streak integer := 0;
  v_max_streak integer := 0;
  v_check_date date := current_date;
  v_studied_today boolean := false;
  v_studied_yesterday boolean := false;
  v_consecutive_days integer := 0;
begin
  -- Check if user studied today
  select exists(
    select 1 from daily_study_logs
    where user_id = p_user_id
    and study_date = current_date
    and minutes_studied > 0
  ) into v_studied_today;

  -- Check if user studied yesterday
  select exists(
    select 1 from daily_study_logs
    where user_id = p_user_id
    and study_date = current_date - interval '1 day'
    and minutes_studied > 0
  ) into v_studied_yesterday;

  -- If user didn't study today, return current values from profile
  if not v_studied_today then
    select p.current_streak, p.max_streak
    into v_current_streak, v_max_streak
    from profiles p where p.id = p_user_id;

    return query select v_current_streak, v_max_streak;
    return;
  end if;

  -- User studied today - calculate streak by counting consecutive days backwards
  v_check_date := current_date;
  v_consecutive_days := 0;

  loop
    -- Check if there's a study log for this date
    if exists(
      select 1 from daily_study_logs
      where user_id = p_user_id
      and study_date = v_check_date
      and minutes_studied > 0
    ) then
      v_consecutive_days := v_consecutive_days + 1;
      v_check_date := v_check_date - interval '1 day';
    else
      exit; -- Break the loop when we find a day without study
    end if;

    -- Safety limit to prevent infinite loops
    if v_consecutive_days > 1000 then
      exit;
    end if;
  end loop;

  v_current_streak := v_consecutive_days;

  -- Get current max_streak from profile
  select p.max_streak into v_max_streak
  from profiles p where p.id = p_user_id;

  -- Update max_streak if current is higher
  if v_current_streak > coalesce(v_max_streak, 0) then
    v_max_streak := v_current_streak;
  end if;

  -- Update the profile with new streak values
  update profiles
  set current_streak = v_current_streak,
      max_streak = v_max_streak
  where id = p_user_id;

  return query select v_current_streak, v_max_streak;
end;
$$ language plpgsql security definer;

-- Function to reset streaks for users who didn't study yesterday (run daily via cron)
create or replace function reset_broken_streaks()
returns void as $$
begin
  -- Reset streak to 0 for users who:
  -- 1. Have a current_streak > 0
  -- 2. Didn't study yesterday
  -- 3. Haven't studied today yet
  update profiles p
  set current_streak = 0
  where p.current_streak > 0
  and not exists (
    select 1 from daily_study_logs dsl
    where dsl.user_id = p.id
    and dsl.study_date = current_date - interval '1 day'
    and dsl.minutes_studied > 0
  )
  and not exists (
    select 1 from daily_study_logs dsl
    where dsl.user_id = p.id
    and dsl.study_date = current_date
    and dsl.minutes_studied > 0
  );
end;
$$ language plpgsql security definer;

-- Grant execute permissions
grant execute on function calculate_streak(uuid) to authenticated;
grant execute on function reset_broken_streaks() to service_role;
