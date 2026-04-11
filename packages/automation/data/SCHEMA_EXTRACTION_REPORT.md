# Database Schema Extraction Report
## For Django Model Code Generator

> **Generated for**: Nzila Automation — Django Migration Code Generator  
> **Source Codebases**: ABR Insights (Supabase/SQL) & UnionEyes (Drizzle ORM)  
> **Purpose**: Reference document for building a code generator that converts legacy schemas to Django models

---

## Table of Contents

1. [ABR Insights — Supabase SQL Tables](#1-abr-insights--supabase-sql-tables)
2. [UnionEyes — Drizzle ORM Tables](#2-union-eyes--drizzle-orm-tables)
3. [ABR Insights — TypeScript Types](#3-abr-insights--typescript-types)
4. [Shared Patterns & Conventions](#4-shared-patterns--conventions)
5. [Django Model Mapping Guide](#5-django-model-mapping-guide)
6. [Complete Entity Inventory](#6-complete-entity-inventory)

---

## 1. ABR Insights — Supabase SQL Tables

**Source Path**: `legacy-codebases/abr-insights-app-main/abr-insights-app-main/supabase/migrations/`  
**Database**: PostgreSQL 15+ via Supabase  
**Extensions**: uuid-ossp, pgcrypto, pgvector, pg_trgm

### 1.1 Core Identity & RBAC (001_initial_schema.sql)

#### `organizations`
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  stripe_customer_id TEXT,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'professional', 'enterprise')),
  subscription_status TEXT DEFAULT 'active',
  seat_limit INTEGER DEFAULT 5,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `profiles`
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  job_title TEXT,
  department TEXT,
  phone TEXT,
  language TEXT DEFAULT 'en' CHECK (language IN ('en', 'fr')),
  timezone TEXT DEFAULT 'America/Toronto',
  notification_preferences JSONB DEFAULT '{"email": true, "push": true, "sms": false}',
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_step INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `roles`
```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  level INTEGER NOT NULL DEFAULT 0, -- 0=guest, 10=viewer, 20=member, 30=contributor, 40=manager, 50=admin, 60=owner, 70=system
  is_system BOOLEAN DEFAULT FALSE,
  permissions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `permissions`
```sql
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(resource, action)
);
```

#### `role_permissions`
```sql
CREATE TABLE role_permissions (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);
```

#### `user_roles`
```sql
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  scope_type TEXT DEFAULT 'organization',
  scope_id UUID,
  granted_by UUID REFERENCES profiles(id),
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role_id, organization_id, scope_type, scope_id)
);
```

#### `audit_logs`
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  organization_id UUID REFERENCES organizations(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  changes JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Immutable: no UPDATE/DELETE triggers
```

### 1.2 Content & Learning (003_content_tables.sql)

#### `content_categories`
```sql
CREATE TABLE content_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES content_categories(id),
  icon TEXT,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `courses`
```sql
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id),
  category_id UUID REFERENCES content_categories(id),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  short_description TEXT,
  thumbnail_url TEXT,
  banner_url TEXT,
  level TEXT DEFAULT 'beginner' CHECK (level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  required_tier TEXT DEFAULT 'free' CHECK (required_tier IN ('free', 'professional', 'enterprise')),
  estimated_duration INTEGER, -- minutes
  language TEXT DEFAULT 'en',
  tags TEXT[] DEFAULT '{}',
  learning_objectives TEXT[] DEFAULT '{}',
  prerequisites UUID[] DEFAULT '{}',
  instructor_id UUID REFERENCES profiles(id),
  is_published BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  enrollment_count INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2) DEFAULT 0,
  completion_rate DECIMAL(5,2) DEFAULT 0,
  gamification_points INTEGER DEFAULT 100,
  completion_badge TEXT,
  search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(short_description, '')), 'C')
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- GIN index on search_vector
```

#### `lessons`
```sql
CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  content_type TEXT DEFAULT 'article' CHECK (content_type IN ('video', 'article', 'quiz', 'interactive', 'assignment')),
  sort_order INTEGER DEFAULT 0,
  estimated_duration INTEGER, -- minutes
  is_published BOOLEAN DEFAULT FALSE,
  is_free_preview BOOLEAN DEFAULT FALSE,
  video_url TEXT,
  video_duration INTEGER,
  video_provider TEXT CHECK (video_provider IN ('youtube', 'vimeo', 'mux', 'custom')),
  video_thumbnail_url TEXT,
  article_body TEXT,
  resources JSONB DEFAULT '[]', -- [{title, url, type}]
  gamification_points INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, slug)
);
```

#### `quizzes`
```sql
CREATE TABLE quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  questions JSONB NOT NULL DEFAULT '[]', -- [{question, type, options, correct_answer, explanation, points}]
  passing_score INTEGER DEFAULT 70,
  max_attempts INTEGER DEFAULT 3,
  time_limit INTEGER, -- minutes
  shuffle_questions BOOLEAN DEFAULT FALSE,
  show_correct_answers BOOLEAN DEFAULT TRUE,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `tribunal_cases`
```sql
CREATE TABLE tribunal_cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_number TEXT UNIQUE,
  case_title TEXT NOT NULL,
  tribunal_name TEXT NOT NULL,
  jurisdiction TEXT,
  decision_date DATE,
  parties JSONB DEFAULT '{}', -- {applicant, respondent, intervenors}
  full_text TEXT,
  summary TEXT,
  headnotes TEXT[] DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}',
  legislation_cited JSONB DEFAULT '[]', -- [{name, section, url}]
  cases_cited TEXT[] DEFAULT '{}',
  decision_outcome TEXT,
  language TEXT DEFAULT 'en' CHECK (language IN ('en', 'fr')),
  source_url TEXT,
  pdf_url TEXT,
  ai_classification JSONB DEFAULT '{}',
  ai_summary TEXT,
  ai_key_principles TEXT[] DEFAULT '{}',
  ai_risk_factors JSONB DEFAULT '[]',
  ai_recommended_actions TEXT[] DEFAULT '{}',
  ai_confidence_score DECIMAL(5,4),
  is_published BOOLEAN DEFAULT TRUE,
  view_count INTEGER DEFAULT 0,
  bookmark_count INTEGER DEFAULT 0,
  search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', COALESCE(case_title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(summary, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(full_text, '')), 'C')
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- GIN indexes on search_vector, keywords, headnotes
```

### 1.3 User Engagement & Gamification (004_user_engagement.sql)

#### `enrollments`
```sql
CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'dropped')),
  progress DECIMAL(5,2) DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  certificate_url TEXT,
  certificate_issued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);
```

#### `lesson_progress`
```sql
CREATE TABLE lesson_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  progress DECIMAL(5,2) DEFAULT 0,
  video_position INTEGER DEFAULT 0, -- seconds
  time_spent INTEGER DEFAULT 0, -- seconds
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);
```

#### `quiz_attempts`
```sql
CREATE TABLE quiz_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES enrollments(id),
  answers JSONB NOT NULL DEFAULT '[]',
  score INTEGER DEFAULT 0,
  max_score INTEGER DEFAULT 100,
  passed BOOLEAN DEFAULT FALSE,
  time_taken INTEGER, -- seconds
  attempt_number INTEGER DEFAULT 1,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `achievements`
```sql
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  badge_url TEXT,
  type TEXT NOT NULL CHECK (type IN ('completion', 'streak', 'points', 'special', 'community')),
  criteria JSONB NOT NULL DEFAULT '{}',
  points_value INTEGER DEFAULT 0,
  rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `user_achievements`
```sql
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, achievement_id)
);
```

#### `user_points`
```sql
CREATE TABLE user_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  reference_type TEXT, -- 'course', 'lesson', 'quiz', etc.
  reference_id UUID,
  multiplier DECIMAL(3,2) DEFAULT 1.00,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `learning_streaks`
```sql
CREATE TABLE learning_streaks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  current_streak_days INTEGER DEFAULT 0,
  longest_streak_days INTEGER DEFAULT 0,
  last_activity_date DATE,
  streak_started_at TIMESTAMPTZ,
  streak_frozen_until TIMESTAMPTZ,
  total_active_days INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `bookmarks`
```sql
CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('course', 'lesson', 'case', 'article')),
  resource_id UUID NOT NULL,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, resource_type, resource_id)
);
```

#### `course_reviews`
```sql
CREATE TABLE course_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  content TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  helpful_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'flagged')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);
```

### 1.4 Newsletter & Testimonials (011, 013)

#### `newsletter_subscribers`
```sql
CREATE TABLE newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  subscribed BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `testimonials`
```sql
CREATE TABLE testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT,
  organization TEXT,
  content TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  is_featured BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT TRUE,
  avatar_url TEXT,
  search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(content, '')), 'B')
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.5 AI Training System (015_ai_training_system.sql)

#### `classification_feedback`
```sql
CREATE TABLE classification_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES tribunal_cases(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  organization_id UUID REFERENCES organizations(id),
  ai_classification JSONB NOT NULL,
  manual_classification JSONB NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('correction', 'confirmation', 'enhancement')),
  quality_score DECIMAL(3,2) CHECK (quality_score >= 0 AND quality_score <= 1),
  comments TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'incorporated', 'rejected')),
  training_batch_id UUID,
  incorporated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `training_jobs`
```sql
CREATE TABLE training_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  model_type TEXT NOT NULL CHECK (model_type IN ('classifier', 'summarizer', 'risk_assessor', 'recommendation')),
  provider TEXT NOT NULL DEFAULT 'openai' CHECK (provider IN ('openai', 'anthropic', 'custom')),
  base_model TEXT NOT NULL,
  fine_tuned_model TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'training', 'completed', 'failed', 'cancelled')),
  training_file_id TEXT,
  validation_file_id TEXT,
  hyperparameters JSONB DEFAULT '{}',
  training_data_count INTEGER DEFAULT 0,
  validation_data_count INTEGER DEFAULT 0,
  metrics JSONB DEFAULT '{}',
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_cost DECIMAL(10,2),
  actual_cost DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `automated_training_config`
```sql
CREATE TABLE automated_training_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  model_type TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT FALSE,
  schedule TEXT DEFAULT 'monthly' CHECK (schedule IN ('weekly', 'monthly', 'quarterly', 'on_threshold')),
  min_feedback_threshold INTEGER DEFAULT 100,
  quality_threshold DECIMAL(3,2) DEFAULT 0.80,
  auto_deploy BOOLEAN DEFAULT FALSE,
  max_monthly_cost DECIMAL(10,2) DEFAULT 100.00,
  last_triggered_at TIMESTAMPTZ,
  next_scheduled_at TIMESTAMPTZ,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, model_type)
);
```

### 1.6 Vector Embeddings (20250108000002)

#### `case_embeddings`
```sql
CREATE TABLE case_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES tribunal_cases(id) ON DELETE CASCADE,
  embedding vector(1536) NOT NULL,
  model_version TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  embedding_type TEXT DEFAULT 'full' CHECK (embedding_type IN ('full', 'summary', 'headnotes', 'key_principles')),
  token_count INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- HNSW index: CREATE INDEX ON case_embeddings USING hnsw (embedding vector_cosine_ops)
```

#### `course_embeddings`
```sql
CREATE TABLE course_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  embedding vector(1536) NOT NULL,
  model_version TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  embedding_type TEXT DEFAULT 'full',
  token_count INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `lesson_embeddings`
```sql
CREATE TABLE lesson_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  embedding vector(1536) NOT NULL,
  model_version TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  embedding_type TEXT DEFAULT 'full',
  token_count INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `embedding_jobs`
```sql
CREATE TABLE embedding_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('case', 'course', 'lesson')),
  total_items INTEGER NOT NULL DEFAULT 0,
  processed_items INTEGER NOT NULL DEFAULT 0,
  failed_items INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  model_version TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  error_log JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.7 Risk Scoring (20250129000001)

#### `risk_score_history`
```sql
CREATE TABLE risk_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  risk_score NUMERIC(5,2) NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  active_cases INTEGER DEFAULT 0,
  resolved_cases INTEGER DEFAULT 0,
  training_completion NUMERIC(5,2) DEFAULT 0,
  compliance_score NUMERIC(5,2) DEFAULT 0,
  factors JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `organization_risk_history`
```sql
CREATE TABLE organization_risk_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  overall_risk_level TEXT NOT NULL CHECK (overall_risk_level IN ('low', 'medium', 'high', 'critical')),
  overall_risk_score NUMERIC(5,2) NOT NULL CHECK (overall_risk_score >= 0 AND overall_risk_score <= 100),
  department_count INTEGER DEFAULT 0,
  high_risk_departments INTEGER DEFAULT 0,
  total_active_cases INTEGER DEFAULT 0,
  total_training_completion NUMERIC(5,2) DEFAULT 0,
  trend TEXT CHECK (trend IN ('improving', 'stable', 'declining')),
  factors JSONB DEFAULT '{}',
  recommendations JSONB DEFAULT '[]',
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.8 Evidence Bundles (20250129000002)

#### `evidence_bundles`
```sql
CREATE TABLE evidence_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  bundle_type TEXT NOT NULL CHECK (bundle_type IN ('compliance', 'investigation', 'training', 'audit', 'custom')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived', 'submitted')),
  created_by UUID REFERENCES profiles(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `evidence_bundle_components`
```sql
CREATE TABLE evidence_bundle_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id UUID NOT NULL REFERENCES evidence_bundles(id) ON DELETE CASCADE,
  component_type TEXT NOT NULL CHECK (component_type IN ('case', 'training_record', 'policy', 'document', 'note', 'custom')),
  component_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  content JSONB DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `evidence_bundle_policy_mappings`
```sql
CREATE TABLE evidence_bundle_policy_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id UUID NOT NULL REFERENCES evidence_bundles(id) ON DELETE CASCADE,
  case_id UUID REFERENCES tribunal_cases(id),
  training_id UUID,
  policy_reference TEXT NOT NULL,
  mapping_type TEXT NOT NULL CHECK (mapping_type IN ('preventive', 'corrective', 'monitoring')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `evidence_bundle_timeline`
```sql
CREATE TABLE evidence_bundle_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id UUID NOT NULL REFERENCES evidence_bundles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  actor_id UUID REFERENCES profiles(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.9 Case Alerts & Saved Searches (20250129000003)

#### `saved_searches`
```sql
CREATE TABLE saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  search_criteria JSONB NOT NULL DEFAULT '{}',
  alert_enabled BOOLEAN DEFAULT FALSE,
  alert_frequency TEXT DEFAULT 'daily' CHECK (alert_frequency IN ('immediate', 'daily', 'weekly', 'monthly')),
  last_alert_sent_at TIMESTAMPTZ,
  result_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `case_alerts`
```sql
CREATE TABLE case_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_search_id UUID NOT NULL REFERENCES saved_searches(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES tribunal_cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  alert_type TEXT DEFAULT 'new_match' CHECK (alert_type IN ('new_match', 'update', 'related')),
  relevance_score NUMERIC(5,4),
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  is_dismissed BOOLEAN DEFAULT FALSE,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(saved_search_id, case_id)
);
```

#### `case_digests`
```sql
CREATE TABLE case_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  digest_type TEXT DEFAULT 'weekly' CHECK (digest_type IN ('daily', 'weekly', 'monthly', 'custom')),
  content JSONB NOT NULL DEFAULT '{}',
  case_count INTEGER DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  generated_by TEXT DEFAULT 'system',
  is_published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `alert_preferences`
```sql
CREATE TABLE alert_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email_alerts BOOLEAN DEFAULT TRUE,
  push_alerts BOOLEAN DEFAULT TRUE,
  digest_frequency TEXT DEFAULT 'weekly' CHECK (digest_frequency IN ('daily', 'weekly', 'monthly', 'none')),
  alert_categories TEXT[] DEFAULT '{}',
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);
```

### 1.10 Organization Subscriptions (20250129000004)

#### `organization_subscriptions`
```sql
CREATE TABLE organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'FREE' CHECK (tier IN ('FREE', 'PROFESSIONAL', 'BUSINESS', 'BUSINESS_PLUS', 'ENTERPRISE')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing', 'paused')),
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  stripe_price_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  seat_count INTEGER DEFAULT 1,
  max_seats INTEGER DEFAULT 5,
  billing_email TEXT,
  billing_name TEXT,
  billing_address JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `seat_allocations`
```sql
CREATE TABLE seat_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES organization_subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  allocated_at TIMESTAMPTZ DEFAULT NOW(),
  allocated_by UUID REFERENCES profiles(id),
  is_active BOOLEAN DEFAULT TRUE,
  deactivated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subscription_id, user_id)
);
```

#### `subscription_invoices`
```sql
CREATE TABLE subscription_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES organization_subscriptions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT UNIQUE,
  invoice_number TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  amount_due INTEGER NOT NULL, -- cents
  amount_paid INTEGER DEFAULT 0,
  amount_remaining INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'cad',
  tax_amount INTEGER DEFAULT 0,
  tax_rate DECIMAL(5,2),
  description TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  invoice_pdf_url TEXT,
  hosted_invoice_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.11 ABR Migrations NOT Fully Extracted (Additional Tables)

The following migration files exist but were not fully read. They likely contain additional tables:

| File | Probable Tables |
|------|----------------|
| `019_ai_usage_logging.sql` | AI usage logs |
| `20250115000001_lesson_notes.sql` | lesson_notes |
| `20250115000002_watch_history.sql` | watch_history |
| `20250115000003_quiz_system.sql` | quiz enhancements |
| `20250115000004_certificates.sql` | certificates |
| `20250115000005_ce_credit_tracking.sql` | ce_credits |
| `20250115000006_skills_validation.sql` | skills, skill_validations |
| `20250115000007_course_workflow.sql` | course_versions, approvals |
| `20250115000008_instructor_portal.sql` | instructor tables |
| `20250116000001_enterprise_sso.sql` | sso_providers |
| `20250116000002_advanced_rbac.sql` | RBAC enhancements |
| `20250116000004_ingestion_pipeline.sql` | ingestion pipeline tables |
| `20250116000005_gamification.sql` | gamification enhancements |
| `20250130000001_ai_interaction_logs.sql` | ai_interaction_logs |
| `20260203_ai_usage_tracking.sql` | AI usage tracking |
| `20260203_canlii_ingestion_tracking.sql` | canlii_ingestion |
| `20260203_org_offboarding.sql` | offboarding tables |

---

## 2. UnionEyes — Drizzle ORM Tables

**Source Path**: `legacy-codebases/Union_Eyes_app_v1-main/Union_Eyes_app_v1-main/db/schema/`  
**ORM**: Drizzle ORM (PostgreSQL dialect)  
**Config**: `drizzle.config.ts` → schema: `./db/schema/union-structure-standalone.ts`

### 2.1 Organizations & Hierarchy (schema-organizations.ts)

#### `organizations`
```typescript
// Enums
organizationTypeEnum: ["congress", "federation", "union", "local", "region", "district"]
caJurisdictionEnum: ["federal", "ab", "bc", "mb", "nb", "nl", "ns", "nt", "nu", "on", "pe", "qc", "sk", "yt"]
labourSectorEnum: ["public", "private", "construction", "healthcare", "education", "manufacturing",
                     "transportation", "retail", "hospitality", "mining", "energy", "telecommunications",
                     "agriculture", "technology", "financial", "other"]
organizationStatusEnum: ["active", "inactive", "suspended", "dissolved", "pending"]

// Table: organizations
pgTable("organizations", {
  id: uuid PK defaultRandom,
  clerkOrganizationId: text unique,
  name: varchar(255) NOT NULL,
  slug: varchar(255) unique NOT NULL,
  organizationType: organizationTypeEnum NOT NULL default "local",
  parentId: uuid self-ref FK,
  hierarchyPath: text[] default [],
  hierarchyLevel: integer default 0,
  jurisdictions: caJurisdictionEnum[] default [],
  sectors: labourSectorEnum[] default [],
  clcAffiliateId: text,
  clcAffiliateStatus: varchar(50) default "none",
  registrationNumber: varchar(100),
  certificationNumber: varchar(100),
  foundedDate: date,
  memberCount: integer default 0,
  activeMemberCount: integer default 0,
  description: text,
  mission: text,
  logoUrl: text,
  websiteUrl: text,
  contactEmail: varchar(255),
  contactPhone: varchar(50),
  address: jsonb default {},
  timezone: varchar(50) default "America/Toronto",
  defaultLocale: varchar(10) default "en",
  settings: jsonb default {},
  features: jsonb default {},
  billingEmail: varchar(255),
  stripeCustomerId: varchar(255),
  subscriptionTier: varchar(50) default "free",
  subscriptionStatus: varchar(50) default "active",
  status: organizationStatusEnum default "active",
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow,
  createdBy: varchar(255),
  updatedBy: varchar(255)
})
```

#### `organizationRelationships`
```typescript
organizationRelationshipTypeEnum: ["affiliate", "federation", "local", "chapter", "merged_from",
                                     "merged_into", "absorbed_by", "spun_off_from", "partner", "other"]

pgTable("organization_relationships", {
  id: uuid PK defaultRandom,
  parentOrganizationId: uuid FK → organizations.id CASCADE,
  childOrganizationId: uuid FK → organizations.id CASCADE,
  relationshipType: organizationRelationshipTypeEnum NOT NULL,
  effectiveDate: date,
  endDate: date,
  notes: text,
  metadata: jsonb default {},
  isActive: boolean default true,
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow
})
```

#### `organizationMembers`
```typescript
pgTable("organization_members", {
  id: uuid PK defaultRandom,
  organizationId: uuid FK → organizations.id CASCADE,
  userId: text NOT NULL,
  role: varchar(50) NOT NULL default "member",
  status: varchar(50) default "active",
  department: varchar(255),
  position: varchar(255),
  seniority: integer default 0,
  membershipNumber: varchar(100),
  membershipType: varchar(50) default "full",
  joinedAt: timestamp withTimezone defaultNow,
  leftAt: timestamp withTimezone,
  metadata: jsonb default {},
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow
})
```

### 2.2 Profiles (domains/member/profiles.ts)

#### `profiles` (aliased as `profilesTable`)
```typescript
membershipEnum: ["free", "pro"]
paymentProviderEnum: ["stripe", "whop"]

pgTable("profiles", {
  userId: text PK NOT NULL,
  email: text,
  membership: membershipEnum NOT NULL default "free",
  paymentProvider: paymentProviderEnum default "whop",
  stripeCustomerId: text,
  stripeSubscriptionId: text,
  whopUserId: text,
  whopMembershipId: text,
  planDuration: text, // "monthly" or "yearly"
  billingCycleStart: timestamp,
  billingCycleEnd: timestamp,
  nextCreditRenewal: timestamp,
  usageCredits: integer default 0,
  usedCredits: integer default 0,
  status: text default "active",
  createdAt: timestamp defaultNow NOT NULL,
  updatedAt: timestamp defaultNow NOT NULL .$onUpdate
})
// RLS: Users read own profile only. Block client writes. Service role bypass.
```

### 2.3 User Management (domains/member/user-management.ts)

**Schema**: `user_management` (separate PostgreSQL schema)

#### `users` (user_management.users)
```typescript
userManagementSchema.table("users", {
  userId: varchar(255) PK,
  email: varchar(255) NOT NULL unique,
  emailVerified: boolean default false,
  emailVerifiedAt: timestamp withTimezone,
  passwordHash: text,
  firstName: varchar(100),
  lastName: varchar(100),
  displayName: varchar(200),
  avatarUrl: text,
  phone: varchar(20),
  phoneVerified: boolean default false,
  phoneVerifiedAt: timestamp withTimezone,
  timezone: varchar(50) default "UTC",
  locale: varchar(10) default "en-US",
  isActive: boolean default true,
  isSystemAdmin: boolean default false,
  lastLoginAt: timestamp withTimezone,
  lastLoginIp: varchar(45),
  passwordChangedAt: timestamp withTimezone,
  failedLoginAttempts: integer default 0,
  accountLockedUntil: timestamp withTimezone,
  twoFactorEnabled: boolean default false,
  twoFactorSecret: text,
  twoFactorBackupCodes: text[],
  encryptedSin: text, // Social Insurance Number (Canada)
  encryptedSsn: text, // Social Security Number (USA)
  encryptedBankAccount: text,
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow
})
// CHECK: email regex, phone E.164 format
```

#### `organizationUsers` (user_management.organization_users)
```typescript
userManagementSchema.table("organization_users", {
  organizationUserId: uuid PK defaultRandom,
  organizationId: uuid FK → organizations.id CASCADE,
  userId: varchar(255) NOT NULL,
  role: varchar(50) NOT NULL default "member",
  permissions: jsonb default [],
  isActive: boolean default true,
  isPrimary: boolean default false,
  invitedBy: varchar(255) FK → users.userId,
  invitedAt: timestamp withTimezone,
  joinedAt: timestamp withTimezone,
  lastAccessAt: timestamp withTimezone,
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow
})
```

#### `userSessions` (user_management.user_sessions)
```typescript
userManagementSchema.table("user_sessions", {
  sessionId: uuid PK defaultRandom,
  userId: varchar(255) FK → users.userId CASCADE,
  organizationId: uuid FK → organizations.id CASCADE,
  sessionToken: text NOT NULL unique,
  refreshToken: text unique,
  deviceInfo: jsonb default {},
  ipAddress: varchar(45),
  userAgent: text,
  expiresAt: timestamp withTimezone NOT NULL,
  isActive: boolean default true,
  createdAt: timestamp withTimezone defaultNow,
  lastUsedAt: timestamp withTimezone defaultNow
})
```

#### `oauthProviders` (user_management.oauth_providers)
```typescript
userManagementSchema.table("oauth_providers", {
  providerId: uuid PK defaultRandom,
  userId: varchar(255) FK → users.userId CASCADE,
  providerName: varchar(50) NOT NULL,
  providerUserId: varchar(255) NOT NULL,
  providerData: jsonb default {},
  accessToken: text,
  refreshToken: text,
  tokenExpiresAt: timestamp withTimezone,
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow
})
```

### 2.4 Member Employment (domains/member/member-employment.ts)

#### `memberEmployment`
```typescript
employmentStatusEnum: ["active", "on_leave", "layoff", "suspended", "terminated", "retired", "deceased"]
employmentTypeEnum: ["full_time", "part_time", "casual", "seasonal", "temporary", "contract", "probationary"]
payFrequencyEnum: ["hourly", "weekly", "bi_weekly", "semi_monthly", "monthly", "annual", "per_diem"]
shiftTypeEnum: ["day", "evening", "night", "rotating", "split", "on_call"]

pgTable("member_employment", {
  id: uuid PK defaultRandom,
  organizationId: uuid FK → organizations.id NOT NULL,
  memberId: uuid FK → organizationMembers.id NOT NULL,
  employerId: uuid FK → employers.id,
  worksiteId: uuid FK → worksites.id,
  bargainingUnitId: uuid FK → bargainingUnits.id,
  employmentStatus: employmentStatusEnum NOT NULL default "active",
  employmentType: employmentTypeEnum NOT NULL default "full_time",
  hireDate: date NOT NULL,
  seniorityDate: date NOT NULL,
  terminationDate: date,
  expectedReturnDate: date,
  seniorityYears: numeric(10,2),
  adjustedSeniorityDate: date,
  seniorityAdjustmentReason: text,
  jobTitle: varchar(255) NOT NULL,
  jobCode: varchar(100),
  jobClassification: varchar(255),
  jobLevel: integer,
  department: varchar(255),
  division: varchar(255),
  payFrequency: payFrequencyEnum NOT NULL default "hourly",
  hourlyRate: numeric(10,2),
  baseSalary: numeric(12,2),
  grossWages: numeric(12,2),
  regularHoursPerWeek: numeric(5,2) default "40.00",
  regularHoursPerPeriod: numeric(7,2),
  shiftType: shiftTypeEnum,
  shiftStartTime: varchar(10),
  shiftEndTime: varchar(10),
  operatesWeekends: boolean default false,
  operates24Hours: boolean default false,
  supervisorName: varchar(255),
  supervisorId: uuid,
  isProbationary: boolean default false,
  probationEndDate: date,
  checkoffAuthorized: boolean default true,
  checkoffDate: date,
  randExempt: boolean default false,
  customFields: jsonb,
  notes: text,
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow,
  createdBy: varchar(255),
  updatedBy: varchar(255)
})
```

#### `employmentHistory`
```typescript
pgTable("employment_history", {
  id: uuid PK defaultRandom,
  organizationId: uuid FK → organizations.id NOT NULL,
  memberId: uuid FK → organizationMembers.id NOT NULL,
  memberEmploymentId: uuid FK → memberEmployment.id,
  changeType: varchar(100) NOT NULL, // hire, promotion, transfer, leave, termination, wage_change
  effectiveDate: date NOT NULL,
  previousValues: jsonb,
  newValues: jsonb,
  reason: text,
  notes: text,
  createdAt: timestamp withTimezone defaultNow,
  createdBy: varchar(255)
})
```

#### `memberLeaves`
```typescript
leaveTypeEnum: ["vacation", "sick", "maternity", "paternity", "parental", "bereavement",
                 "medical", "disability", "union_business", "unpaid", "lwop", "other"]

pgTable("member_leaves", {
  id: uuid PK defaultRandom,
  organizationId: uuid FK → organizations.id NOT NULL,
  memberId: uuid FK → organizationMembers.id NOT NULL,
  memberEmploymentId: uuid FK → memberEmployment.id,
  leaveType: leaveTypeEnum NOT NULL,
  startDate: date NOT NULL,
  endDate: date,
  expectedReturnDate: date,
  actualReturnDate: date,
  isApproved: boolean default false,
  approvedBy: varchar(255),
  approvedAt: timestamp withTimezone,
  affectsSeniority: boolean default false,
  seniorityAdjustmentDays: integer,
  affectsDues: boolean default true,
  duesWaiverApproved: boolean default false,
  reason: text,
  notes: text,
  documents: jsonb,
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow,
  createdBy: varchar(255)
})
```

#### `jobClassifications`
```typescript
pgTable("job_classifications", {
  id: uuid PK defaultRandom,
  organizationId: uuid FK → organizations.id NOT NULL,
  bargainingUnitId: uuid FK → bargainingUnits.id,
  jobCode: varchar(100) NOT NULL,
  jobTitle: varchar(255) NOT NULL,
  jobFamily: varchar(255),
  jobLevel: integer,
  minimumRate: numeric(10,2),
  maximumRate: numeric(10,2),
  standardRate: numeric(10,2),
  description: text,
  requirements: jsonb,
  isActive: boolean default true,
  effectiveDate: date,
  expiryDate: date,
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow,
  createdBy: varchar(255)
})
```

### 2.5 Member Addresses (domains/member/addresses.ts)

#### `memberAddresses`
```typescript
pgTable("member_addresses", {
  id: uuid PK defaultRandom,
  userId: varchar(255) NOT NULL,
  organizationId: uuid FK → organizations.id CASCADE NOT NULL,
  addressType: varchar(20) NOT NULL default "mailing",
  streetAddress: text NOT NULL,
  city: varchar(100) NOT NULL,
  province: varchar(2) NOT NULL,
  postalCode: varchar(10) NOT NULL,
  country: varchar(2) NOT NULL default "CA",
  isPrimary: boolean default false,
  effectiveDate: timestamp withTimezone,
  createdAt: timestamp withTimezone defaultNow NOT NULL,
  updatedAt: timestamp withTimezone defaultNow NOT NULL
})
```

### 2.6 Member Segments (domains/member/member-segments.ts)

#### `memberSegments`
```typescript
pgTable("member_segments", {
  id: uuid PK defaultRandom,
  organizationId: uuid NOT NULL,
  name: text NOT NULL,
  description: text,
  filters: jsonb NOT NULL, // MemberSegmentFilters type
  createdBy: text NOT NULL,
  createdAt: timestamp defaultNow NOT NULL,
  updatedAt: timestamp defaultNow NOT NULL,
  lastExecutedAt: timestamp,
  executionCount: integer default 0 NOT NULL,
  isActive: boolean default true NOT NULL,
  isPublic: boolean default false NOT NULL
})
```

#### `segmentExecutions`
```typescript
pgTable("segment_executions", {
  id: uuid PK defaultRandom,
  segmentId: uuid FK → memberSegments.id CASCADE NOT NULL,
  executedBy: text NOT NULL,
  executedAt: timestamp defaultNow NOT NULL,
  resultCount: integer NOT NULL,
  executionTimeMs: integer,
  filtersSnapshot: jsonb
})
```

#### `segmentExports`
```typescript
pgTable("segment_exports", {
  id: uuid PK defaultRandom,
  organizationId: uuid NOT NULL,
  segmentId: uuid FK → memberSegments.id SET NULL,
  exportedBy: text NOT NULL,
  exportedAt: timestamp defaultNow NOT NULL,
  format: text NOT NULL, // csv, excel, pdf
  includeFields: jsonb,
  memberCount: integer NOT NULL,
  filtersUsed: jsonb,
  watermark: text,
  exportHash: text,
  purpose: text,
  approvedBy: text,
  fileUrl: text,
  fileSize: integer,
  dataRetentionDays: integer default 90,
  deletedAt: timestamp
})
```

### 2.7 Union Structure (union-structure-schema.ts)

#### `employers`
```typescript
employerTypeEnum: ["private", "public", "non_profit", "crown_corp", "municipal", "provincial",
                    "federal", "indigenous", "cooperative"]
employerStatusEnum: ["active", "inactive", "dissolved", "bankrupt", "acquired", "merged"]

pgTable("employers", {
  id: uuid PK defaultRandom,
  organizationId: uuid FK → organizations.id CASCADE NOT NULL,
  name: varchar(255) NOT NULL,
  legalName: varchar(255),
  employerType: employerTypeEnum NOT NULL default "private",
  status: employerStatusEnum default "active",
  federalBusinessNumber: varchar(15),
  provincialBusinessNumber: varchar(20),
  industry: varchar(100),
  naicsCode: varchar(10),
  mainContactName: varchar(255),
  mainContactEmail: varchar(255),
  mainContactPhone: varchar(50),
  hrContactName: varchar(255),
  hrContactEmail: varchar(255),
  hrContactPhone: varchar(50),
  lrContactName: varchar(255),
  lrContactEmail: varchar(255),
  lrContactPhone: varchar(50),
  address: jsonb default {},
  websiteUrl: text,
  notes: text,
  metadata: jsonb default {},
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow,
  createdBy: varchar(255)
})
```

#### `worksites`
```typescript
worksiteStatusEnum: ["active", "inactive", "closed", "seasonal", "under_construction"]

pgTable("worksites", {
  id: uuid PK defaultRandom,
  organizationId: uuid FK → organizations.id CASCADE NOT NULL,
  employerId: uuid FK → employers.id CASCADE NOT NULL,
  name: varchar(255) NOT NULL,
  siteCode: varchar(50),
  status: worksiteStatusEnum default "active",
  address: jsonb default {},  // { street, city, province, postalCode, country, lat, lng }
  contactName: varchar(255),
  contactEmail: varchar(255),
  contactPhone: varchar(50),
  employeeCount: integer default 0,
  unionizedCount: integer default 0,
  shiftCount: integer default 1,
  is24Hour: boolean default false,
  operatesWeekends: boolean default false,
  hazardLevel: varchar(20),
  notes: text,
  metadata: jsonb default {},
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow,
  createdBy: varchar(255)
})
```

#### `bargainingUnits`
```typescript
unitTypeEnum: ["certified", "voluntary", "wall_to_wall", "craft", "industrial", "professional", "composite"]
unitStatusEnum: ["active", "decertified", "pending", "suspended", "merged", "disbanded"]

pgTable("bargaining_units", {
  id: uuid PK defaultRandom,
  organizationId: uuid FK → organizations.id CASCADE NOT NULL,
  employerId: uuid FK → employers.id CASCADE NOT NULL,
  name: varchar(255) NOT NULL,
  unitNumber: varchar(100),
  unitType: unitTypeEnum default "certified",
  status: unitStatusEnum default "active",
  certificationDate: date,
  certificationNumber: varchar(100),
  certificationBoard: varchar(255),
  jurisdiction: caJurisdictionEnum,
  currentCbaId: uuid,
  contractExpiryDate: date,
  memberCount: integer default 0,
  classifications: jsonb default [],
  scopeDescription: text,
  exclusions: text,
  notes: text,
  metadata: jsonb default {},
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow,
  createdBy: varchar(255)
})
```

#### `committees`
```typescript
committeeTypeEnum: ["executive", "bargaining", "grievance", "health_safety", "education",
                     "communications", "finance", "women", "human_rights", "environment",
                     "young_workers", "political_action", "organizing", "ad_hoc"]
committeeMemberRoleEnum: ["chair", "co_chair", "vice_chair", "secretary", "treasurer",
                           "member", "alternate", "advisor"]

pgTable("committees", {
  id: uuid PK defaultRandom,
  organizationId: uuid FK → organizations.id CASCADE NOT NULL,
  name: varchar(255) NOT NULL,
  committeeType: committeeTypeEnum NOT NULL,
  description: text,
  mandate: text,
  isActive: boolean default true,
  meetingFrequency: varchar(100),
  meetingDay: varchar(20),
  meetingTime: varchar(10),
  meetingLocation: text,
  maxMembers: integer,
  minMembers: integer,
  requiresQuorum: boolean default true,
  quorumPercentage: integer default 50,
  composition: jsonb default {},
  notes: text,
  metadata: jsonb default {},
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow,
  createdBy: varchar(255)
})
```

#### `committeeMemberships`
```typescript
pgTable("committee_memberships", {
  id: uuid PK defaultRandom,
  committeeId: uuid FK → committees.id CASCADE NOT NULL,
  memberId: uuid FK → organizationMembers.id CASCADE NOT NULL,
  role: committeeMemberRoleEnum default "member",
  startDate: date NOT NULL,
  endDate: date,
  isActive: boolean default true,
  appointedBy: varchar(255),
  notes: text,
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow
})
```

### 2.8 Grievances (grievance-schema.ts)

#### `grievances`
```typescript
grievanceTypeEnum: ["individual", "group", "policy", "unjust_dismissal", "discipline",
                     "discrimination", "harassment", "health_safety", "seniority",
                     "wages_benefits", "other"]
grievanceStatusEnum: ["draft", "filed", "step_1", "step_2", "step_3", "mediation",
                       "arbitration", "settled", "withdrawn", "denied", "won", "lost", "closed"]
grievancePriorityEnum: ["low", "medium", "high", "urgent", "critical"]
grievanceStepEnum: ["informal", "step_1", "step_2", "step_3", "mediation", "arbitration"]

pgTable("grievances", {
  id: uuid PK defaultRandom,
  organizationId: uuid FK → organizations.id CASCADE NOT NULL,
  grievanceNumber: varchar(100) NOT NULL,
  grievanceType: grievanceTypeEnum NOT NULL,
  status: grievanceStatusEnum default "draft",
  priority: grievancePriorityEnum default "medium",
  currentStep: grievanceStepEnum default "informal",
  title: varchar(500) NOT NULL,
  description: text NOT NULL,
  grievantId: uuid FK → organizationMembers.id,
  bargainingUnitId: uuid FK → bargainingUnits.id,
  employerId: uuid FK → employers.id,
  worksiteId: uuid FK → worksites.id,
  stewardId: uuid FK → organizationMembers.id,
  assignedRepId: uuid FK → organizationMembers.id,
  cbaArticle: varchar(100),
  cbaSection: varchar(100),
  violationDate: date,
  filingDate: date,
  reliefSought: text,
  employerPosition: text,
  unionPosition: text,
  timeline: jsonb default [], // [{date, event, notes, actor}]
  documents: jsonb default [], // [{name, url, type, uploadedAt}]
  isConfidential: boolean default false,
  isGroupGrievance: boolean default false,
  groupMemberIds: uuid[] default [],
  notes: text,
  metadata: jsonb default {},
  resolvedAt: timestamp withTimezone,
  closedAt: timestamp withTimezone,
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow,
  createdBy: varchar(255),
  updatedBy: varchar(255)
})
```

#### `grievanceResponses`
```typescript
pgTable("grievance_responses", {
  id: uuid PK defaultRandom,
  grievanceId: uuid FK → grievances.id CASCADE NOT NULL,
  respondedBy: varchar(255) NOT NULL,
  respondedAt: timestamp withTimezone defaultNow,
  responseType: varchar(100) NOT NULL, // employer_response, union_reply, mediation_outcome
  step: grievanceStepEnum,
  content: text NOT NULL,
  decision: varchar(100), // granted, denied, partial, deferred
  conditions: text,
  nextStepDeadline: date,
  documents: jsonb default [],
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow
})
```

#### `arbitrations`
```typescript
arbitrationStatusEnum: ["requested", "scheduled", "in_progress", "adjourned", "reserved",
                          "awarded", "dismissed", "settled", "withdrawn"]

pgTable("arbitrations", {
  id: uuid PK defaultRandom,
  grievanceId: uuid FK → grievances.id CASCADE NOT NULL,
  organizationId: uuid FK → organizations.id CASCADE NOT NULL,
  arbitratorName: varchar(255),
  arbitratorContact: jsonb default {},
  panelMembers: jsonb default [],
  status: arbitrationStatusEnum default "requested",
  requestDate: date,
  scheduledDate: timestamp withTimezone,
  hearingDates: jsonb default [],
  location: text,
  isVirtual: boolean default false,
  virtualLink: text,
  unionSubmissions: jsonb default [],
  employerSubmissions: jsonb default [],
  exhibits: jsonb default [],
  unionCosts: numeric(10,2) default "0.00",
  employerCosts: numeric(10,2) default "0.00",
  sharedCosts: numeric(10,2) default "0.00",
  awardDate: date,
  awardSummary: text,
  awardFullText: text,
  awardOutcome: varchar(100),
  precedentValue: text,
  notes: text,
  metadata: jsonb default {},
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow,
  createdBy: varchar(255)
})
```

#### `settlements`
```typescript
settlementTypeEnum: ["monetary", "non_monetary", "mixed", "return_to_work",
                      "policy_change", "other"]

pgTable("settlements", {
  id: uuid PK defaultRandom,
  grievanceId: uuid FK → grievances.id CASCADE NOT NULL,
  organizationId: uuid FK → organizations.id CASCADE NOT NULL,
  settlementType: settlementTypeEnum NOT NULL,
  status: varchar(100) default "proposed",
  monetaryAmount: numeric(10,2),
  terms: text NOT NULL,
  conditions: text,
  deadline: date,
  signedByUnion: boolean default false,
  signedByEmployer: boolean default false,
  unionSignDate: timestamp withTimezone,
  employerSignDate: timestamp withTimezone,
  complianceDeadline: date,
  isCompliant: boolean,
  complianceNotes: text,
  documents: jsonb default [],
  notes: text,
  metadata: jsonb default {},
  executedAt: timestamp withTimezone,
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow,
  createdBy: varchar(255)
})
```

### 2.9 Claims (claims-schema.ts)

#### `claims`
```typescript
claimStatusEnum: ["submitted", "in_review", "assigned", "investigating", "escalated",
                   "resolved", "closed", "reopened", "archived"]
claimPriorityEnum: ["low", "medium", "high", "critical"]
claimTypeEnum: ["grievance_discipline", "grievance_termination", "grievance_suspension",
                 "grievance_demotion", "grievance_policy_violation", "grievance_seniority",
                 "harassment_workplace", "harassment_sexual", "harassment_racial",
                 "harassment_cyber", "discrimination_gender", "discrimination_race",
                 "discrimination_disability", "discrimination_age", "discrimination_religion",
                 "health_safety", "wage_dispute", "other"]

pgTable("claims", {
  id: uuid PK defaultRandom,
  claimNumber: varchar(50) unique NOT NULL,
  organizationId: uuid NOT NULL,
  memberId: varchar(255) NOT NULL,
  claimType: claimTypeEnum NOT NULL,
  status: claimStatusEnum default "submitted",
  priority: claimPriorityEnum default "medium",
  title: varchar(500) NOT NULL,
  description: text NOT NULL,
  assignedTo: varchar(255),
  respondentName: varchar(255),
  respondentPosition: varchar(255),
  incidentDate: timestamp withTimezone,
  filingDate: timestamp withTimezone defaultNow,
  resolutionDate: timestamp withTimezone,
  aiScore: integer, // AI analysis score
  meritConfidence: integer, // AI confidence in merit
  precedentMatch: integer, // AI precedent match %
  complexityScore: integer, // AI complexity assessment
  estimatedCost: numeric(10,2),
  actualCost: numeric(10,2),
  voiceTranscription: text,
  externalCaseNumber: varchar(100),
  metadata: jsonb default {},
  tags: text[] default [],
  isConfidential: boolean default false,
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow
})
```

#### `claimUpdates`
```typescript
visibilityScopeEnum: ["member", "staff", "admin", "system"]

pgTable("claim_updates", {
  id: uuid PK defaultRandom,
  claimId: uuid FK → claims.id CASCADE NOT NULL,
  userId: varchar(255) NOT NULL,
  updateType: varchar(100) NOT NULL,
  title: varchar(255),
  content: text NOT NULL,
  previousStatus: claimStatusEnum,
  newStatus: claimStatusEnum,
  visibilityScope: visibilityScopeEnum default "staff",
  attachments: jsonb default [],
  metadata: jsonb default {},
  createdAt: timestamp withTimezone defaultNow
})
```

### 2.10 Collective Agreements (collective-agreements-schema.ts)

#### `collectiveAgreements`
```typescript
jurisdictionEnum: ["federal", "ab", "bc", "mb", "nb", "nl", "ns", "nt", "nu", "on", "pe", "qc", "sk", "yt"]
cbaLanguageEnum: ["en", "fr", "both"]
cbaStatusEnum: ["draft", "negotiating", "ratified", "active", "expired", "renewed", "superseded"]

pgTable("collective_agreements", {
  id: uuid PK defaultRandom,
  cbaNumber: varchar(100) unique NOT NULL,
  organizationId: uuid FK → organizations.id CASCADE NOT NULL,
  bargainingUnitId: uuid FK → bargainingUnits.id,
  employerId: uuid FK → employers.id,
  title: varchar(500) NOT NULL,
  jurisdiction: jurisdictionEnum NOT NULL,
  unionParty: varchar(255) NOT NULL,
  employerParty: varchar(255) NOT NULL,
  effectiveDate: date NOT NULL,
  expiryDate: date NOT NULL,
  signedDate: date,
  ratificationDate: date,
  ratificationVotePercent: numeric(5,2),
  language: cbaLanguageEnum default "en",
  status: cbaStatusEnum default "draft",
  documentUrl: text,
  documentHash: varchar(64),
  pageCount: integer,
  structuredData: jsonb default {}, // { tableOfContents, articles[], schedules[], wageGrid }
  tags: text[] default [],
  aiEmbeddingId: varchar(255),
  aiSummary: text,
  previousCbaId: uuid self-ref,
  notes: text,
  metadata: jsonb default {},
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow,
  createdBy: varchar(255),
  updatedBy: varchar(255)
})
```

#### `cbaVersionHistory`
```typescript
pgTable("cba_version_history", {
  id: uuid PK defaultRandom,
  cbaId: uuid FK → collectiveAgreements.id CASCADE NOT NULL,
  versionNumber: integer NOT NULL,
  changeType: varchar(100) NOT NULL, // amendment, renewal, correction, addendum
  changeDescription: text,
  effectiveDate: date,
  changedFields: jsonb default {},
  previousValues: jsonb default {},
  documentUrl: text,
  createdAt: timestamp withTimezone defaultNow,
  createdBy: varchar(255)
})
```

#### `cbaContacts`
```typescript
pgTable("cba_contacts", {
  id: uuid PK defaultRandom,
  cbaId: uuid FK → collectiveAgreements.id CASCADE NOT NULL,
  name: varchar(255) NOT NULL,
  role: varchar(100) NOT NULL, // union_negotiator, employer_negotiator, mediator, arbitrator, legal
  organization: varchar(255),
  email: varchar(255),
  phone: varchar(50),
  isPrimary: boolean default false,
  notes: text,
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow
})
```

### 2.11 Dues & Finance (dues-finance-schema.ts)

#### `duesRates`
```typescript
pgTable("dues_rates", {
  id: uuid PK defaultRandom,
  organizationId: uuid FK → organizations.id CASCADE NOT NULL,
  name: varchar(255) NOT NULL,
  description: text,
  rateType: varchar(50) NOT NULL, // fixed, percentage, hybrid
  fixedAmount: numeric(10,2),
  percentageRate: numeric(5,4),
  minimumAmount: numeric(10,2),
  maximumAmount: numeric(10,2),
  effectiveDate: date NOT NULL,
  expiryDate: date,
  employmentTypes: text[] default [], // which employment types this applies to
  isActive: boolean default true,
  priority: integer default 0,
  notes: text,
  metadata: jsonb default {},
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow,
  createdBy: varchar(255)
})
```

#### `memberDuesLedger`
```typescript
pgTable("member_dues_ledger", {
  id: uuid PK defaultRandom,
  organizationId: uuid FK → organizations.id CASCADE NOT NULL,
  memberId: uuid FK → organizationMembers.id NOT NULL,
  entryType: varchar(50) NOT NULL, // debit, credit
  amount: numeric(10,2) NOT NULL,
  referenceType: varchar(100), // dues_charge, payment, adjustment, waiver
  referenceId: uuid,
  periodStart: date,
  periodEnd: date,
  description: text,
  paymentMethod: varchar(50),
  balance: numeric(10,2), // running balance
  isReversed: boolean default false,
  reversedBy: uuid, // FK to another ledger entry
  reversalReason: text,
  metadata: jsonb default {},
  createdAt: timestamp withTimezone defaultNow,
  createdBy: varchar(255)
})
-- IMMUTABLE: No updates allowed
```

#### `memberArrears`
```typescript
pgTable("member_arrears", {
  id: uuid PK defaultRandom,
  organizationId: uuid FK → organizations.id CASCADE NOT NULL,
  memberId: uuid FK → organizationMembers.id NOT NULL,
  totalOwed: numeric(10,2) NOT NULL default "0.00",
  currentAmount: numeric(10,2) default "0.00",
  days30: numeric(10,2) default "0.00",
  days60: numeric(10,2) default "0.00",
  days90Plus: numeric(10,2) default "0.00",
  lastPaymentDate: date,
  lastPaymentAmount: numeric(10,2),
  gracePeriodEnd: date,
  isOnPaymentPlan: boolean default false,
  paymentPlanAmount: numeric(10,2),
  paymentPlanFrequency: varchar(50),
  status: varchar(50) default "current", // current, arrears, collections, suspended, waived
  notes: text,
  metadata: jsonb default {},
  lastCalculatedAt: timestamp withTimezone defaultNow,
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow
})
```

#### `employerRemittances`
```typescript
pgTable("employer_remittances", {
  id: uuid PK defaultRandom,
  organizationId: uuid FK → organizations.id CASCADE NOT NULL,
  employerId: uuid FK → employers.id NOT NULL,
  remittanceNumber: varchar(100) NOT NULL,
  periodStart: date NOT NULL,
  periodEnd: date NOT NULL,
  submittedDate: date,
  totalAmount: numeric(12,2) NOT NULL,
  memberCount: integer NOT NULL,
  status: varchar(50) default "received", // received, processing, reconciled, exception, completed
  fileUrl: text,
  fileFormat: varchar(50), // csv, excel, pdf, edi
  matchedCount: integer default 0,
  unmatchedCount: integer default 0,
  exceptionCount: integer default 0,
  reconciledAt: timestamp withTimezone,
  reconciledBy: varchar(255),
  notes: text,
  metadata: jsonb default {},
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow,
  createdBy: varchar(255)
})
```

#### `remittanceLineItems`
```typescript
pgTable("remittance_line_items", {
  id: uuid PK defaultRandom,
  remittanceId: uuid FK → employerRemittances.id CASCADE NOT NULL,
  employeeNumber: varchar(100),
  employeeName: varchar(255),
  grossEarnings: numeric(10,2),
  hoursWorked: numeric(7,2),
  duesAmount: numeric(10,2) NOT NULL,
  matchedMemberId: uuid FK → organizationMembers.id,
  matchConfidence: numeric(3,2), // 0.00-1.00
  matchMethod: varchar(50), // exact, fuzzy, manual
  isException: boolean default false,
  exceptionReason: text,
  notes: text,
  createdAt: timestamp withTimezone defaultNow
})
```

#### `remittanceExceptions`
```typescript
pgTable("remittance_exceptions", {
  id: uuid PK defaultRandom,
  remittanceId: uuid FK → employerRemittances.id CASCADE NOT NULL,
  lineItemId: uuid FK → remittanceLineItems.id,
  exceptionType: varchar(100) NOT NULL, // unmatched, amount_mismatch, missing_member, duplicate
  description: text NOT NULL,
  status: varchar(50) default "open", // open, resolved, ignored
  resolvedBy: varchar(255),
  resolvedAt: timestamp withTimezone,
  resolution: text,
  metadata: jsonb default {},
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow
})
```

### 2.12 Finance Domain (domains/finance/)

#### `duesTransactions` (domains/finance/dues.ts)
```typescript
transactionStatusEnum: ["pending", "paid", "partial", "overdue", "waived", "refunded", "cancelled"]
transactionTypeEnum: ["charge", "payment", "adjustment", "refund", "waiver", "late_fee"]
paymentProcessorEnum: ["stripe", "whop", "paypal", "square", "manual"]

pgTable("dues_transactions", {
  id: uuid PK defaultRandom,
  organizationId: uuid NOT NULL,
  memberId: uuid NOT NULL,
  assignmentId: uuid,
  ruleId: uuid,
  transactionType: varchar(50) NOT NULL,
  amount: numeric(10,2) NOT NULL,
  periodStart: date NOT NULL,
  periodEnd: date NOT NULL,
  dueDate: date NOT NULL,
  status: varchar(50) NOT NULL default "pending",
  paymentDate: timestamp withTimezone,
  paymentMethod: varchar(50),
  paymentReference: varchar(255),
  processorType: paymentProcessorEnum,
  processorPaymentId: varchar(255),
  processorCustomerId: varchar(255),
  notes: text,
  metadata: jsonb default {},
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow,
  duesAmount: numeric(10,2) NOT NULL,
  copeAmount: numeric(10,2) default "0.00",
  pacAmount: numeric(10,2) default "0.00",
  strikeFundAmount: numeric(10,2) default "0.00",
  lateFeeAmount: numeric(10,2) default "0.00",
  adjustmentAmount: numeric(10,2) default "0.00",
  totalAmount: numeric(10,2) NOT NULL,
  paidDate: timestamp withTimezone,
  receiptUrl: text
})
```

#### `payments` (domains/finance/payments.ts)
```typescript
paymentStatusEnum: ["pending", "processing", "completed", "failed", "refunded", "disputed", "unmatched", "cancelled"]
paymentMethodEnum: ["stripe", "bank_transfer", "check", "cash", "direct_debit", "payroll_deduction", "ewallet"]
paymentTypeEnum: ["dues", "strike_fund", "subscription", "stipend", "honorarium", "rebate", "other"]
reconciliationStatusEnum: ["unreconciled", "pending_review", "reconciled", "orphaned", "disputed"]

pgTable("payments", {
  id: uuid PK defaultRandom,
  organizationId: uuid FK → organizations.id CASCADE NOT NULL,
  memberId: varchar(255) FK → profiles.userId SET NULL,
  amount: decimal(19,2) NOT NULL,
  currency: varchar(3) default "CAD",
  type: paymentTypeEnum NOT NULL,
  status: paymentStatusEnum NOT NULL default "pending",
  method: paymentMethodEnum NOT NULL,
  stripePaymentIntentId: varchar,
  stripePriceId: varchar,
  stripeInvoiceId: varchar,
  bankDepositId: varchar,
  checkNumber: varchar,
  referenceNumber: varchar,
  processorType: paymentProcessorEnum,
  processorCustomerId: varchar(255),
  paymentCycleId: uuid FK → paymentCycles.id,
  dueDate: timestamp,
  paidDate: timestamp,
  reconciliationStatus: reconciliationStatusEnum default "unreconciled",
  reconciliationDate: timestamp,
  notes: text,
  failureReason: text,
  createdAt: timestamp defaultNow NOT NULL,
  updatedAt: timestamp defaultNow NOT NULL,
  createdBy: varchar(255),
  updatedBy: varchar(255)
})
```

#### `paymentCycles` (domains/finance/payments.ts)
```typescript
pgTable("payment_cycles", {
  id: uuid PK defaultRandom,
  organizationId: uuid FK → organizations.id CASCADE NOT NULL,
  name: varchar(100) NOT NULL,
  description: text,
  cycleType: varchar(50),
  startDate: timestamp NOT NULL,
  endDate: timestamp NOT NULL,
  dueDate: timestamp NOT NULL,
  isActive: boolean default true,
  isClosed: boolean default false,
  closedAt: timestamp,
  createdAt: timestamp defaultNow NOT NULL,
  updatedAt: timestamp defaultNow NOT NULL
})
```

#### `paymentMethods` (domains/finance/payments.ts)
```typescript
pgTable("payment_methods", {
  id: uuid PK defaultRandom,
  organizationId: uuid FK → organizations.id CASCADE NOT NULL,
  memberId: varchar(255) FK → profiles.userId CASCADE NOT NULL,
  type: paymentMethodEnum NOT NULL,
  isDefault: boolean default false,
  isActive: boolean default true,
  stripePaymentMethodId: varchar,
  stripeBillingDetails: jsonb,
  processorType: paymentProcessorEnum,
  processorMethodId: varchar(255),
  bankAccountToken: varchar,
  bankAccountLast4: varchar(4),
  expiresAt: timestamp,
  createdAt: timestamp defaultNow NOT NULL,
  updatedAt: timestamp defaultNow NOT NULL
})
```

#### `bankReconciliation` (domains/finance/payments.ts)
```typescript
pgTable("bank_reconciliation", {
  id: uuid PK defaultRandom,
  organizationId: uuid FK → organizations.id CASCADE NOT NULL,
  bankStatementDate: timestamp NOT NULL,
  bankDepositId: varchar NOT NULL,
  depositAmount: decimal(19,2) NOT NULL,
  depositCurrency: varchar(3) default "CAD",
  status: reconciliationStatusEnum default "unreconciled",
  reconciledAmount: decimal(19,2),
  unmatchedAmount: decimal(19,2),
  matchedPaymentIds: uuid[],
  unmatchedPaymentIds: uuid[],
  notes: text,
  reconciliationNotes: text,
  createdAt: timestamp defaultNow NOT NULL,
  updatedAt: timestamp defaultNow NOT NULL,
  reconciledBy: varchar(255),
  reconciledAt: timestamp
})
```

#### `paymentDisputes` (domains/finance/payments.ts)
```typescript
pgTable("payment_disputes", {
  id: uuid PK defaultRandom,
  organizationId: uuid FK → organizations.id CASCADE NOT NULL,
  paymentId: uuid FK → payments.id CASCADE NOT NULL,
  reason: text NOT NULL,
  description: text,
  status: varchar(50) NOT NULL, // pending, resolved, won, lost
  resolvedAmount: decimal(19,2),
  resolutionNotes: text,
  resolvedAt: timestamp,
  createdAt: timestamp defaultNow NOT NULL,
  updatedAt: timestamp defaultNow NOT NULL,
  filedBy: varchar(255),
  resolvedBy: varchar(255)
})
```

#### `stripeWebhookEvents` (domains/finance/payments.ts)
```typescript
pgTable("stripe_webhook_events", {
  id: uuid PK defaultRandom,
  organizationId: uuid FK → organizations.id CASCADE NOT NULL,
  stripeEventId: varchar NOT NULL unique,
  eventType: varchar(100) NOT NULL,
  stripePaymentIntentId: varchar,
  stripeCustomerId: varchar,
  eventData: jsonb NOT NULL,
  processed: boolean default false,
  processedAt: timestamp,
  processingError: text,
  createdAt: timestamp defaultNow NOT NULL,
  updatedAt: timestamp defaultNow NOT NULL
})
```

### 2.13 Governance (governance-schema.ts)

#### `goldenShares`
```typescript
pgTable("golden_shares", {
  id: uuid PK defaultRandom,
  organizationId: uuid FK → organizations.id CASCADE NOT NULL,
  shareClass: varchar(10) NOT NULL default "B",
  votingWeight: numeric(5,2) NOT NULL default "51.00",
  reservedMatters: text[] default [],
  sunsetDate: date,
  sunsetTriggered: boolean default false,
  isActive: boolean default true,
  holderId: varchar(255),
  holderName: varchar(255),
  issuedAt: timestamp withTimezone defaultNow,
  metadata: jsonb default {},
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow
})
```

#### `reservedMatterVotes`
```typescript
pgTable("reserved_matter_votes", {
  id: uuid PK defaultRandom,
  organizationId: uuid FK → organizations.id CASCADE NOT NULL,
  goldenShareId: uuid FK → goldenShares.id NOT NULL,
  matterType: varchar(255) NOT NULL,
  description: text NOT NULL,
  proposedBy: varchar(255) NOT NULL,
  classAVotesFor: integer default 0,
  classAVotesAgainst: integer default 0,
  classBVote: varchar(50), // approve, reject, abstain
  classBVoteDate: timestamp withTimezone,
  classBVoteReason: text,
  outcome: varchar(50), // approved, rejected, pending
  effectiveDate: date,
  metadata: jsonb default {},
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow
})
```

#### `missionAudits`
```typescript
pgTable("mission_audits", {
  id: uuid PK defaultRandom,
  organizationId: uuid FK → organizations.id CASCADE NOT NULL,
  auditYear: integer NOT NULL,
  revenueFromWorkers: numeric(5,2), // %
  overallSatisfaction: numeric(5,2), // %
  dataViolationCount: integer default 0,
  auditStatus: varchar(50) default "pending",
  findings: jsonb default {},
  recommendations: jsonb default [],
  auditorName: varchar(255),
  auditDate: date,
  nextAuditDate: date,
  metadata: jsonb default {},
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow
})
```

#### `governanceEvents`
```typescript
pgTable("governance_events", {
  id: uuid PK defaultRandom,
  organizationId: uuid FK → organizations.id CASCADE NOT NULL,
  eventType: varchar(100) NOT NULL,
  title: varchar(500) NOT NULL,
  description: text,
  triggeredBy: varchar(255),
  affectedEntities: jsonb default [],
  metadata: jsonb default {},
  createdAt: timestamp withTimezone defaultNow
})
```

### 2.14 Voting (voting-schema.ts)

#### `votingSessions`
```typescript
pgTable("voting_sessions", {
  id: uuid PK defaultRandom,
  organizationId: uuid FK → organizations.id CASCADE NOT NULL,
  title: varchar(500) NOT NULL,
  description: text,
  votingType: varchar(100) NOT NULL, // convention, ratification, strike, election, bylaw, policy
  status: varchar(50) default "draft", // draft, open, closed, certified, cancelled
  quorumRequired: integer,
  quorumMet: boolean default false,
  opensAt: timestamp withTimezone NOT NULL,
  closesAt: timestamp withTimezone NOT NULL,
  results: jsonb default {},
  settings: jsonb default {}, // { allowAbstain, secretBallot, requiresSupermajority, etc. }
  certifiedBy: varchar(255),
  certifiedAt: timestamp withTimezone,
  metadata: jsonb default {},
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow,
  createdBy: varchar(255)
})
```

#### `votingOptions`
```typescript
pgTable("voting_options", {
  id: uuid PK defaultRandom,
  sessionId: uuid FK → votingSessions.id CASCADE NOT NULL,
  label: varchar(500) NOT NULL,
  description: text,
  sortOrder: integer default 0,
  voteCount: integer default 0,
  metadata: jsonb default {},
  createdAt: timestamp withTimezone defaultNow
})
```

#### `voterEligibility`
```typescript
pgTable("voter_eligibility", {
  id: uuid PK defaultRandom,
  sessionId: uuid FK → votingSessions.id CASCADE NOT NULL,
  memberId: uuid FK → organizationMembers.id NOT NULL,
  isEligible: boolean default true,
  eligibilityReason: text,
  votingWeight: numeric(5,2) default "1.00",
  hasVoted: boolean default false,
  votedAt: timestamp withTimezone,
  delegatedTo: uuid,
  delegatedAt: timestamp withTimezone,
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow
})
```

#### `votes`
```typescript
pgTable("votes", {
  id: uuid PK defaultRandom,
  sessionId: uuid FK → votingSessions.id CASCADE NOT NULL,
  optionId: uuid FK → votingOptions.id NOT NULL,
  voterHash: varchar(64) NOT NULL, // anonymized voter identity
  votingWeight: numeric(5,2) default "1.00",
  isDelegated: boolean default false,
  verificationHash: varchar(64), // cryptographic verification
  metadata: jsonb default {},
  createdAt: timestamp withTimezone defaultNow
})
```

#### `votingNotifications`
```typescript
pgTable("voting_notifications", {
  id: uuid PK defaultRandom,
  sessionId: uuid FK → votingSessions.id CASCADE NOT NULL,
  notificationType: varchar(50) NOT NULL, // opened, reminder, closing_soon, closed, results
  sentAt: timestamp withTimezone defaultNow,
  recipientCount: integer default 0,
  metadata: jsonb default {},
  createdAt: timestamp withTimezone defaultNow
})
```

#### `votingAuditLog`
```typescript
pgTable("voting_audit_log", {
  id: uuid PK defaultRandom,
  sessionId: uuid FK → votingSessions.id CASCADE NOT NULL,
  action: varchar(100) NOT NULL,
  actorId: varchar(255),
  details: jsonb default {},
  ipAddress: varchar(45),
  previousAuditHash: varchar(64), // blockchain-like chaining
  auditHash: varchar(64) NOT NULL,
  createdAt: timestamp withTimezone defaultNow
})
```

### 2.15 Notifications (notifications-schema.ts)

#### `userNotificationPreferences`
```typescript
notificationChannelEnum: ["email", "sms", "push", "in_app", "whatsapp", "slack"]
digestFrequencyEnum: ["immediate", "hourly", "daily", "weekly", "never"]

pgTable("user_notification_preferences", {
  id: uuid PK defaultRandom,
  userId: varchar(255) NOT NULL,
  organizationId: uuid FK → organizations.id,
  enabledChannels: notificationChannelEnum[] default ["email", "in_app"],
  emailEnabled: boolean default true,
  smsEnabled: boolean default false,
  pushEnabled: boolean default true,
  inAppEnabled: boolean default true,
  digestFrequency: digestFrequencyEnum default "daily",
  quietHoursStart: varchar(5), // "22:00"
  quietHoursEnd: varchar(5), // "08:00"
  timezone: varchar(50) default "America/Toronto",
  categoryPreferences: jsonb default {},
  unsubscribedCategories: text[] default [],
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow
})
```

#### `notificationTracking`
```typescript
notificationStatusEnum: ["queued", "sending", "sent", "delivered", "read", "failed", "bounced", "unsubscribed"]
notificationTypeEnum: 16 types including grievance, claim, dues, cba, voting, meeting, etc.
notificationPriorityEnum: ["low", "normal", "high", "urgent"]

pgTable("notification_tracking", {
  id: uuid PK defaultRandom,
  organizationId: uuid FK → organizations.id,
  userId: varchar(255) NOT NULL,
  notificationType: notificationTypeEnum NOT NULL,
  channel: notificationChannelEnum NOT NULL,
  priority: notificationPriorityEnum default "normal",
  subject: varchar(500),
  body: text,
  status: notificationStatusEnum default "queued",
  provider: varchar(50), // sendgrid, twilio, firebase, etc.
  externalId: varchar(255),
  sentAt: timestamp withTimezone,
  deliveredAt: timestamp withTimezone,
  readAt: timestamp withTimezone,
  failedAt: timestamp withTimezone,
  failureReason: text,
  retryCount: integer default 0,
  maxRetries: integer default 3,
  metadata: jsonb default {},
  createdAt: timestamp withTimezone defaultNow,
  updatedAt: timestamp withTimezone defaultNow
})
```

#### `inAppNotifications`
```typescript
pgTable("in_app_notifications", {
  id: uuid PK defaultRandom,
  organizationId: uuid FK → organizations.id,
  userId: varchar(255) NOT NULL,
  title: varchar(255) NOT NULL,
  message: text NOT NULL,
  notificationType: notificationTypeEnum NOT NULL,
  priority: notificationPriorityEnum default "normal",
  actionUrl: text,
  actionLabel: varchar(100),
  iconType: varchar(50),
  isRead: boolean default false,
  readAt: timestamp withTimezone,
  isDismissed: boolean default false,
  dismissedAt: timestamp withTimezone,
  expiresAt: timestamp withTimezone,
  relatedEntityType: varchar(100),
  relatedEntityId: uuid,
  metadata: jsonb default {},
  createdAt: timestamp withTimezone defaultNow
})
```

### 2.16 UnionEyes — Schema Files NOT Extracted

The following domain schema files exist but were not read. Each may contain additional tables:

**agreements/**: clauses.ts, collective-agreements.ts (domain version), intelligence.ts, negotiations.ts, shared-library.ts  
**analytics/**, **communications/**, **compliance/**, **data/**, **documents/**, **finance/**: accounting.ts, autopay.ts, billing-config.ts, taxes.ts, transfer-pricing.ts  
**governance/**, **health-safety/**, **infrastructure/**, **ml/**, **scheduling/**  
**federation/**, **financial/**  

**Root db/schema/ files** (~70+ additional): ab-testing, accessibility, ai-chatbot, alerting-automation, analytics-reporting, arbitration-precedents, audit-security, automation-rules, award-templates, bargaining-negotiations, board-packet, calendar, cba-clauses, cba-intelligence, certification-management, clc-partnership, clc-per-capita, clc-sync, cms-website, communication-analytics, congress-memberships, data-governance, deadlines, defensibility-packs, documents, e-signature, education-training, employer-non-interference, feature-flags, financial-payments, force-majeure, founder-conflict, gdpr-compliance, geofence-privacy, grievance-workflow, indigenous-data, integration, international-address, joint-trust-fmv, lmbp-immigration, lrb-agreements, member-documents, member-profile-v2, messages, ml-predictions, mobile-devices, newsletter, organization-members, organizing-tools, pending-profiles, phase-4-messaging, policy-engine, provincial-privacy, push-notifications, recognition-rewards, reports, shared-clause-library, sharing-permissions, signature-workflows, sms-communications, social-media, sso-scim, strike-fund-tax, survey-polling, transfer-pricing, user-management, user-uuid-mapping, wage-benchmarks, whiplash-prevention

---

## 3. ABR Insights — TypeScript Types

**Source Path**: `legacy-codebases/abr-insights-app-main/abr-insights-app-main/lib/types/`

### 3.1 Role Types (roles.ts)

```typescript
type UserRole = 'super_admin' | 'org_admin' | 'manager' | 'instructor' | 'member' 
              | 'viewer' | 'api_service' | 'guest' | 'pending';

interface RoleMetadata {
  level: number;
  displayName: string;
  description: string;
  color: string;
  icon: string;
  landingPage: string;
  canManageRoles: boolean;
  maxManageableLevel: number;
}

const ROLE_CONFIG: Record<UserRole, RoleMetadata> = {
  super_admin:  { level: 100, landingPage: '/admin' },
  org_admin:    { level: 80,  landingPage: '/admin' },
  manager:      { level: 60,  landingPage: '/dashboard' },
  instructor:   { level: 50,  landingPage: '/instructor' },
  member:       { level: 30,  landingPage: '/learn' },
  viewer:       { level: 20,  landingPage: '/explore' },
  api_service:  { level: 90,  landingPage: '/api' },
  guest:        { level: 0,   landingPage: '/' },
  pending:      { level: 5,   landingPage: '/onboarding' },
};
```

### 3.2 Permission Types (permissions.ts)

```typescript
type PermissionCategory = 'courses' | 'lessons' | 'quizzes' | 'content' | 'tribunal_cases'
  | 'users' | 'roles' | 'organizations' | 'analytics' | 'billing'
  | 'ai' | 'api' | 'settings' | 'audit' | 'gamification';

interface Permission {
  id: string;
  resource: string;
  action: string;
  description: string;
}

interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string;
  level: number;
  isSystem: boolean;
  permissions: Permission[];
}
```

### 3.3 Course Types (courses.ts — partial)

```typescript
enum CourseLevel { BEGINNER, INTERMEDIATE, ADVANCED, EXPERT }
enum CourseTier { FREE, PROFESSIONAL, ENTERPRISE }
enum EnrollmentStatus { ACTIVE, COMPLETED, PAUSED, DROPPED }
enum ContentType { VIDEO, ARTICLE, QUIZ, INTERACTIVE, ASSIGNMENT }

interface CourseModule {
  id: string;
  title: string;
  lessons: Lesson[];
}

interface Lesson {
  id: string; title: string; contentType: ContentType;
  duration: number; isFreePreview: boolean;
}

interface CourseVersion {
  id: string; courseId: string; versionNumber: number;
  changes: VersionChange[]; status: 'draft'|'review'|'approved'|'published';
}
```

### 3.4 Supabase Client Configuration

```typescript
// lib/supabase/client.ts — Browser client (singleton)
import { createBrowserClient } from '@supabase/ssr';
export const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// lib/supabase/server.ts — Server client (cookie-based)
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
// Uses cookie store for auth token management
```

---

## 4. Shared Patterns & Conventions

### Common Column Patterns

| Pattern | ABR (SQL) | UnionEyes (Drizzle) |
|---------|-----------|---------------------|
| Primary Key | `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()` | `id: uuid("id").primaryKey().defaultRandom()` |
| Created At | `created_at TIMESTAMPTZ DEFAULT NOW()` | `createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()` |
| Updated At | `updated_at TIMESTAMPTZ DEFAULT NOW()` | `updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()` |
| Soft Delete | Not used (hard deletes) | Not used |
| Multi-tenant | `organization_id UUID REFERENCES organizations(id)` | `organizationId: uuid("organization_id").references(() => organizations.id)` |
| Status Enum | SQL CHECK constraints | pgEnum + column reference |
| Full-text Search | GENERATED tsvector + GIN index | Not used (separate AI embeddings) |
| JSON Data | `JSONB DEFAULT '{}'` | `jsonb("field").default({})` |
| Audit Fields | `created_at`, `updated_at` | `createdAt`, `updatedAt`, `createdBy`, `updatedBy` |

### Naming Conventions

| Aspect | ABR (SQL) | UnionEyes (Drizzle) |
|--------|-----------|---------------------|
| Table Names | snake_case | camelCase variable, snake_case SQL |
| Column Names | snake_case | camelCase TS, snake_case SQL |
| FK Pattern | `_id` suffix | `Id` suffix (camelCase) |
| Enum Names | SQL CHECK strings | pgEnum with explicit name |

### Authentication

| Aspect | ABR | UnionEyes |
|--------|-----|-----------|
| Auth Provider | Supabase Auth (auth.users) | Clerk (user_xxxxx IDs) |
| User ID Type | UUID (auth.users FK) | VARCHAR/TEXT (Clerk ID) |
| RLS | SQL policies | Drizzle inline policies |

---

## 5. Django Model Mapping Guide

### Type Mappings

| Source Type | Django Field |
|------------|-------------|
| `UUID` / `uuid` | `models.UUIDField(primary_key=True, default=uuid.uuid4)` |
| `TEXT` / `text` | `models.TextField()` |
| `VARCHAR(n)` / `varchar(n)` | `models.CharField(max_length=n)` |
| `INTEGER` / `integer` | `models.IntegerField()` |
| `BOOLEAN` / `boolean` | `models.BooleanField(default=False)` |
| `DECIMAL(p,s)` / `numeric(p,s)` | `models.DecimalField(max_digits=p, decimal_places=s)` |
| `DATE` / `date` | `models.DateField()` |
| `TIMESTAMPTZ` / `timestamp withTimezone` | `models.DateTimeField()` |
| `TIME` | `models.TimeField()` |
| `INET` | `models.GenericIPAddressField()` |
| `JSONB` / `jsonb` | `models.JSONField(default=dict)` |
| `TEXT[]` / `text[]` | `django.contrib.postgres.fields.ArrayField(models.TextField())` |
| `UUID[]` | `django.contrib.postgres.fields.ArrayField(models.UUIDField())` |
| `TSVECTOR` (generated) | Implement via `django.contrib.postgres.search.SearchVectorField` |
| `vector(1536)` (pgvector) | `pgvector.django.VectorField(dimensions=1536)` |
| SQL CHECK enum | `models.CharField(choices=...)` |
| pgEnum | `models.CharField(choices=...)` or `models.TextChoices` |
| FK (`REFERENCES`) | `models.ForeignKey(...)` |
| `UNIQUE(a, b)` | `class Meta: unique_together = [('a', 'b')]` or `constraints` |

### Django Model Template

```python
import uuid
from django.db import models
from django.contrib.postgres.fields import ArrayField

class BaseModel(models.Model):
    """Abstract base with standard audit fields."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        abstract = True

class TenantModel(BaseModel):
    """Abstract base for multi-tenant models."""
    organization = models.ForeignKey(
        'organizations.Organization', 
        on_delete=models.CASCADE,
        related_name='%(class)ss'
    )
    
    class Meta:
        abstract = True
```

---

## 6. Complete Entity Inventory

### ABR Insights — 43 Tables Extracted

| # | Table | Domain | Migration File |
|---|-------|--------|---------------|
| 1 | organizations | Core | 001_initial_schema.sql |
| 2 | profiles | Core | 001_initial_schema.sql |
| 3 | roles | RBAC | 001_initial_schema.sql |
| 4 | permissions | RBAC | 001_initial_schema.sql |
| 5 | role_permissions | RBAC | 001_initial_schema.sql |
| 6 | user_roles | RBAC | 001_initial_schema.sql |
| 7 | audit_logs | Audit | 001_initial_schema.sql |
| 8 | content_categories | Content | 003_content_tables.sql |
| 9 | courses | Learning | 003_content_tables.sql |
| 10 | lessons | Learning | 003_content_tables.sql |
| 11 | quizzes | Learning | 003_content_tables.sql |
| 12 | tribunal_cases | Legal | 003_content_tables.sql |
| 13 | enrollments | Engagement | 004_user_engagement.sql |
| 14 | lesson_progress | Engagement | 004_user_engagement.sql |
| 15 | quiz_attempts | Engagement | 004_user_engagement.sql |
| 16 | achievements | Gamification | 004_user_engagement.sql |
| 17 | user_achievements | Gamification | 004_user_engagement.sql |
| 18 | user_points | Gamification | 004_user_engagement.sql |
| 19 | learning_streaks | Gamification | 004_user_engagement.sql |
| 20 | bookmarks | Engagement | 004_user_engagement.sql |
| 21 | course_reviews | Engagement | 004_user_engagement.sql |
| 22 | newsletter_subscribers | Marketing | 011_newsletter_subscribers.sql |
| 23 | testimonials | Marketing | 013_testimonials.sql |
| 24 | classification_feedback | AI | 015_ai_training_system.sql |
| 25 | training_jobs | AI | 015_ai_training_system.sql |
| 26 | automated_training_config | AI | 015_ai_training_system.sql |
| 27 | case_embeddings | AI/Vector | 20250108000002_embeddings.sql |
| 28 | course_embeddings | AI/Vector | 20250108000002_embeddings.sql |
| 29 | lesson_embeddings | AI/Vector | 20250108000002_embeddings.sql |
| 30 | embedding_jobs | AI/Vector | 20250108000002_embeddings.sql |
| 31 | risk_score_history | Risk | 20250129000001_risk_score.sql |
| 32 | organization_risk_history | Risk | 20250129000001_risk_score.sql |
| 33 | evidence_bundles | Compliance | 20250129000002_evidence.sql |
| 34 | evidence_bundle_components | Compliance | 20250129000002_evidence.sql |
| 35 | evidence_bundle_policy_mappings | Compliance | 20250129000002_evidence.sql |
| 36 | evidence_bundle_timeline | Compliance | 20250129000002_evidence.sql |
| 37 | saved_searches | Search | 20250129000003_case_alerts.sql |
| 38 | case_alerts | Search | 20250129000003_case_alerts.sql |
| 39 | case_digests | Search | 20250129000003_case_alerts.sql |
| 40 | alert_preferences | Search | 20250129000003_case_alerts.sql |
| 41 | organization_subscriptions | Billing | 20250129000004_subscriptions.sql |
| 42 | seat_allocations | Billing | 20250129000004_subscriptions.sql |
| 43 | subscription_invoices | Billing | 20250129000004_subscriptions.sql |

**+ ~20 additional tables in unread migrations** (lesson_notes, watch_history, certificates, ce_credits, skills, sso_providers, ai_interaction_logs, canlii_ingestion, etc.)

### UnionEyes — 55 Tables Extracted

| # | Table | Domain | Schema File |
|---|-------|--------|------------|
| 1 | organizations | Core | schema-organizations.ts |
| 2 | organization_relationships | Core | schema-organizations.ts |
| 3 | organization_members | Core | schema-organizations.ts |
| 4 | profiles | Member | domains/member/profiles.ts |
| 5 | users (user_management schema) | Member | domains/member/user-management.ts |
| 6 | organization_users (user_mgmt) | Member | domains/member/user-management.ts |
| 7 | user_sessions (user_mgmt) | Member | domains/member/user-management.ts |
| 8 | oauth_providers (user_mgmt) | Member | domains/member/user-management.ts |
| 9 | member_employment | Member | domains/member/member-employment.ts |
| 10 | employment_history | Member | domains/member/member-employment.ts |
| 11 | member_leaves | Member | domains/member/member-employment.ts |
| 12 | job_classifications | Member | domains/member/member-employment.ts |
| 13 | member_addresses | Member | domains/member/addresses.ts |
| 14 | member_segments | Member | domains/member/member-segments.ts |
| 15 | segment_executions | Member | domains/member/member-segments.ts |
| 16 | segment_exports | Member | domains/member/member-segments.ts |
| 17 | employers | Structure | union-structure-schema.ts |
| 18 | worksites | Structure | union-structure-schema.ts |
| 19 | bargaining_units | Structure | union-structure-schema.ts |
| 20 | committees | Structure | union-structure-schema.ts |
| 21 | committee_memberships | Structure | union-structure-schema.ts |
| 22 | grievances | Grievance | grievance-schema.ts |
| 23 | grievance_responses | Grievance | grievance-schema.ts |
| 24 | arbitrations | Grievance | grievance-schema.ts |
| 25 | settlements | Grievance | grievance-schema.ts |
| 26 | claims | Claims | claims-schema.ts |
| 27 | claim_updates | Claims | claims-schema.ts |
| 28 | collective_agreements | CBA | collective-agreements-schema.ts |
| 29 | cba_version_history | CBA | collective-agreements-schema.ts |
| 30 | cba_contacts | CBA | collective-agreements-schema.ts |
| 31 | dues_rates | Finance | dues-finance-schema.ts |
| 32 | member_dues_ledger | Finance | dues-finance-schema.ts |
| 33 | member_arrears | Finance | dues-finance-schema.ts |
| 34 | employer_remittances | Finance | dues-finance-schema.ts |
| 35 | remittance_line_items | Finance | dues-finance-schema.ts |
| 36 | remittance_exceptions | Finance | dues-finance-schema.ts |
| 37 | dues_transactions | Finance | domains/finance/dues.ts |
| 38 | payments | Finance | domains/finance/payments.ts |
| 39 | payment_cycles | Finance | domains/finance/payments.ts |
| 40 | payment_methods | Finance | domains/finance/payments.ts |
| 41 | bank_reconciliation | Finance | domains/finance/payments.ts |
| 42 | payment_disputes | Finance | domains/finance/payments.ts |
| 43 | stripe_webhook_events | Finance | domains/finance/payments.ts |
| 44 | golden_shares | Governance | governance-schema.ts |
| 45 | reserved_matter_votes | Governance | governance-schema.ts |
| 46 | mission_audits | Governance | governance-schema.ts |
| 47 | governance_events | Governance | governance-schema.ts |
| 48 | voting_sessions | Voting | voting-schema.ts |
| 49 | voting_options | Voting | voting-schema.ts |
| 50 | voter_eligibility | Voting | voting-schema.ts |
| 51 | votes | Voting | voting-schema.ts |
| 52 | voting_notifications | Voting | voting-schema.ts |
| 53 | voting_audit_log | Voting | voting-schema.ts |
| 54 | user_notification_preferences | Notifications | notifications-schema.ts |
| 55 | notification_tracking | Notifications | notifications-schema.ts |
| 56 | in_app_notifications | Notifications | notifications-schema.ts |

**+ ~100 additional tables in unread schema files** across 70+ domain modules

### Grand Total: **~98 tables fully extracted** (43 ABR + 55 UnionEyes) + **~120 estimated unread**

---

## Appendix: Enum Reference

### ABR Insights Enums (SQL CHECK constraints)
- `subscription_tier`: free, professional, enterprise
- `language`: en, fr
- `profile_status`: active, inactive, suspended
- `role_level`: 0-70 (guest through system)
- `course_level`: beginner, intermediate, advanced, expert
- `content_type`: video, article, quiz, interactive, assignment
- `enrollment_status`: active, completed, paused, dropped
- `achievement_type`: completion, streak, points, special, community
- `achievement_rarity`: common, uncommon, rare, epic, legendary
- `feedback_type`: correction, confirmation, enhancement
- `model_type`: classifier, summarizer, risk_assessor, recommendation
- `risk_level`: low, medium, high, critical
- `bundle_type`: compliance, investigation, training, audit, custom
- `subscription_tier_v2`: FREE, PROFESSIONAL, BUSINESS, BUSINESS_PLUS, ENTERPRISE

### UnionEyes Enums (Drizzle pgEnum)
- `organization_type`: congress, federation, union, local, region, district
- `ca_jurisdiction`: federal + 13 provinces/territories
- `labour_sector`: 16 sectors
- `employer_type`: private, public, non_profit, crown_corp, municipal, provincial, federal, indigenous, cooperative
- `employment_status`: active, on_leave, layoff, suspended, terminated, retired, deceased
- `employment_type`: full_time, part_time, casual, seasonal, temporary, contract, probationary
- `grievance_type`: 11 types (individual, group, policy, unjust_dismissal, etc.)
- `grievance_status`: 13 states (draft through closed)
- `claim_type`: 18 types (grievance subtypes + harassment + discrimination)
- `payment_status`: pending, processing, completed, failed, refunded, disputed, unmatched, cancelled
- `payment_method`: stripe, bank_transfer, check, cash, direct_debit, payroll_deduction, ewallet
- `notification_channel`: email, sms, push, in_app, whatsapp, slack
- `membership`: free, pro
- `payment_provider`: stripe, whop
