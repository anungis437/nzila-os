-- Seed missing roles for CUPE Local 123
-- Adds: health_safety_rep, bargaining_committee, officer, president, vice_president, secretary_treasurer
-- Org UUID: 9210418f-6a4f-4dab-a7d2-4450d581dc81

INSERT INTO organization_members (user_id, organization_id, role, status, name, email, membership_number, hire_date)
VALUES
  -- Health & Safety Rep (level 30)
  ('user_cupe_hs_rep_01',  '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'health_safety_rep',    'active', 'Hassan Ali',       'hassan.ali@city.toronto.ca',    'CL123-007', '2017-04-12'),
  -- Bargaining Committee (level 40)
  ('user_cupe_barg_01',    '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'bargaining_committee',  'active', 'Ingrid Bergstrom', 'ingrid.bergstrom@city.toronto.ca', 'CL123-008', '2014-08-25'),
  -- Officer (level 60)
  ('user_cupe_officer_01', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'officer',               'active', 'James Okafor',     'james.okafor@city.toronto.ca',  'CL123-009', '2013-02-10'),
  -- President (level 90)
  ('user_cupe_pres_01',    '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'president',             'active', 'Karen Whitfield',  'karen.whitfield@city.toronto.ca','CL123-EXEC-001', '2010-06-01'),
  -- Vice President (level 85)
  ('user_cupe_vp_01',      '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'vice_president',        'active', 'Luis Ramirez',     'luis.ramirez@city.toronto.ca',   'CL123-EXEC-002', '2011-09-14'),
  -- Secretary Treasurer (level 85)
  ('user_cupe_sectre_01',  '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'secretary_treasurer',   'active', 'Mei Tanaka',       'mei.tanaka@city.toronto.ca',    'CL123-EXEC-003', '2012-03-20')
ON CONFLICT DO NOTHING;

-- Verify: show all CUPE Local 123 members with roles
SELECT name, role, email, membership_number
FROM organization_members
WHERE organization_id = '9210418f-6a4f-4dab-a7d2-4450d581dc81'
ORDER BY role;
