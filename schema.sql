-- ====================================================================
-- Home Tutor Timeline & Task Management Database Schema (Supabase / PostgreSQL)
-- ====================================================================

-- 1. Enable UUID Extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    subject VARCHAR(100) NOT NULL DEFAULT 'General',
    status VARCHAR(50) NOT NULL DEFAULT 'start' CHECK (status IN ('start', 'ongoing', 'update raised', 'done')),
    student_id VARCHAR(100) NOT NULL DEFAULT 'student-1',
    student_name VARCHAR(100) NOT NULL DEFAULT 'Mohona',
    tutor_id VARCHAR(100) NOT NULL DEFAULT 'tutor-1',
    tutor_name VARCHAR(100) NOT NULL DEFAULT 'Tutor Axis',
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 3. Attachments Table (Questions, Screenshots, Problem Details)
CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('text_question', 'screenshot', 'solution', 'feedback')),
    content TEXT, -- Text question or explanation
    file_url TEXT, -- URL or storage path for screenshot/image
    file_name VARCHAR(255),
    uploader_role VARCHAR(20) NOT NULL CHECK (uploader_role IN ('student', 'tutor')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 4. Timeline Events Table (Audit trail of status transitions)
CREATE TABLE IF NOT EXISTS timeline_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL CHECK (to_status IN ('start', 'ongoing', 'update raised', 'done')),
    actor_role VARCHAR(20) NOT NULL CHECK (actor_role IN ('student', 'tutor')),
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 5. Comments / Tutor Guidance Table
CREATE TABLE IF NOT EXISTS task_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author_role VARCHAR(20) NOT NULL CHECK (author_role IN ('student', 'tutor')),
    author_name VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 6. Users Table (Stores user credentials without hashing as specified)
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password TEXT NOT NULL, -- Stored directly without hashing as requested
    role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'tutor')),
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 7. Email Verification Codes Table (Used by Nodemailer verification during reg)
CREATE TABLE IF NOT EXISTS email_verification_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 8. Indexes for High-Performance Queries
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_student_id ON tasks(student_id);
CREATE INDEX IF NOT EXISTS idx_attachments_task_id ON attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_task_id ON timeline_events(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);
CREATE INDEX IF NOT EXISTS idx_email_verification_email ON email_verification_codes(email);

-- 9. Weekly Routines Table (7-Day Schedule)
CREATE TABLE IF NOT EXISTS weekly_routines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    day VARCHAR(20) NOT NULL CHECK (day IN ('Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')),
    subject VARCHAR(100) NOT NULL DEFAULT 'Mathematics',
    time_slot VARCHAR(100) NOT NULL,
    topic VARCHAR(255) NOT NULL,
    note TEXT,
    creator_role VARCHAR(20) NOT NULL CHECK (creator_role IN ('student', 'tutor')),
    creator_name VARCHAR(100) NOT NULL DEFAULT 'Mohona',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_weekly_routines_day ON weekly_routines(day);

-- 10. Disable RLS for unrestricted backend API access
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE attachments DISABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_verification_codes DISABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_routines DISABLE ROW LEVEL SECURITY;

