-- Seed member locations on STAGING (org UUID-mapped)
-- CAPE staging: 885aa4e0-5dc1-45bf-ad32-86477868e8ea
-- CLC staging:  5ecb17ab-b5de-442e-a46f-93778ee496aa
-- Other orgs share UUIDs with local

-- CUPE Local 123 (municipal workers — Ontario cities)
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Bob Smith' AND organization_id = '4a20966a-2f17-46b5-9b84-b3efea57b50a';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Alice Johnson' AND organization_id = '4a20966a-2f17-46b5-9b84-b3efea57b50a';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Grace Lee' AND organization_id = '4a20966a-2f17-46b5-9b84-b3efea57b50a';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'David Okafor' AND organization_id = '4a20966a-2f17-46b5-9b84-b3efea57b50a';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Fatima Al-Rashid' AND organization_id = '4a20966a-2f17-46b5-9b84-b3efea57b50a';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Carlos Vega' AND organization_id = '4a20966a-2f17-46b5-9b84-b3efea57b50a';
UPDATE organization_members SET location = 'Gatineau, QC' WHERE name = 'Jean-Pierre Tremblay' AND organization_id = '4a20966a-2f17-46b5-9b84-b3efea57b50a';
UPDATE organization_members SET location = 'Kanata, ON' WHERE name = 'Liam Chen' AND organization_id = '4a20966a-2f17-46b5-9b84-b3efea57b50a';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Isabelle Nguyen' AND organization_id = '4a20966a-2f17-46b5-9b84-b3efea57b50a';
UPDATE organization_members SET location = 'Barrhaven, ON' WHERE name = 'Sophie Martin' AND organization_id = '4a20966a-2f17-46b5-9b84-b3efea57b50a';
UPDATE organization_members SET location = 'Orléans, ON' WHERE name = 'Priya Sharma' AND organization_id = '4a20966a-2f17-46b5-9b84-b3efea57b50a';
UPDATE organization_members SET location = 'Nepean, ON' WHERE name = 'Rebecca Martin' AND organization_id = '4a20966a-2f17-46b5-9b84-b3efea57b50a';

-- CAPE — staging UUID 885aa4e0
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Alexandre Moreau' AND organization_id = '885aa4e0-5dc1-45bf-ad32-86477868e8ea';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Amira Hassan' AND organization_id = '885aa4e0-5dc1-45bf-ad32-86477868e8ea';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Aubert Nungisa' AND organization_id = '885aa4e0-5dc1-45bf-ad32-86477868e8ea';
UPDATE organization_members SET location = 'Gatineau, QC' WHERE name = 'Brian Faulkner' AND organization_id = '885aa4e0-5dc1-45bf-ad32-86477868e8ea';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Chantal Bertrand' AND organization_id = '885aa4e0-5dc1-45bf-ad32-86477868e8ea';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Daniel Kim' AND organization_id = '885aa4e0-5dc1-45bf-ad32-86477868e8ea';
UPDATE organization_members SET location = 'Gatineau, QC' WHERE name = 'Denis Bolduc' AND organization_id = '885aa4e0-5dc1-45bf-ad32-86477868e8ea';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Emmanuelle Tremblay' AND organization_id = '885aa4e0-5dc1-45bf-ad32-86477868e8ea';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Greg Phillips' AND organization_id = '885aa4e0-5dc1-45bf-ad32-86477868e8ea';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'James Nguyen' AND organization_id = '885aa4e0-5dc1-45bf-ad32-86477868e8ea';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Jennifer Walsh' AND organization_id = '885aa4e0-5dc1-45bf-ad32-86477868e8ea';
UPDATE organization_members SET location = 'Gatineau, QC' WHERE name = 'Louis Picard' AND organization_id = '885aa4e0-5dc1-45bf-ad32-86477868e8ea';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Mike Savard' AND organization_id = '885aa4e0-5dc1-45bf-ad32-86477868e8ea';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Nadia Ouellet' AND organization_id = '885aa4e0-5dc1-45bf-ad32-86477868e8ea';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Patrick O''Connor' AND organization_id = '885aa4e0-5dc1-45bf-ad32-86477868e8ea';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Pierre Desmarais' AND organization_id = '885aa4e0-5dc1-45bf-ad32-86477868e8ea';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Sarah Lefebvre' AND organization_id = '885aa4e0-5dc1-45bf-ad32-86477868e8ea';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Sophie Tremblay' AND organization_id = '885aa4e0-5dc1-45bf-ad32-86477868e8ea';
UPDATE organization_members SET location = 'Mississauga, ON' WHERE name = 'Fatima Al-Rashid' AND organization_id = '885aa4e0-5dc1-45bf-ad32-86477868e8ea';

-- CLC — staging UUID 5ecb17ab
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Hassan Yussuff' AND organization_id = '5ecb17ab-b5de-442e-a46f-93778ee496aa';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Marie Clarke Walker' AND organization_id = '5ecb17ab-b5de-442e-a46f-93778ee496aa';
UPDATE organization_members SET location = 'Toronto, ON' WHERE name = 'Angela Varga' AND organization_id = '5ecb17ab-b5de-442e-a46f-93778ee496aa';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Aubert Nungisa' AND organization_id = '5ecb17ab-b5de-442e-a46f-93778ee496aa';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Denis Bolduc' AND organization_id = '5ecb17ab-b5de-442e-a46f-93778ee496aa';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Fatima Al-Rashid' AND organization_id = '5ecb17ab-b5de-442e-a46f-93778ee496aa';

-- CUPE National
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Mark Hancock' AND organization_id = '9210418f-6a4f-4dab-a7d2-4450d581dc81';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Patty Coates' AND organization_id = '9210418f-6a4f-4dab-a7d2-4450d581dc81';
UPDATE organization_members SET location = 'Burnaby, BC' WHERE name = 'Tim Maguire' AND organization_id = '9210418f-6a4f-4dab-a7d2-4450d581dc81';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Sandra Weatherby' AND organization_id = '9210418f-6a4f-4dab-a7d2-4450d581dc81';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Aubert Nungisa' AND organization_id = '9210418f-6a4f-4dab-a7d2-4450d581dc81';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'David Nkemdirim' AND organization_id = '9210418f-6a4f-4dab-a7d2-4450d581dc81';

-- NZILA Ventures
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Aubert Nungisa' AND organization_id = '458a56cb-251a-4c91-a0b5-81bb8ac39087';
UPDATE organization_members SET location = 'Toronto, ON' WHERE name = 'Ahmed Hassan' AND organization_id = '458a56cb-251a-4c91-a0b5-81bb8ac39087';
UPDATE organization_members SET location = 'Toronto, ON' WHERE name = 'Carlos Rivera' AND organization_id = '458a56cb-251a-4c91-a0b5-81bb8ac39087';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'David Nkemdirim' AND organization_id = '458a56cb-251a-4c91-a0b5-81bb8ac39087';
UPDATE organization_members SET location = 'Montréal, QC' WHERE name = 'Keisha Brown' AND organization_id = '458a56cb-251a-4c91-a0b5-81bb8ac39087';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Marie-Claire Dubois' AND organization_id = '458a56cb-251a-4c91-a0b5-81bb8ac39087';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Priya Sharma' AND organization_id = '458a56cb-251a-4c91-a0b5-81bb8ac39087';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Tania Da Silva' AND organization_id = '458a56cb-251a-4c91-a0b5-81bb8ac39087';

-- CUPE Locals (Aubert/David multi-org memberships)
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Aubert Nungisa' AND organization_id = 'a1b2c3d4-3333-4000-8000-000000001000';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Aubert Nungisa' AND organization_id = 'a1b2c3d4-1111-4000-8000-000000000079';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'Aubert Nungisa' AND organization_id = 'a1b2c3d4-2222-4000-8000-000000003903';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'David Nkemdirim' AND organization_id = 'a1b2c3d4-3333-4000-8000-000000001000';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'David Nkemdirim' AND organization_id = 'a1b2c3d4-2222-4000-8000-000000003903';
UPDATE organization_members SET location = 'Ottawa, ON' WHERE name = 'David Nkemdirim' AND organization_id = 'a1b2c3d4-1111-4000-8000-000000000079';

-- Catch-all: set any remaining NULL locations
UPDATE organization_members SET location = 'Ottawa, ON'
  WHERE location IS NULL AND deleted_at IS NULL
  AND name NOT LIKE 'Platform Admin%';
