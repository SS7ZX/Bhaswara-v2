CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
  id UUID PRIMARY KEY,
  email CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  display_name TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  locale TEXT NOT NULL DEFAULT 'id',
  birth_date DATE,
  consent_version INT NOT NULL DEFAULT 0,
  avatar_id UUID,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE consents (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  purpose TEXT NOT NULL,
  version INT NOT NULL,
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  UNIQUE (user_id, purpose, version)
);

CREATE TABLE languages (
  id UUID PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE dialects (
  id UUID PRIMARY KEY,
  language_id UUID NOT NULL REFERENCES languages(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE (language_id, code)
);

CREATE TABLE lessons (
  id UUID PRIMARY KEY,
  language_id UUID NOT NULL REFERENCES languages(id),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  order_index INT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE lesson_items (
  id UUID PRIMARY KEY,
  lesson_id UUID NOT NULL REFERENCES lessons(id),
  item_type TEXT NOT NULL CHECK (item_type IN ('vocabulary', 'quiz', 'pronunciation')),
  order_index INT NOT NULL
);

CREATE TABLE vocabulary (
  id UUID PRIMARY KEY,
  language_id UUID NOT NULL REFERENCES languages(id),
  dialect_id UUID REFERENCES dialects(id),
  word TEXT NOT NULL,
  meaning TEXT NOT NULL,
  ipa TEXT,
  audio_required BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE vocabulary_audio_reference (
  id UUID PRIMARY KEY,
  vocabulary_id UUID NOT NULL REFERENCES vocabulary(id),
  source_uri TEXT NOT NULL,
  checksum TEXT NOT NULL,
  provider TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE attempts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  lesson_item_id UUID REFERENCES lesson_items(id),
  vocabulary_id UUID REFERENCES vocabulary(id),
  score NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  model_version TEXT NOT NULL,
  transcript TEXT,
  duration_ms INT CHECK (duration_ms > 0),
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE xp_events (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  delta_xp INT NOT NULL,
  reason TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);

CREATE TABLE streaks (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  current_streak INT NOT NULL DEFAULT 0,
  longest_streak INT NOT NULL DEFAULT 0,
  last_valid_day DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE streak_freezes (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  iso_week TEXT NOT NULL,
  remains INT NOT NULL DEFAULT 1,
  used_at TIMESTAMPTZ,
  UNIQUE (user_id, iso_week)
);

CREATE TABLE achievements (
  id UUID PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE user_achievements (
  user_id UUID NOT NULL REFERENCES users(id),
  achievement_id UUID NOT NULL REFERENCES achievements(id),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);

CREATE TABLE schools (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT NOT NULL
);

CREATE TABLE classes (
  id UUID PRIMARY KEY,
  teacher_user_id UUID NOT NULL REFERENCES users(id),
  school_id UUID REFERENCES schools(id),
  invite_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE class_members (
  user_id UUID NOT NULL REFERENCES users(id),
  class_id UUID NOT NULL REFERENCES classes(id),
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'guardian')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, class_id)
);

CREATE TABLE cultural_content (
  id UUID PRIMARY KEY,
  language_id UUID REFERENCES languages(id),
  title TEXT NOT NULL,
  content_type TEXT NOT NULL,
  body TEXT,
  source TEXT,
  author TEXT,
  review_status TEXT NOT NULL CHECK (review_status IN ('draft', 'pending', 'approved', 'rejected')),
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id)
);

CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  actor_user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  token_family UUID NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_user_profiles_timezone ON user_profiles (timezone);
CREATE INDEX idx_attempts_user_created ON attempts (user_id, created_at);
CREATE INDEX idx_attempts_user_vocabulary ON attempts (user_id, vocabulary_id, created_at);
CREATE INDEX idx_xp_events_user_created ON xp_events (user_id, created_at);
CREATE INDEX idx_streak_freezes_user_week ON streak_freezes (user_id, iso_week);
CREATE INDEX idx_classes_invite_code ON classes (invite_code);
CREATE INDEX idx_class_members_class_role ON class_members (class_id, role);
CREATE INDEX idx_cultural_content_status_published ON cultural_content (review_status, published_at);
