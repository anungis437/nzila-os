-- PLATFORM_SQL 0033_election_certificate_successions
-- UNQUALIFIED. Do not apply from Cursor. Native execution is READY_FOR_VS_EXECUTION.
--
-- A certified council_elections row stays immutable. A correction is a new uncertified
-- election plus a succession row that names the certified predecessor, the version,
-- the provenance hash of the certified facts, the distinct issuer and reviewer, and
-- the decision, dispute and recount references. Replaying the same predecessor,
-- provenance and decision returns the existing row. This migration does not rewrite
-- a certified column, does not drop a relation, and does not send a notification.

DO $$
BEGIN
  IF to_regclass('public.council_elections') IS NULL THEN
    RAISE EXCEPTION 'platform 0033 fail-closed: council_elections does not exist.';
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.election_certificate_successions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  predecessor_election_id uuid NOT NULL REFERENCES public.council_elections (id),
  successor_election_id uuid NOT NULL REFERENCES public.council_elections (id),
  version integer NOT NULL,
  provenance_hash text NOT NULL,
  dispute_reference text,
  recount_reference text,
  issuer_user_id text NOT NULL,
  reviewer_user_id text NOT NULL,
  decision_reference text NOT NULL,
  institutional_notice text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT election_certificate_successions_version_chk CHECK (version >= 1),
  CONSTRAINT election_certificate_successions_hash_chk CHECK (provenance_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT election_certificate_successions_distinct_officers_chk CHECK (issuer_user_id <> reviewer_user_id),
  CONSTRAINT election_certificate_successions_distinct_elections_chk CHECK (predecessor_election_id <> successor_election_id),
  CONSTRAINT election_certificate_successions_notice_chk CHECK (institutional_notice IS NULL OR institutional_notice = 'required_not_sent'),
  CONSTRAINT election_certificate_successions_reference_chk CHECK (char_length(decision_reference) BETWEEN 1 AND 200)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS election_certificate_successions_predecessor_version_uidx
  ON public.election_certificate_successions (predecessor_election_id, version);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS election_certificate_successions_successor_uidx
  ON public.election_certificate_successions (successor_election_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS election_certificate_successions_replay_uidx
  ON public.election_certificate_successions (predecessor_election_id, provenance_hash, decision_reference);
