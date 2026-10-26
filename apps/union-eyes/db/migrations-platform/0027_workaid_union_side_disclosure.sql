-- PLATFORM_SQL 0027_workaid_union_side_disclosure
--
-- Union-side storage for the WorkAid consent and disclosure boundary (register UE-CONV-G-002). It holds REFERENCES and
-- AUTHORISATIONS only, never counsel content and never counsel-side state. RLS is scoped by cache 0026; exact DML comes
-- from the storage-authority manifest (db/rls-storage-authority/authority-kernel.ts). Every relation reuses the kernel's
-- recording trigger, so each insert or update lands in ue_authority_events and a deferred constraint refuses COMMIT
-- unless the canonical audit chain names it.
--
--   ue_authority_workaid_consent_texts      institution-recorded, versioned consent wording. The body hash is enforced
--                                           by the database. Nothing is captured against text nobody recorded.
--   ue_authority_workaid_consent_grants     one row per consent: the exact text version and hash the member
--                                           acknowledged and the underlying case. The matter id is a server-generated
--                                           random uuid derived from nothing about the member or the case; it is the
--                                           only matter identifier counsel is given (and what its assertions bind to).
--   ue_authority_workaid_document_auths     per-document authorisation by the member, bounded by the consent, immediate
--                                           on revocation.
--   ue_authority_workaid_shares             what the union has released toward counsel (categories or one document).
--                                           Invalidated in the same transaction as the consent or document revocation.
--   ue_authority_workaid_counsel_access     append-only record of every manifest served to a verified counsel session.
--
-- NOT provided here, and not provided anywhere in this repository: the counsel-side system, its signature issuer
-- allow-list (counsel-side activation) and key custody (UE-CONV-G-003). Without a configured counsel verifier no
-- counsel access succeeds.

DO $$
BEGIN
  IF to_regclass('public.ue_authority_workaid_matters') IS NULL
     OR to_regclass('public.ue_authority_disclosure_consents') IS NULL
     OR to_regclass('public.ue_authority_events') IS NULL
     OR to_regprocedure('ue_authority_record_event()') IS NULL
     OR to_regprocedure('ue_authority_guard_update()') IS NULL
     OR to_regprocedure('ue_authority_guard_actor()') IS NULL
     OR to_regprocedure('ue_authority_block_mutation()') IS NULL THEN
    RAISE EXCEPTION 'platform 0027 fail-closed: the authority kernel storage (platform 0013) is not installed.';
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS ue_authority_workaid_consent_texts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  version text NOT NULL,
  body text NOT NULL,
  body_sha256 text NOT NULL,
  recorded_by ue_authority_principal NOT NULL,
  effective_at timestamptz NOT NULL,
  retired_at timestamptz,
  retired_by ue_authority_principal,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ue_authority_wa_text_version_chk CHECK (version ~ '^[A-Za-z0-9._-]{1,64}$'),
  CONSTRAINT ue_authority_wa_text_body_chk CHECK (length(btrim(body)) > 0),
  CONSTRAINT ue_authority_wa_text_hash_chk CHECK (body_sha256 = encode(sha256(convert_to(body, 'UTF8')), 'hex')),
  CONSTRAINT ue_authority_wa_text_retired_chk CHECK ((retired_at IS NULL) = (retired_by IS NULL)),
  CONSTRAINT ue_authority_wa_text_version_uq UNIQUE (organization_id, version)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS ue_authority_workaid_consent_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  consent_id uuid NOT NULL REFERENCES ue_authority_disclosure_consents (id),
  matter_id uuid NOT NULL,
  case_id uuid NOT NULL,
  member_user_id ue_authority_principal NOT NULL,
  text_id uuid NOT NULL REFERENCES ue_authority_workaid_consent_texts (id),
  text_version text NOT NULL,
  text_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ue_authority_wa_grant_consent_uq UNIQUE (consent_id),
  CONSTRAINT ue_authority_wa_grant_matter_uq UNIQUE (organization_id, matter_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ue_authority_wa_grant_member_idx ON ue_authority_workaid_consent_grants (organization_id, member_user_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS ue_authority_workaid_document_auths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  matter_id uuid NOT NULL,
  consent_id uuid NOT NULL REFERENCES ue_authority_disclosure_consents (id),
  document_id uuid NOT NULL,
  classification text NOT NULL,
  authorised_by ue_authority_principal NOT NULL,
  authorised_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by ue_authority_principal,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Only the member's own submissions and records the institution has formally released may ever be authorised.
  CONSTRAINT ue_authority_wa_docauth_class_chk CHECK (classification IN ('member_submission', 'member_disclosable')),
  CONSTRAINT ue_authority_wa_docauth_term_chk CHECK (expires_at > authorised_at),
  CONSTRAINT ue_authority_wa_docauth_revoked_chk CHECK ((revoked_at IS NULL) = (revoked_by IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ue_authority_wa_docauth_live_uq ON ue_authority_workaid_document_auths (organization_id, matter_id, document_id) WHERE revoked_at IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS ue_authority_workaid_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  matter_id uuid NOT NULL REFERENCES ue_authority_workaid_matters (id),
  consent_id uuid NOT NULL REFERENCES ue_authority_disclosure_consents (id),
  kind text NOT NULL,
  categories text[] NOT NULL,
  document_auth_id uuid REFERENCES ue_authority_workaid_document_auths (id),
  created_by ue_authority_principal NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  invalidated_at timestamptz,
  invalidated_by ue_authority_principal,
  invalidation_reason text,
  CONSTRAINT ue_authority_wa_share_kind_chk CHECK (kind IN ('categories', 'document')),
  CONSTRAINT ue_authority_wa_share_cats_chk CHECK (cardinality(categories) > 0 AND NOT ('*' = ANY (categories))),
  CONSTRAINT ue_authority_wa_share_doc_chk CHECK ((kind = 'document') = (document_auth_id IS NOT NULL) AND (kind <> 'document' OR categories = ARRAY['documents']::text[])),
  CONSTRAINT ue_authority_wa_share_invalid_chk CHECK (
    (invalidated_at IS NULL) = (invalidated_by IS NULL) AND (invalidated_at IS NULL) = (invalidation_reason IS NULL)
  ),
  CONSTRAINT ue_authority_wa_share_reason_chk CHECK (invalidation_reason IS NULL OR invalidation_reason IN ('consent_revoked', 'document_authorisation_revoked'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ue_authority_wa_share_matter_idx ON ue_authority_workaid_shares (organization_id, matter_id) WHERE invalidated_at IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS ue_authority_workaid_counsel_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  matter_id uuid NOT NULL REFERENCES ue_authority_workaid_matters (id),
  counsel_user_id ue_authority_principal NOT NULL,
  shares_served integer NOT NULL,
  accessed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ue_authority_wa_access_count_chk CHECK (shares_served >= 0)
);
--> statement-breakpoint

-- A consent grant is only valid against the member's own union_to_workaid consent for the same matter, and recorded
-- wording whose hash and version match what the member acknowledged.
CREATE OR REPLACE FUNCTION ue_authority_guard_workaid_grant() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  c ue_authority_disclosure_consents%ROWTYPE;
  t ue_authority_workaid_consent_texts%ROWTYPE;
BEGIN
  SELECT * INTO c FROM ue_authority_disclosure_consents WHERE id = NEW.consent_id;
  IF NOT FOUND OR c.organization_id <> NEW.organization_id OR c.matter_id <> NEW.matter_id
     OR c.member_user_id <> NEW.member_user_id OR c.direction <> 'union_to_workaid' OR c.issuer <> 'member' THEN
    RAISE EXCEPTION 'WORKAID_GRANT_INVALID: the grant must reference the member''s own union_to_workaid consent for this matter' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO t FROM ue_authority_workaid_consent_texts WHERE id = NEW.text_id;
  IF NOT FOUND OR t.organization_id <> NEW.organization_id OR t.version <> NEW.text_version OR t.body_sha256 <> NEW.text_sha256 OR t.retired_at IS NOT NULL THEN
    RAISE EXCEPTION 'WORKAID_GRANT_INVALID: the consent wording is not a current recorded version with this hash' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$fn$;
--> statement-breakpoint

-- A document authorisation is the member's own act, inside the consent's term and category scope.
CREATE OR REPLACE FUNCTION ue_authority_guard_workaid_docauth() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  g ue_authority_workaid_consent_grants%ROWTYPE;
  c ue_authority_disclosure_consents%ROWTYPE;
BEGIN
  SELECT * INTO g FROM ue_authority_workaid_consent_grants WHERE consent_id = NEW.consent_id;
  IF NOT FOUND OR g.organization_id <> NEW.organization_id OR g.matter_id <> NEW.matter_id OR g.member_user_id <> NEW.authorised_by THEN
    RAISE EXCEPTION 'WORKAID_DOCAUTH_INVALID: only the consenting member may authorise a document for this matter' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO c FROM ue_authority_disclosure_consents WHERE id = NEW.consent_id;
  IF c.revoked_at IS NOT NULL OR c.expires_at <= now() OR NOT ('documents' = ANY (c.categories)) OR NEW.expires_at > c.expires_at THEN
    RAISE EXCEPTION 'WORKAID_DOCAUTH_INVALID: the consent is not live, does not cover documents, or expires before this authorisation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$fn$;
--> statement-breakpoint

-- A share can only be created while the matter is referred and unwithdrawn, the consent is live and covers every
-- category, and (for a document) its authorisation is live for the same matter.
CREATE OR REPLACE FUNCTION ue_authority_guard_workaid_share() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  m ue_authority_workaid_matters%ROWTYPE;
  c ue_authority_disclosure_consents%ROWTYPE;
  a ue_authority_workaid_document_auths%ROWTYPE;
BEGIN
  SELECT * INTO m FROM ue_authority_workaid_matters WHERE id = NEW.matter_id;
  IF NOT FOUND OR m.organization_id <> NEW.organization_id OR m.withdrawn_at IS NOT NULL THEN
    RAISE EXCEPTION 'WORKAID_SHARE_INVALID: the matter is unknown or withdrawn' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO c FROM ue_authority_disclosure_consents WHERE id = NEW.consent_id;
  IF NOT FOUND OR c.organization_id <> NEW.organization_id OR c.matter_id <> NEW.matter_id OR c.direction <> 'union_to_workaid'
     OR c.revoked_at IS NOT NULL OR c.expires_at <= now() OR NOT (NEW.categories <@ c.categories) THEN
    RAISE EXCEPTION 'WORKAID_SHARE_INVALID: the consent is not live or does not cover every category' USING ERRCODE = '23514';
  END IF;
  IF NEW.document_auth_id IS NOT NULL THEN
    SELECT * INTO a FROM ue_authority_workaid_document_auths WHERE id = NEW.document_auth_id;
    IF NOT FOUND OR a.organization_id <> NEW.organization_id OR a.matter_id <> NEW.matter_id OR a.consent_id <> NEW.consent_id
       OR a.revoked_at IS NOT NULL OR a.expires_at <= now() THEN
      RAISE EXCEPTION 'WORKAID_SHARE_INVALID: the document is not authorised for this matter' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;
--> statement-breakpoint

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'ue_authority_workaid_consent_texts', 'ue_authority_workaid_consent_grants', 'ue_authority_workaid_document_auths',
    'ue_authority_workaid_shares', 'ue_authority_workaid_counsel_access'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS ue_authority_no_delete ON %I', tbl);
    EXECUTE format('CREATE TRIGGER ue_authority_no_delete BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION ue_authority_block_mutation()', tbl);
    EXECUTE format('DROP TRIGGER IF EXISTS ue_authority_no_truncate ON %I', tbl);
    EXECUTE format('CREATE TRIGGER ue_authority_no_truncate BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION ue_authority_block_mutation()', tbl);
    EXECUTE format('DROP TRIGGER IF EXISTS ue_authority_record_event ON %I', tbl);
    EXECUTE format('CREATE TRIGGER ue_authority_record_event AFTER INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION ue_authority_record_event()', tbl);
  END LOOP;
END $$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS ue_authority_guard_update ON ue_authority_workaid_consent_texts;
--> statement-breakpoint
CREATE TRIGGER ue_authority_guard_update BEFORE UPDATE ON ue_authority_workaid_consent_texts FOR EACH ROW EXECUTE FUNCTION ue_authority_guard_update('retired_at', 'retired_at,retired_by');
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_authority_guard_update ON ue_authority_workaid_consent_grants;
--> statement-breakpoint
CREATE TRIGGER ue_authority_guard_update BEFORE UPDATE ON ue_authority_workaid_consent_grants FOR EACH ROW EXECUTE FUNCTION ue_authority_block_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_authority_guard_insert ON ue_authority_workaid_consent_grants;
--> statement-breakpoint
CREATE TRIGGER ue_authority_guard_insert BEFORE INSERT ON ue_authority_workaid_consent_grants FOR EACH ROW EXECUTE FUNCTION ue_authority_guard_workaid_grant();
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_authority_guard_update ON ue_authority_workaid_document_auths;
--> statement-breakpoint
CREATE TRIGGER ue_authority_guard_update BEFORE UPDATE ON ue_authority_workaid_document_auths FOR EACH ROW EXECUTE FUNCTION ue_authority_guard_update('revoked_at', 'revoked_at,revoked_by');
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_authority_guard_insert ON ue_authority_workaid_document_auths;
--> statement-breakpoint
CREATE TRIGGER ue_authority_guard_insert BEFORE INSERT ON ue_authority_workaid_document_auths FOR EACH ROW EXECUTE FUNCTION ue_authority_guard_workaid_docauth();
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_authority_guard_update ON ue_authority_workaid_shares;
--> statement-breakpoint
CREATE TRIGGER ue_authority_guard_update BEFORE UPDATE ON ue_authority_workaid_shares FOR EACH ROW EXECUTE FUNCTION ue_authority_guard_update('invalidated_at', 'invalidated_at,invalidated_by,invalidation_reason');
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_authority_guard_insert ON ue_authority_workaid_shares;
--> statement-breakpoint
CREATE TRIGGER ue_authority_guard_insert BEFORE INSERT ON ue_authority_workaid_shares FOR EACH ROW EXECUTE FUNCTION ue_authority_guard_workaid_share();
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_authority_guard_update ON ue_authority_workaid_counsel_access;
--> statement-breakpoint
CREATE TRIGGER ue_authority_guard_update BEFORE UPDATE ON ue_authority_workaid_counsel_access FOR EACH ROW EXECUTE FUNCTION ue_authority_block_mutation();
--> statement-breakpoint

-- Whoever a row says acted MUST be the authenticated principal of the transaction (see ue_authority_guard_actor).
DO $$
DECLARE
  spec text[];
BEGIN
  FOREACH spec SLICE 1 IN ARRAY ARRAY[
    ARRAY['ue_authority_workaid_consent_texts', 'recorded_by', 'retired_by'],
    ARRAY['ue_authority_workaid_consent_grants', 'member_user_id', ''],
    ARRAY['ue_authority_workaid_document_auths', 'authorised_by', 'revoked_by'],
    ARRAY['ue_authority_workaid_shares', 'created_by', 'invalidated_by'],
    ARRAY['ue_authority_workaid_counsel_access', 'counsel_user_id', '']
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS ue_authority_guard_actor ON %I', spec[1]);
    EXECUTE format('CREATE TRIGGER ue_authority_guard_actor BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION ue_authority_guard_actor(%L, %L)', spec[1], spec[2], spec[3]);
  END LOOP;
END $$;
