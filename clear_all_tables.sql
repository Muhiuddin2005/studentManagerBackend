-- ====================================================================
-- TutorFlow - Clear All Database Tables for Production Deployment
-- ====================================================================
-- Run this in your Supabase Dashboard -> SQL Editor to reset all data.

-- Truncate all tables in order of foreign key dependency
TRUNCATE TABLE task_comments CASCADE;
TRUNCATE TABLE timeline_events CASCADE;
TRUNCATE TABLE attachments CASCADE;
TRUNCATE TABLE tasks CASCADE;
TRUNCATE TABLE weekly_routines CASCADE;
TRUNCATE TABLE email_verification_codes CASCADE;
TRUNCATE TABLE app_users CASCADE;

-- Optional: Reset sequence generators if needed
-- (All tables use UUID v4 so no sequence counter reset is needed)
