-- Migration: Add Row-Level Security Policies for Messaging Tables
-- Date: February 6, 2026
-- Priority: CRITICAL - Messages are private communications
-- Severity: 🔴 CRITICAL DATA EXPOSURE

-- ============================================================================
-- 1. MESSAGES TABLE - RLS POLICIES
-- ============================================================================

-- Enable RLS on messages table
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can SELECT messages in threads they participate in
DO $$ BEGIN
  CREATE POLICY "messages_read_participant_access" ON messages
  FOR SELECT
  TO public
  USING (
    thread_id IN (
      SELECT thread_id 
      FROM message_participants 
      WHERE user_id = current_setting('app.current_user_id', true) -- Clerk user ID from auth context
    )
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Policy 2: Users can INSERT messages only to threads they're part of (as sender)
DO $$ BEGIN
  CREATE POLICY "messages_create_participant_only" ON messages
  FOR INSERT
  TO public
  WITH CHECK (
    thread_id IN (
      SELECT thread_id 
      FROM message_participants 
      WHERE user_id = current_setting('app.current_user_id', true)
    )
    AND sender_id = current_setting('app.current_user_id', true) -- Can only send as themselves
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Policy 3: Users can UPDATE their own recent messages (15 min edit window)
DO $$ BEGIN
  CREATE POLICY "messages_update_own_recent" ON messages
  FOR UPDATE
  TO public
  USING (
    sender_id = current_setting('app.current_user_id', true)
    AND created_at > (NOW() - INTERVAL '15 minutes')
  )
  WITH CHECK (
    sender_id = current_setting('app.current_user_id', true)
    AND thread_id IN (
      SELECT thread_id 
      FROM message_participants 
      WHERE user_id = current_setting('app.current_user_id', true)
    )
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Policy 4: Users can DELETE their own recent messages (1 hour delete window)
DO $$ BEGIN
  CREATE POLICY "messages_delete_own_recent" ON messages
  FOR DELETE
  TO public
  USING (
    sender_id = current_setting('app.current_user_id', true)
    AND created_at > (NOW() - INTERVAL '1 hour')
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Index for performance - queries on thread_id
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- ============================================================================
-- 2. MESSAGE_THREADS TABLE - RLS POLICIES
-- ============================================================================

-- Enable RLS on message_threads table
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can SELECT threads they participate in
DO $$ BEGIN
  CREATE POLICY "threads_read_participant_access" ON message_threads
  FOR SELECT
  TO public
  USING (
    id IN (
      SELECT thread_id 
      FROM message_participants 
      WHERE user_id = current_setting('app.current_user_id', true)
    )
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Policy 2: Organization members can CREATE threads within their org
DO $$ BEGIN
  CREATE POLICY "threads_create_org_members" ON message_threads
  FOR INSERT
  TO public
  WITH CHECK (
    organization_id IN (
      SELECT DISTINCT organization_id 
      FROM organization_members 
      WHERE user_id = current_setting('app.current_user_id', true) 
        AND status = 'active'
    )
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Policy 3: Thread participants can UPDATE thread metadata (title, etc)
DO $$ BEGIN
  CREATE POLICY "threads_update_participant" ON message_threads
  FOR UPDATE
  TO public
  USING (
    id IN (
      SELECT thread_id 
      FROM message_participants 
      WHERE user_id = current_setting('app.current_user_id', true)
    )
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Policy 4: Only thread creator or org admins can DELETE threads
DO $$ BEGIN
  CREATE POLICY "threads_delete_creator_or_admin" ON message_threads
  FOR DELETE
  TO public
  USING (
    created_by = current_setting('app.current_user_id', true)
    OR organization_id IN (
      SELECT DISTINCT organization_id 
      FROM organization_members 
      WHERE user_id = current_setting('app.current_user_id', true) 
        AND role IN ('admin', 'officer')
    )
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_message_threads_organization_id ON message_threads(organization_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_created_by ON message_threads(created_by);

-- ============================================================================
-- 3. MESSAGE_PARTICIPANTS TABLE - RLS POLICIES
-- ============================================================================

-- Enable RLS on message_participants table
ALTER TABLE message_participants ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can SELECT their own participant records or if they admin the org
DO $$ BEGIN
  CREATE POLICY "participants_read_own_or_admin" ON message_participants
  FOR SELECT
  TO public
  USING (
    user_id = current_setting('app.current_user_id', true)
    OR thread_id IN (
      SELECT mt.id 
      FROM message_threads mt
      WHERE mt.organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = current_setting('app.current_user_id', true) AND role IN ('admin', 'officer')
      )
    )
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Policy 2: Only org admins can insert participants
DO $$ BEGIN
  CREATE POLICY "participants_create_org_admin" ON message_participants
  FOR INSERT
  TO public
  WITH CHECK (
    thread_id IN (
      SELECT mt.id 
      FROM message_threads mt
      WHERE mt.organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = current_setting('app.current_user_id', true) AND role IN ('admin', 'officer')
      )
    )
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Policy 3: Users can remove themselves from threads
DO $$ BEGIN
  CREATE POLICY "participants_delete_self" ON message_participants
  FOR DELETE
  TO public
  USING (user_id = current_setting('app.current_user_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_message_participants_user_id ON message_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_message_participants_thread_id ON message_participants(thread_id);

-- ============================================================================
-- 4. MESSAGE_READ_RECEIPTS TABLE - RLS POLICIES
-- ============================================================================

-- Enable RLS on message_read_receipts table
ALTER TABLE message_read_receipts ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can only see their own read receipts (privacy)
DO $$ BEGIN
  CREATE POLICY "read_receipts_own_only" ON message_read_receipts
  FOR SELECT
  TO public
  USING (
    reader_id = current_setting('app.current_user_id', true)
    OR message_id IN (
      SELECT m.id 
      FROM messages m
      WHERE m.sender_id = current_setting('app.current_user_id', true)
    )
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Policy 2: Users can only insert their own read receipts
DO $$ BEGIN
  CREATE POLICY "read_receipts_create_own" ON message_read_receipts
  FOR INSERT
  TO public
  WITH CHECK (reader_id = current_setting('app.current_user_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================================
-- 5. MESSAGE_NOTIFICATIONS TABLE - RLS POLICIES
-- ============================================================================

-- Enable RLS on message_notifications table
ALTER TABLE message_notifications ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can only see their own notifications
DO $$ BEGIN
  CREATE POLICY "msg_notifications_own_only" ON message_notifications
  FOR SELECT
  TO public
  USING (recipient_id = current_setting('app.current_user_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Policy 2: Users can only insert notifications for themselves
DO $$ BEGIN
  CREATE POLICY "msg_notifications_create_own" ON message_notifications
  FOR INSERT
  TO public
  WITH CHECK (recipient_id = current_setting('app.current_user_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Policy 3: Users can update their own notifications (mark as read, etc)
DO $$ BEGIN
  CREATE POLICY "msg_notifications_update_own" ON message_notifications
  FOR UPDATE
  TO public
  USING (recipient_id = current_setting('app.current_user_id', true));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_message_notifications_recipient_id ON message_notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_notifications_is_read ON message_notifications(is_read) WHERE is_read = false;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify RLS is enabled on all messaging tables
DO $$ 
DECLARE
  v_table TEXT;
  v_count INTEGER := 0;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['messages', 'message_threads', 'message_participants', 'message_read_receipts', 'message_notifications']
  LOOP
    IF (SELECT relrowsecurity FROM pg_class WHERE relname = v_table) THEN
      RAISE NOTICE 'RLS enabled: %', v_table;
      v_count := v_count + 1;
    ELSE
      RAISE WARNING 'RLS NOT enabled: %', v_table;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'RLS enforcement complete: % of 5 messaging tables protected', v_count;
END $$;

-- ============================================================================
-- AUDIT LOG ENTRY
-- DISABLED: audit_security schema was dropped in migration 0019 (does not exist)
-- INSERT INTO audit_security.security_events (
--   organization_id,
--   event_category,
--   event_type,
--   severity,
--   description,
--   affected_table,
--   risk_score,
--   remediation_status
-- ) VALUES (
--   NULL, -- System-wide change
--   'configuration',
--   'rls_policies_added',
--   'high',
--   'Applied Row-Level Security policies to messaging tables (messages, message_threads, message_participants, message_read_receipts, message_notifications)',
--   'messages,message_threads,message_participants,message_read_receipts,message_notifications',
--   0, -- Remediation of vulnerability
--   'resolved'
-- );
