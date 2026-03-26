-- =============================================================================
-- Seed default calendars + events for all organizations
-- Each org gets a shared "Union Calendar" with typical recurring events
-- =============================================================================

-- System user ID for seeded content
DO $$
DECLARE
  sys_owner TEXT := 'system';
  -- Org IDs
  org_cupe123   UUID := '4a20966a-2f17-46b5-9b84-b3efea57b50a';
  org_nzila     UUID := '458a56cb-251a-4c91-a0b5-81bb8ac39087';
  org_clc       UUID := '873cf59b-cef5-4d51-9a62-151512810449';
  org_cupe_nat  UUID := '9210418f-6a4f-4dab-a7d2-4450d581dc81';
  org_cape      UUID := 'c09173ad-5ba4-498e-a483-b371fb5e248e';
  org_cupe79    UUID := 'a1b2c3d4-1111-4000-8000-000000000079';
  org_cupe3903  UUID := 'a1b2c3d4-2222-4000-8000-000000003903';
  org_cupe1000  UUID := 'a1b2c3d4-3333-4000-8000-000000001000';
  -- Calendar IDs (deterministic for idempotency)
  cal_cupe123   UUID := 'ca1e0001-0001-4000-8000-000000000001';
  cal_nzila     UUID := 'ca1e0001-0002-4000-8000-000000000002';
  cal_clc       UUID := 'ca1e0001-0003-4000-8000-000000000003';
  cal_cupe_nat  UUID := 'ca1e0001-0004-4000-8000-000000000004';
  cal_cape      UUID := 'ca1e0001-0005-4000-8000-000000000005';
  cal_cupe79    UUID := 'ca1e0001-0006-4000-8000-000000000006';
  cal_cupe3903  UUID := 'ca1e0001-0007-4000-8000-000000000007';
  cal_cupe1000  UUID := 'ca1e0001-0008-4000-8000-000000000008';
BEGIN
  -- =========================================================================
  -- 1. INSERT CALENDARS (one shared calendar per org)
  -- =========================================================================
  INSERT INTO calendars (id, organization_id, name, description, color, owner_id, is_personal, is_shared, is_public, timezone, is_active)
  VALUES
    (cal_cupe123,  org_cupe123,  'CUPE Local 123 Calendar',       'Official union calendar for CUPE Local 123',                       '#DC2626', sys_owner, false, true, true, 'America/Toronto', true),
    (cal_nzila,    org_nzila,    'NZILA Ventures Calendar',       'Organization calendar for NZILA Ventures',                         '#2563EB', sys_owner, false, true, true, 'America/Toronto', true),
    (cal_clc,      org_clc,      'CLC Calendar',                  'Canadian Labour Congress event calendar',                           '#059669', sys_owner, false, true, true, 'America/Toronto', true),
    (cal_cupe_nat, org_cupe_nat, 'CUPE National Calendar',        'Canadian Union of Public Employees national calendar',              '#7C3AED', sys_owner, false, true, true, 'America/Toronto', true),
    (cal_cape,     org_cape,     'CAPE Calendar',                  'Canadian Association of Professional Employees calendar',           '#D97706', sys_owner, false, true, true, 'America/Toronto', true),
    (cal_cupe79,   org_cupe79,   'CUPE Local 79 Calendar',        'Official union calendar for CUPE Local 79',                        '#0891B2', sys_owner, false, true, true, 'America/Toronto', true),
    (cal_cupe3903, org_cupe3903, 'CUPE Local 3903 Calendar',      'Official union calendar for CUPE Local 3903',                      '#BE185D', sys_owner, false, true, true, 'America/Toronto', true),
    (cal_cupe1000, org_cupe1000, 'CUPE Local 1000 Calendar',      'Official union calendar for CUPE Local 1000',                      '#4F46E5', sys_owner, false, true, true, 'America/Toronto', true)
  ON CONFLICT (id) DO NOTHING;

  -- =========================================================================
  -- 2. INSERT EVENTS FOR CUPE LOCAL 123
  -- =========================================================================
  INSERT INTO calendar_events (id, calendar_id, organization_id, title, description, location, start_time, end_time, event_type, status, priority, organizer_id, created_by, is_all_day, is_recurring, recurrence_rule)
  VALUES
    -- Monthly General Membership Meeting (2nd Tuesday of each month)
    (gen_random_uuid(), cal_cupe123, org_cupe123,
     'General Membership Meeting',
     'Monthly general membership meeting. All members welcome. Agenda includes financial report, grievance updates, and new business.',
     'Union Hall - 123 Labour St, Room A',
     '2026-04-14 18:30:00', '2026-04-14 20:30:00',
     'meeting', 'scheduled', 'high', sys_owner, sys_owner, false, true,
     'FREQ=MONTHLY;BYDAY=2TU'),

    -- Executive Board Meeting (1st Monday of each month)
    (gen_random_uuid(), cal_cupe123, org_cupe123,
     'Executive Board Meeting',
     'Monthly executive board meeting. Officers and stewards.',
     'Union Hall - 123 Labour St, Board Room',
     '2026-04-06 17:00:00', '2026-04-06 19:00:00',
     'meeting', 'scheduled', 'high', sys_owner, sys_owner, false, true,
     'FREQ=MONTHLY;BYDAY=1MO'),

    -- Steward Training Workshop
    (gen_random_uuid(), cal_cupe123, org_cupe123,
     'Steward Training Workshop: Grievance Handling',
     'Training session for new and existing stewards on the grievance process, documentation, and representation skills.',
     'Union Hall - 123 Labour St, Training Room',
     '2026-04-18 09:00:00', '2026-04-18 16:00:00',
     'training', 'confirmed', 'normal', sys_owner, sys_owner, false, false, NULL),

    -- Health & Safety Committee Meeting
    (gen_random_uuid(), cal_cupe123, org_cupe123,
     'Health & Safety Committee Meeting',
     'Joint health and safety committee meeting with employer representatives.',
     'City Hall - Room 302',
     '2026-04-09 13:00:00', '2026-04-09 15:00:00',
     'meeting', 'scheduled', 'normal', sys_owner, sys_owner, false, true,
     'FREQ=MONTHLY;BYDAY=2WE'),

    -- Contract Negotiation Prep
    (gen_random_uuid(), cal_cupe123, org_cupe123,
     'Bargaining Committee Meeting',
     'Preparation for upcoming collective agreement negotiations. Review proposals and strategy.',
     'Union Hall - 123 Labour St, Board Room',
     '2026-04-22 17:30:00', '2026-04-22 20:00:00',
     'negotiation', 'scheduled', 'urgent', sys_owner, sys_owner, false, false, NULL),

    -- Workers'' Memorial Day
    (gen_random_uuid(), cal_cupe123, org_cupe123,
     'Day of Mourning - Workers'' Memorial Day',
     'National Day of Mourning for workers killed or injured on the job. Ceremony at Cenotaph.',
     'City Cenotaph',
     '2026-04-28 00:00:00', '2026-04-28 23:59:00',
     'other', 'confirmed', 'high', sys_owner, sys_owner, true, false, NULL),

    -- May Day / International Workers'' Day
    (gen_random_uuid(), cal_cupe123, org_cupe123,
     'May Day Celebration',
     'International Workers'' Day celebration and solidarity rally.',
     'City Park Amphitheatre',
     '2026-05-01 11:00:00', '2026-05-01 15:00:00',
     'other', 'scheduled', 'normal', sys_owner, sys_owner, false, false, NULL),

    -- Dues Payment Deadline
    (gen_random_uuid(), cal_cupe123, org_cupe123,
     'Q2 Dues Payment Deadline',
     'Quarterly dues payment deadline for all members.',
     NULL,
     '2026-06-30 00:00:00', '2026-06-30 23:59:00',
     'deadline', 'scheduled', 'high', sys_owner, sys_owner, true, false, NULL),

    -- Labour Day Picnic
    (gen_random_uuid(), cal_cupe123, org_cupe123,
     'Labour Day Family Picnic',
     'Annual Labour Day celebration picnic for members and families. Food, games, and prizes.',
     'Riverside Park - Shelter B',
     '2026-09-07 11:00:00', '2026-09-07 16:00:00',
     'other', 'scheduled', 'normal', sys_owner, sys_owner, false, false, NULL),

    -- Annual General Meeting
    (gen_random_uuid(), cal_cupe123, org_cupe123,
     'Annual General Meeting',
     'Annual general meeting including election of officers, financial report, and constitutional amendments.',
     'Community Centre - Main Hall',
     '2026-06-09 18:00:00', '2026-06-09 21:00:00',
     'meeting', 'scheduled', 'urgent', sys_owner, sys_owner, false, false, NULL),

    -- Women''s Committee Meeting
    (gen_random_uuid(), cal_cupe123, org_cupe123,
     'Women''s Committee Meeting',
     'Monthly meeting of the Women''s Committee. Planning equity initiatives and events.',
     'Union Hall - 123 Labour St, Room B',
     '2026-04-16 17:30:00', '2026-04-16 19:00:00',
     'meeting', 'scheduled', 'normal', sys_owner, sys_owner, false, true,
     'FREQ=MONTHLY;BYDAY=3TH'),

    -- Occupational Health Workshop
    (gen_random_uuid(), cal_cupe123, org_cupe123,
     'Workplace Ergonomics Workshop',
     'Free ergonomics assessment and training for office workers. Bring your questions!',
     'Union Hall - 123 Labour St, Training Room',
     '2026-05-09 10:00:00', '2026-05-09 12:00:00',
     'training', 'scheduled', 'normal', sys_owner, sys_owner, false, false, NULL),

    -- Past event: March meeting (completed)
    (gen_random_uuid(), cal_cupe123, org_cupe123,
     'General Membership Meeting',
     'Monthly general membership meeting. Financial report approved. New grievance policy discussed.',
     'Union Hall - 123 Labour St, Room A',
     '2026-03-10 18:30:00', '2026-03-10 20:30:00',
     'meeting', 'completed', 'high', sys_owner, sys_owner, false, false, NULL),

    -- Past event: March H&S meeting (completed)
    (gen_random_uuid(), cal_cupe123, org_cupe123,
     'Health & Safety Committee Meeting',
     'Joint H&S meeting — new PPE policy approved, workplace inspection scheduled.',
     'City Hall - Room 302',
     '2026-03-11 13:00:00', '2026-03-11 15:00:00',
     'meeting', 'completed', 'normal', sys_owner, sys_owner, false, false, NULL);

  -- =========================================================================
  -- 3. INSERT EVENTS FOR OTHER ORGS (representative samples)
  -- =========================================================================

  -- NZILA Ventures
  INSERT INTO calendar_events (id, calendar_id, organization_id, title, description, location, start_time, end_time, event_type, status, priority, organizer_id, created_by, is_all_day)
  VALUES
    (gen_random_uuid(), cal_nzila, org_nzila, 'Sprint Planning', 'Bi-weekly sprint planning session.', 'Virtual - Teams', '2026-04-06 10:00:00', '2026-04-06 11:30:00', 'meeting', 'scheduled', 'high', sys_owner, sys_owner, false),
    (gen_random_uuid(), cal_nzila, org_nzila, 'All-Hands Meeting', 'Monthly company all-hands.', 'Main Office - Auditorium', '2026-04-15 14:00:00', '2026-04-15 15:00:00', 'meeting', 'scheduled', 'normal', sys_owner, sys_owner, false),
    (gen_random_uuid(), cal_nzila, org_nzila, 'Q2 OKR Review', 'Quarterly objectives and key results review.', 'Virtual - Teams', '2026-04-30 09:00:00', '2026-04-30 12:00:00', 'meeting', 'scheduled', 'high', sys_owner, sys_owner, false);

  -- CLC
  INSERT INTO calendar_events (id, calendar_id, organization_id, title, description, location, start_time, end_time, event_type, status, priority, organizer_id, created_by, is_all_day)
  VALUES
    (gen_random_uuid(), cal_clc, org_clc, 'National Executive Meeting', 'CLC National Executive Board quarterly meeting.', 'CLC HQ - Ottawa', '2026-04-20 09:00:00', '2026-04-20 17:00:00', 'meeting', 'scheduled', 'urgent', sys_owner, sys_owner, false),
    (gen_random_uuid(), cal_clc, org_clc, 'May Day Rally - Ottawa', 'CLC-organized International Workers'' Day rally.', 'Parliament Hill', '2026-05-01 12:00:00', '2026-05-01 14:00:00', 'other', 'scheduled', 'high', sys_owner, sys_owner, false),
    (gen_random_uuid(), cal_clc, org_clc, 'Labour Education Conference', 'Annual labour education and leadership conference.', 'Ottawa Convention Centre', '2026-06-15 08:30:00', '2026-06-17 16:00:00', 'training', 'scheduled', 'normal', sys_owner, sys_owner, false);

  -- CUPE National
  INSERT INTO calendar_events (id, calendar_id, organization_id, title, description, location, start_time, end_time, event_type, status, priority, organizer_id, created_by, is_all_day)
  VALUES
    (gen_random_uuid(), cal_cupe_nat, org_cupe_nat, 'National Convention', 'CUPE National Convention 2026.', 'Metro Toronto Convention Centre', '2026-10-19 08:00:00', '2026-10-23 17:00:00', 'meeting', 'scheduled', 'urgent', sys_owner, sys_owner, false),
    (gen_random_uuid(), cal_cupe_nat, org_cupe_nat, 'National Executive Board', 'Quarterly NEB meeting.', 'CUPE National Office - Ottawa', '2026-04-27 09:00:00', '2026-04-28 16:00:00', 'meeting', 'scheduled', 'high', sys_owner, sys_owner, false),
    (gen_random_uuid(), cal_cupe_nat, org_cupe_nat, 'Day of Mourning Ceremony', 'National Day of Mourning for injured and killed workers.', 'CUPE National Office', '2026-04-28 10:00:00', '2026-04-28 11:00:00', 'other', 'confirmed', 'high', sys_owner, sys_owner, false);

  -- CAPE
  INSERT INTO calendar_events (id, calendar_id, organization_id, title, description, location, start_time, end_time, event_type, status, priority, organizer_id, created_by, is_all_day)
  VALUES
    (gen_random_uuid(), cal_cape, org_cape, 'Annual General Meeting', 'CAPE Annual General Meeting and elections.', 'Marriott Hotel - Ottawa', '2026-05-21 09:00:00', '2026-05-21 17:00:00', 'meeting', 'scheduled', 'urgent', sys_owner, sys_owner, false),
    (gen_random_uuid(), cal_cape, org_cape, 'Professional Development Seminar', 'Career advancement and professional development workshop.', 'Virtual - Zoom', '2026-04-30 13:00:00', '2026-04-30 15:00:00', 'training', 'scheduled', 'normal', sys_owner, sys_owner, false);

  -- CUPE Local 79
  INSERT INTO calendar_events (id, calendar_id, organization_id, title, description, location, start_time, end_time, event_type, status, priority, organizer_id, created_by, is_all_day)
  VALUES
    (gen_random_uuid(), cal_cupe79, org_cupe79, 'General Membership Meeting', 'Monthly general membership meeting.', 'Metro Hall - Council Chamber', '2026-04-15 18:30:00', '2026-04-15 20:30:00', 'meeting', 'scheduled', 'high', sys_owner, sys_owner, false),
    (gen_random_uuid(), cal_cupe79, org_cupe79, 'Bargaining Update Town Hall', 'Town hall for members re: contract negotiations with City of Toronto.', 'Civic Centre - Rotunda', '2026-05-05 18:00:00', '2026-05-05 20:00:00', 'negotiation', 'scheduled', 'urgent', sys_owner, sys_owner, false),
    (gen_random_uuid(), cal_cupe79, org_cupe79, 'Steward Training', 'New steward orientation and training.', 'CUPE 79 Office - Training Room', '2026-04-25 09:00:00', '2026-04-25 16:00:00', 'training', 'confirmed', 'normal', sys_owner, sys_owner, false);

  -- CUPE Local 3903
  INSERT INTO calendar_events (id, calendar_id, organization_id, title, description, location, start_time, end_time, event_type, status, priority, organizer_id, created_by, is_all_day)
  VALUES
    (gen_random_uuid(), cal_cupe3903, org_cupe3903, 'General Membership Meeting', 'Monthly GMM for all bargaining units.', 'Student Centre - Room 313', '2026-04-08 17:00:00', '2026-04-08 19:00:00', 'meeting', 'scheduled', 'high', sys_owner, sys_owner, false),
    (gen_random_uuid(), cal_cupe3903, org_cupe3903, 'Contract Action Committee', 'Mobilization planning for upcoming bargaining.', 'Student Centre - Room 314', '2026-04-22 16:00:00', '2026-04-22 18:00:00', 'negotiation', 'scheduled', 'high', sys_owner, sys_owner, false),
    (gen_random_uuid(), cal_cupe3903, org_cupe3903, 'TA Orientation Session', 'Orientation for new teaching assistants on rights and responsibilities.', 'York Lanes - Room 280', '2026-09-02 10:00:00', '2026-09-02 14:00:00', 'training', 'scheduled', 'normal', sys_owner, sys_owner, false);

  -- CUPE Local 1000
  INSERT INTO calendar_events (id, calendar_id, organization_id, title, description, location, start_time, end_time, event_type, status, priority, organizer_id, created_by, is_all_day)
  VALUES
    (gen_random_uuid(), cal_cupe1000, org_cupe1000, 'General Membership Meeting', 'Monthly general meeting.', 'Community Hall', '2026-04-10 18:30:00', '2026-04-10 20:30:00', 'meeting', 'scheduled', 'high', sys_owner, sys_owner, false),
    (gen_random_uuid(), cal_cupe1000, org_cupe1000, 'Pension Information Session', 'Information session on OMERS pension plan changes.', 'Community Hall - Room 2', '2026-05-14 12:00:00', '2026-05-14 13:30:00', 'training', 'scheduled', 'normal', sys_owner, sys_owner, false),
    (gen_random_uuid(), cal_cupe1000, org_cupe1000, 'Labour Day Parade', 'Annual Labour Day parade. Meet at staging area.', 'City Centre - Main St', '2026-09-07 09:00:00', '2026-09-07 12:00:00', 'other', 'scheduled', 'normal', sys_owner, sys_owner, false);

  RAISE NOTICE 'Seeded 8 calendars and calendar events for all organizations';
END $$;
