-- Rollback for 0045_contact_submissions: the table holds submitted contact details; export or delete them deliberately first.
DROP TABLE IF EXISTS public.contact_submissions;
