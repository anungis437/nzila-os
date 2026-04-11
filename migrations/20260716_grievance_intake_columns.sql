-- Grievance intake form: add missing columns for member, workplace, and sensitivity flags
-- These columns capture data collected by the intake form that was previously not persisted.

ALTER TABLE grievances
  ADD COLUMN IF NOT EXISTS member_phone        VARCHAR(50),
  ADD COLUMN IF NOT EXISTS member_number       VARCHAR(100),
  ADD COLUMN IF NOT EXISTS local_chapter       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS department          VARCHAR(255),
  ADD COLUMN IF NOT EXISTS branch              VARCHAR(255),
  ADD COLUMN IF NOT EXISTS supervisor_name     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS incident_location   VARCHAR(500),
  ADD COLUMN IF NOT EXISTS workplace_safety_flag  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS harassment_flag        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS discrimination_flag    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS accommodation_flag     BOOLEAN DEFAULT FALSE;
