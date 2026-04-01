-- =============================================================================
-- CUPE Local 123 – Voting Sessions Seed Data
-- Populates realistic voting sessions, options, and cast votes
-- Target org: 9210418f-6a4f-4dab-a7d2-4450d581dc81
-- =============================================================================
BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Active voting sessions (visible on "Active" tab)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1a. Ratification of 2026-2030 Inside Workers CBA
INSERT INTO voting_sessions
  (id, title, description, type, status, meeting_type, organization_id,
   created_by, start_time, end_time, allow_anonymous, requires_quorum,
   quorum_threshold, total_eligible_voters, created_at, updated_at)
VALUES
  ('aa100001-0001-4000-8000-000000000001',
   'Ratification – Inside Workers CBA 2026-2030',
   'Vote to accept or reject the tentative agreement negotiated between CUPE Local 123 and the City of Toronto for the 2026-2030 Inside Workers collective bargaining agreement. Key gains include 3.5% annual wage increase, improved dental coverage, and a new remote work article.',
   'ratification', 'active', 'ratification',
   '9210418f-6a4f-4dab-a7d2-4450d581dc81',
   'grace.lee@city.toronto.ca',
   '2026-03-25 09:00:00-04', '2026-04-01 17:00:00-04',
   true, true, 50, 1, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO voting_options (id, session_id, text, description, order_index, created_at)
VALUES
  ('bb100001-0001-4000-8000-000000000001', 'aa100001-0001-4000-8000-000000000001',
   'Accept Agreement', 'Accept the tentative 2026-2030 Inside Workers CBA as negotiated', 1, now()),
  ('bb100001-0001-4000-8000-000000000002', 'aa100001-0001-4000-8000-000000000001',
   'Reject Agreement', 'Reject the tentative agreement and direct the bargaining team to return to the table', 2, now())
ON CONFLICT (id) DO NOTHING;

-- 1b. Policy vote – workplace surveillance
INSERT INTO voting_sessions
  (id, title, description, type, status, meeting_type, organization_id,
   created_by, start_time, end_time, allow_anonymous, requires_quorum,
   quorum_threshold, total_eligible_voters, created_at, updated_at)
VALUES
  ('aa100001-0001-4000-8000-000000000002',
   'Policy Resolution – Workplace Surveillance',
   'Should the Local demand a ban on employer-deployed AI surveillance and keystroke monitoring for remote workers? This resolution will guide the bargaining team''s priorities for the next round.',
   'special_vote', 'active', 'special',
   '9210418f-6a4f-4dab-a7d2-4450d581dc81',
   'grace.lee@city.toronto.ca',
   '2026-03-26 08:00:00-04', '2026-04-05 23:59:00-04',
   true, true, 33, 1, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO voting_options (id, session_id, text, description, order_index, created_at)
VALUES
  ('bb100001-0001-4000-8000-000000000003', 'aa100001-0001-4000-8000-000000000002',
   'Support – Ban Surveillance', 'Mandate the bargaining team to negotiate a full ban on AI-driven surveillance and keystroke logging', 1, now()),
  ('bb100001-0001-4000-8000-000000000004', 'aa100001-0001-4000-8000-000000000002',
   'Support – With Conditions', 'Allow limited monitoring with union oversight, advance notice, and 30-day data retention caps', 2, now()),
  ('bb100001-0001-4000-8000-000000000005', 'aa100001-0001-4000-8000-000000000002',
   'Oppose Resolution', 'No change; leave current employer practices in place', 3, now())
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Upcoming voting sessions (visible on "Upcoming" tab)
-- ─────────────────────────────────────────────────────────────────────────────

-- 2a. Executive elections
INSERT INTO voting_sessions
  (id, title, description, type, status, meeting_type, organization_id,
   created_by, start_time, end_time, allow_anonymous, requires_quorum,
   quorum_threshold, total_eligible_voters, created_at, updated_at)
VALUES
  ('aa100001-0001-4000-8000-000000000003',
   'Executive Elections 2026-2028',
   'Election of executive officers for the 2026-2028 term. Positions: President, Vice-President, Secretary-Treasurer, and three Trustees. Campaigning period ends April 10.',
   'special_vote', 'draft', 'convention',
   '9210418f-6a4f-4dab-a7d2-4450d581dc81',
   'grace.lee@city.toronto.ca',
   '2026-04-15 18:00:00-04', '2026-04-15 22:00:00-04',
   true, true, 25, 1, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO voting_options (id, session_id, text, description, order_index, created_at)
VALUES
  ('bb100001-0001-4000-8000-000000000006', 'aa100001-0001-4000-8000-000000000003',
   'Jean-Pierre Tremblay', 'Candidate for President – Senior Inspector, 12 years with the City, former steward', 1, now()),
  ('bb100001-0001-4000-8000-000000000007', 'aa100001-0001-4000-8000-000000000003',
   'Priya Patel', 'Candidate for President – IT Support Analyst, current grievance committee chair', 2, now()),
  ('bb100001-0001-4000-8000-000000000008', 'aa100001-0001-4000-8000-000000000003',
   'Abstain', 'Abstain from voting', 3, now())
ON CONFLICT (id) DO NOTHING;

-- 2b. Bylaw amendment – dues adjustment
INSERT INTO voting_sessions
  (id, title, description, type, status, meeting_type, organization_id,
   created_by, start_time, end_time, allow_anonymous, requires_quorum,
   quorum_threshold, total_eligible_voters, created_at, updated_at)
VALUES
  ('aa100001-0001-4000-8000-000000000004',
   'Bylaw Amendment – Defence Fund Contribution',
   'Proposal to increase member contributions to the strike/defence fund from $3 to $8 per month. Funds would be ring-fenced for legal representation, arbitration costs, and strike pay reserves. Requires two-thirds majority.',
   'special_vote', 'draft', 'special',
   '9210418f-6a4f-4dab-a7d2-4450d581dc81',
   'grace.lee@city.toronto.ca',
   '2026-04-22 19:00:00-04', '2026-04-22 21:00:00-04',
   false, true, 66, 1, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO voting_options (id, session_id, text, description, order_index, created_at)
VALUES
  ('bb100001-0001-4000-8000-000000000009', 'aa100001-0001-4000-8000-000000000004',
   'Approve – $8/month', 'Approve the increase to $8/month effective June 2026', 1, now()),
  ('bb100001-0001-4000-8000-000000000010', 'aa100001-0001-4000-8000-000000000004',
   'Compromise – $5/month', 'Approve a reduced increase to $5/month', 2, now()),
  ('bb100001-0001-4000-8000-000000000011', 'aa100001-0001-4000-8000-000000000004',
   'Reject', 'Keep the current $3/month contribution', 3, now())
ON CONFLICT (id) DO NOTHING;

-- 2c. Pulse check – return-to-office
INSERT INTO voting_sessions
  (id, title, description, type, status, meeting_type, organization_id,
   created_by, start_time, end_time, allow_anonymous, requires_quorum,
   quorum_threshold, total_eligible_voters, created_at, updated_at)
VALUES
  ('aa100001-0001-4000-8000-000000000005',
   'Quick Poll – Return-to-Office Preferences',
   'Non-binding pulse check on members'' preferred hybrid work arrangement. Results will inform the bargaining team''s position on Article 42 (Remote Work).',
   'special_vote', 'draft', 'special',
   '9210418f-6a4f-4dab-a7d2-4450d581dc81',
   'bob.smith@city.toronto.ca',
   '2026-05-01 08:00:00-04', '2026-05-07 23:59:00-04',
   true, false, 0, 1, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO voting_options (id, session_id, text, description, order_index, created_at)
VALUES
  ('bb100001-0001-4000-8000-000000000012', 'aa100001-0001-4000-8000-000000000005',
   'Full Remote', 'Prefer to work fully remote (5 days/week from home)', 1, now()),
  ('bb100001-0001-4000-8000-000000000013', 'aa100001-0001-4000-8000-000000000005',
   'Hybrid – 2 Days In', 'Prefer 2 days in-office, 3 days remote', 2, now()),
  ('bb100001-0001-4000-8000-000000000014', 'aa100001-0001-4000-8000-000000000005',
   'Hybrid – 3 Days In', 'Prefer 3 days in-office, 2 days remote', 3, now()),
  ('bb100001-0001-4000-8000-000000000015', 'aa100001-0001-4000-8000-000000000005',
   'Full In-Office', 'Prefer to work fully in-office (5 days/week)', 4, now())
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Past / closed voting sessions (visible on "Past Results" tab)
-- ─────────────────────────────────────────────────────────────────────────────

-- 3a. Strike authorization (closed, passed)
INSERT INTO voting_sessions
  (id, title, description, type, status, meeting_type, organization_id,
   created_by, start_time, end_time, allow_anonymous, requires_quorum,
   quorum_threshold, total_eligible_voters, created_at, updated_at)
VALUES
  ('aa100001-0001-4000-8000-000000000006',
   'Strike Authorization – Outside Workers',
   'Vote to authorize a legal strike if necessary during the Outside Workers CBA mid-term review. Passed with 87% in favour.',
   'special_vote', 'closed', 'emergency',
   '9210418f-6a4f-4dab-a7d2-4450d581dc81',
   'grace.lee@city.toronto.ca',
   '2026-02-10 18:00:00-05', '2026-02-10 21:00:00-05',
   true, true, 50, 1, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO voting_options (id, session_id, text, description, order_index, created_at)
VALUES
  ('bb100001-0001-4000-8000-000000000016', 'aa100001-0001-4000-8000-000000000006',
   'Yes – Authorize Strike', 'Authorize the executive to call a legal strike if negotiations fail', 1, now()),
  ('bb100001-0001-4000-8000-000000000017', 'aa100001-0001-4000-8000-000000000006',
   'No – Continue Negotiating', 'Do not authorize a strike at this time', 2, now())
ON CONFLICT (id) DO NOTHING;

-- 3b. Previous collective agreement ratification (closed, passed)
INSERT INTO voting_sessions
  (id, title, description, type, status, meeting_type, organization_id,
   created_by, start_time, end_time, allow_anonymous, requires_quorum,
   quorum_threshold, total_eligible_voters, created_at, updated_at)
VALUES
  ('aa100001-0001-4000-8000-000000000007',
   'Ratification – Inside Workers CBA 2022-2026',
   'Vote to ratify the 4-year collective agreement negotiated between CUPE L123 and the City. Ratified with 72% in favour. Included new mental health leave provisions and salary grid restructuring.',
   'ratification', 'closed', 'ratification',
   '9210418f-6a4f-4dab-a7d2-4450d581dc81',
   'grace.lee@city.toronto.ca',
   '2022-06-15 09:00:00-04', '2022-06-17 17:00:00-04',
   true, true, 50, 1, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO voting_options (id, session_id, text, description, order_index, created_at)
VALUES
  ('bb100001-0001-4000-8000-000000000018', 'aa100001-0001-4000-8000-000000000007',
   'Accept Agreement', 'Accept the tentative 2022-2026 CBA', 1, now()),
  ('bb100001-0001-4000-8000-000000000019', 'aa100001-0001-4000-8000-000000000007',
   'Reject Agreement', 'Reject and return to bargaining', 2, now())
ON CONFLICT (id) DO NOTHING;

-- 3c. Workplace safety policy (closed, passed unanimously)
INSERT INTO voting_sessions
  (id, title, description, type, status, meeting_type, organization_id,
   created_by, start_time, end_time, allow_anonymous, requires_quorum,
   quorum_threshold, total_eligible_voters, created_at, updated_at)
VALUES
  ('aa100001-0001-4000-8000-000000000008',
   'Policy – Right to Refuse Unsafe Work Protocol',
   'Motion to adopt a strengthened right-to-refuse protocol with automatic JHSC investigation within 4 hours, steward notification, and prohibition on employer reprisal. Passed unanimously.',
   'special_vote', 'closed', 'special',
   '9210418f-6a4f-4dab-a7d2-4450d581dc81',
   'bob.smith@city.toronto.ca',
   '2025-11-20 19:00:00-05', '2025-11-20 21:00:00-05',
   true, true, 33, 1, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO voting_options (id, session_id, text, description, order_index, created_at)
VALUES
  ('bb100001-0001-4000-8000-000000000020', 'aa100001-0001-4000-8000-000000000008',
   'Adopt Protocol', 'Adopt the strengthened right-to-refuse protocol and notify the employer', 1, now()),
  ('bb100001-0001-4000-8000-000000000021', 'aa100001-0001-4000-8000-000000000008',
   'Reject Protocol', 'Maintain current right-to-refuse procedures', 2, now())
ON CONFLICT (id) DO NOTHING;

COMMIT;

