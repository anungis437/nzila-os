/** Current-source external read authority. Installation is additive and must be
 * admitted by the existing canonical catalog/bootstrap, never replayed as a
 * migration or used to grant runtime access to the retained legacy tables. */
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core'
import { externalReadConsents, externalReadQualifications } from '../../db/schema/domains/documents/external-read'
import { EXTERNAL_AUDIT_JSON_BODY } from './audit-contract'
import { EXTERNAL_READ_QUALIFICATION } from './qualification'
import { EXTERNAL_INSTITUTIONAL_COLUMN_GRANTS, EXTERNAL_AUTHORITY_EVENT_BODY, EXTERNAL_APPROVAL_VALID_BODY, EXTERNAL_OFFICE_VALID_BODY, EXTERNAL_INSTITUTION_VALID_BODY, EXTERNAL_APPROVAL_GUARD_BODY, EXTERNAL_INSTITUTION_LOCK_BODY, EXTERNAL_AUTHORIZER_SCOPE_BODY } from './institutional-source'
import { CASE_AUTHORITY_READER_ROLE } from '../../db/auth/case-authority-reader-schema'

export const EXTERNAL_READ_OWNER = 'ue_external_read_reader'
export const EXTERNAL_READ_SOURCE_PATH = 'apps/union-eyes/lib/external-resource-read/source.ts'
export const EXTERNAL_READ_STORAGE_TABLES = ['ue_external_read_consents', 'ue_external_read_qualifications'] as const
const ownColumns = (table: PgTable) => getTableConfig(table).columns.map(column => column.name)
/** Fixed column contract. Private roles remain NOLOGIN/NOINHERIT with no role
 * memberships; ordinary callers receive only fixed-function EXECUTE. */
export const EXTERNAL_READ_COLUMN_GRANTS = [
  { table: 'ue_external_read_consents', select: ownColumns(externalReadConsents), insert: ownColumns(externalReadConsents), update: ['revoked_at', 'revoked_by'] },
  { table: 'ue_external_read_qualifications', select: ownColumns(externalReadQualifications), insert: ownColumns(externalReadQualifications), update: ['revoked_at', 'revoked_by'] },
  { table: 'representation_authorities', select: ['id', 'organization_id', 'matter_type', 'matter_id', 'represented_person_id', 'representative_user_id', 'representative_organization_id', 'scope', 'source', 'status', 'effective_at', 'expires_at', 'revoked_at', 'revoked_by', 'superseded_by_authority_id', 'evidence_document_id', 'created_by'] },
  { table: 'external_matter_access_grants', select: ['id', 'authority_id', 'organization_id', 'matter_type', 'matter_id', 'user_id', 'representative_organization_id', 'status', 'can_view', 'can_view_documents', 'can_download_documents', 'expires_at', 'revoked_at', 'revoked_by', 'granted_by', 'granted_at'] },
  { table: 'external_document_access_grants', select: ['id', 'authority_id', 'matter_grant_id', 'organization_id', 'matter_type', 'matter_id', 'document_id', 'user_id', 'representative_organization_id', 'status', 'can_view', 'can_download', 'document_version_no', 'expires_at', 'revoked_at', 'revoked_by', 'granted_by', 'granted_at'] },
  { table: 'grievances', select: ['id', 'organization_id', 'represented_member_user_id', 'grievant_id', 'grievance_number', 'title', 'status', 'step', 'filed_date', 'response_deadline', 'has_legal_implications'] },
  { table: 'documents', select: ['id', 'organization_id', 'title', 'name', 'filename', 'document_type', 'mime_type', 'privacy_label', 'uploaded_at', 'created_at', 'status', 'deleted_at', 'contains_medical_sensitive', 'contains_legal_privilege', 'medical_sensitive'] },
  { table: 'document_versions', select: ['id', 'organization_id', 'document_id', 'version_no', 'storage_key', 'content_hash'] },
  { table: 'document_links', select: ['id', 'organization_id', 'document_id', 'linked_entity_type', 'linked_entity_id'] },
  ...EXTERNAL_INSTITUTIONAL_COLUMN_GRANTS,
  { table: 'case_authority_scopes', select: ['id', 'organization_id', 'case_id'] },
  { table: 'case_respondents', select: ['id', 'organization_id', 'scope_id', 'respondent_user_id', 'recorded_at', 'recorded_by', 'revoked_at', 'revoked_by', 'revoked_proposal_id'] },
  { table: 'audit_logs', select: ['id', 'organization_id', 'created_at', 'content_hash', 'action', 'resource_type', 'resource_id', 'user_id', 'correlation_id', 'details', 'previous_hash'],
    insert: ['id', 'audit_id', 'created_at', 'updated_at', 'organization_id', 'action', 'resource_type', 'resource_id', 'user_id', 'details', 'changes', 'content_hash', 'previous_hash'] },
] as const
const selectedColumns = (table: string) => {
  const grant = EXTERNAL_READ_COLUMN_GRANTS.find(entry => entry.table === table)
  if (!grant) throw new Error('External read source columns unavailable')
  return grant.select.join(',')
}
export const EXTERNAL_READ_PREREQUISITE_CONTRACTS = [
  { schema: 'user_management', name: 'auth_business_org_authorized', args: 'uuid,text[]', argumentTypes: '2950 1009' },
  { schema: 'public', name: 'ue_case_domain_authorized', args: 'uuid,uuid,text', argumentTypes: '2950 2950 25' },
  { schema: 'user_management', name: 'ue_authority_membership_rows', args: 'uuid,text[]', argumentTypes: '2950 1009' },
] as const
export const EXTERNAL_READ_PREREQUISITE_FUNCTIONS = EXTERNAL_READ_PREREQUISITE_CONTRACTS.map(fn => `${fn.schema}.${fn.name}(${fn.args})`)

const context = `NULLIF(current_setting('ue.external_read_org',true),'')`
const actor = `NULLIF(current_setting('app.current_user_id',true),'')`
const liveTerm = (alias: string) => `${alias}.revoked_at IS NULL AND ${alias}.revoked_by IS NULL AND isfinite(${alias}.effective_at)
  AND isfinite(${alias}.expires_at) AND ${alias}.effective_at<=checked_at AND ${alias}.expires_at>checked_at AND ${alias}.expires_at>${alias}.effective_at`
const saved = `prior_org text:=current_setting('ue.external_read_org',true);`
const restore = `PERFORM set_config('ue.external_read_org',COALESCE(prior_org,''),true);`
const lock = `PERFORM pg_advisory_xact_lock(hashtextextended('ue.external-read-institution:'||row_org::text,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('ue.external-read:'||row_org::text||':'||case_id::text,0));`

export const EXTERNAL_READ_PAYLOAD_VALID_BODY = `
DECLARE doc jsonb:=p->'document'; value text;
BEGIN
  IF jsonb_typeof(p)<>'object' OR p->>'operation'<>'${EXTERNAL_READ_QUALIFICATION}'
    OR NOT p ?& ARRAY['operation','qualificationId','institutionalApprovalId','organizationId','representativeUserId','representativeOrganizationId','representedMemberUserId','issuerUserId','authority','matter','document','sourceInstrument','effectiveAt','expiresAt']
    OR p-ARRAY['operation','qualificationId','institutionalApprovalId','organizationId','representativeUserId','representativeOrganizationId','representedMemberUserId','issuerUserId','authority','matter','document','sourceInstrument','effectiveAt','expiresAt']<>'{}'::jsonb
    OR jsonb_typeof(p->'authority')<>'object' OR jsonb_typeof(p->'matter')<>'object' OR jsonb_typeof(p->'sourceInstrument')<>'object'
    OR NOT(p->'authority') ?& ARRAY['id','representedPersonId','createdBy','source','scope','evidenceDocumentId','effectiveAt','expiresAt']
    OR (p->'authority')-ARRAY['id','representedPersonId','createdBy','source','scope','evidenceDocumentId','effectiveAt','expiresAt']<>'{}'::jsonb
    OR NOT(p->'matter') ?& ARRAY['type','id','grantId','grantedBy','grantedAt','expiresAt','permissions']
    OR (p->'matter')-ARRAY['type','id','grantId','grantedBy','grantedAt','expiresAt','permissions']<>'{}'::jsonb
    OR (p->'sourceInstrument')-ARRAY['reference','sha256']<>'{}'::jsonb
    OR length(btrim(p->'sourceInstrument'->>'reference')) NOT BETWEEN 1 AND 2000 OR p->'sourceInstrument'->>'sha256' !~ '^[a-f0-9]{64}$'
    OR p->'matter'->>'type'<>'grievance'
    OR p->>'organizationId'=p->>'representativeOrganizationId' OR p->>'representativeUserId'=p->>'representedMemberUserId'
    OR p->>'representativeUserId' IN (p->>'issuerUserId',p->'authority'->>'createdBy',p->'matter'->>'grantedBy',COALESCE(doc->>'grantedBy',''))
    OR jsonb_typeof(p->'authority'->'scope')<>'array' OR jsonb_array_length(p->'authority'->'scope')<1
    OR EXISTS(SELECT FROM jsonb_array_elements(p->'authority'->'scope') e WHERE jsonb_typeof(e)<>'string' OR length(btrim(e#>>'{}'))=0)
    OR jsonb_array_length(p->'authority'->'scope')<>(SELECT count(DISTINCT e) FROM jsonb_array_elements(p->'authority'->'scope') e)
    OR (p->'matter'->'permissions')-ARRAY['view','viewDocuments','downloadDocuments']<>'{}'::jsonb
    OR NOT(p->'matter'->'permissions') ?& ARRAY['view','viewDocuments','downloadDocuments']
    OR EXISTS(SELECT FROM jsonb_each(p->'matter'->'permissions') e WHERE jsonb_typeof(e.value)<>'boolean')
    THEN RETURN false; END IF;
  FOREACH value IN ARRAY ARRAY[p->>'representativeUserId',p->>'representedMemberUserId',p->>'issuerUserId',p->'authority'->>'createdBy',p->'matter'->>'grantedBy'] LOOP
    IF value IS NULL OR length(value) NOT BETWEEN 1 AND 255 OR value<>btrim(value) OR value ~ '[[:cntrl:]]' THEN RETURN false; END IF;
  END LOOP;
  IF EXISTS(SELECT FROM jsonb_each(p) e WHERE e.key NOT IN('authority','matter','document','sourceInstrument') AND jsonb_typeof(e.value)<>'string')
    OR EXISTS(SELECT FROM jsonb_each(p->'authority') e WHERE e.key NOT IN('scope','evidenceDocumentId') AND jsonb_typeof(e.value)<>'string')
    OR EXISTS(SELECT FROM jsonb_each(p->'matter') e WHERE e.key<>'permissions' AND jsonb_typeof(e.value)<>'string')
    OR EXISTS(SELECT FROM jsonb_each(p->'sourceInstrument') e WHERE jsonb_typeof(e.value)<>'string')
    OR NOT(p->'sourceInstrument') ?& ARRAY['reference','sha256']
    OR jsonb_typeof(p->'authority'->'evidenceDocumentId') NOT IN('string','null') THEN RETURN false; END IF;
  PERFORM (p->>'qualificationId')::uuid,(p->>'institutionalApprovalId')::uuid,(p->>'organizationId')::uuid,(p->>'representativeOrganizationId')::uuid,
    (p->'authority'->>'id')::uuid,(p->'authority'->>'representedPersonId')::uuid,(p->'matter'->>'id')::uuid,(p->'matter'->>'grantId')::uuid;
  IF NOT isfinite((p->>'effectiveAt')::timestamptz) OR NOT isfinite((p->>'expiresAt')::timestamptz)
    OR (p->>'effectiveAt')::timestamptz>=(p->>'expiresAt')::timestamptz THEN RETURN false; END IF;
  IF doc<>'null'::jsonb THEN
    IF jsonb_typeof(doc)<>'object' OR NOT doc ?& ARRAY['id','grantId','grantedBy','grantedAt','expiresAt','canView','canDownload','versionId','versionNo','checksumSha256','sizeBytes','storageKeySha256','privacyLabel']
      OR doc-ARRAY['id','grantId','grantedBy','grantedAt','expiresAt','canView','canDownload','versionId','versionNo','checksumSha256','sizeBytes','storageKeySha256','privacyLabel']<>'{}'::jsonb
      OR jsonb_typeof(doc->'canView')<>'boolean' OR jsonb_typeof(doc->'canDownload')<>'boolean'
      OR doc->>'checksumSha256' !~ '^[a-f0-9]{64}$' OR doc->>'storageKeySha256' !~ '^[a-f0-9]{64}$'
      OR jsonb_typeof(doc->'sizeBytes')<>'number' OR (doc->>'sizeBytes')::numeric<>trunc((doc->>'sizeBytes')::numeric)
      OR (doc->>'sizeBytes')::numeric NOT BETWEEN 0 AND 52428800 OR (doc->>'versionNo')::numeric<>trunc((doc->>'versionNo')::numeric)
      OR (doc->>'versionNo')::numeric NOT BETWEEN 1 AND 2147483647
      OR ((doc->>'canDownload')::boolean AND NOT(p->'matter'->'permissions'->>'downloadDocuments')::boolean)
      OR ((doc->>'canView')::boolean AND NOT(p->'matter'->'permissions'->>'viewDocuments')::boolean)
      THEN RETURN false; END IF;
    PERFORM (doc->>'id')::uuid,(doc->>'grantId')::uuid,(doc->>'versionId')::uuid;
    IF EXISTS(SELECT FROM jsonb_each(doc) e WHERE e.key NOT IN('canView','canDownload','sizeBytes','versionNo') AND jsonb_typeof(e.value)<>'string')
      OR length(btrim(doc->>'grantedBy')) NOT BETWEEN 1 AND 255 THEN RETURN false; END IF;
  ELSIF (p->'matter'->'permissions'->>'viewDocuments')::boolean OR (p->'matter'->'permissions'->>'downloadDocuments')::boolean THEN RETURN false;
  END IF;
  RETURN true;
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow OR numeric_value_out_of_range THEN RETURN false;
END;
`

export const EXTERNAL_READ_SOURCES_MATCH_BODY = `
DECLARE checked_at timestamptz:=clock_timestamp(); a record; m record; d record; v record; g record; dg record;
  row_org uuid:=(p->>'organizationId')::uuid;case_id uuid:=(p->'matter'->>'id')::uuid;
BEGIN
  IF public.ue_external_payload_valid(p) IS NOT TRUE THEN RETURN false; END IF;
  SELECT id,represented_member_user_id,grievant_id,has_legal_implications INTO g FROM public.grievances WHERE organization_id=row_org AND id=case_id;
  IF NOT FOUND OR g.represented_member_user_id IS DISTINCT FROM p->>'representedMemberUserId'
    OR g.grievant_id IS NULL OR g.grievant_id::text IS DISTINCT FROM g.represented_member_user_id
    OR g.grievant_id IS DISTINCT FROM (p->'authority'->>'representedPersonId')::uuid
    OR COALESCE(g.has_legal_implications,false) THEN RETURN false; END IF;
  SELECT ${selectedColumns('representation_authorities')} INTO a FROM public.representation_authorities WHERE id=(p->'authority'->>'id')::uuid AND organization_id=row_org;
  IF NOT FOUND OR a.matter_type::text<>'grievance' OR a.matter_id<>case_id OR a.represented_person_id<>(p->'authority'->>'representedPersonId')::uuid
    OR a.representative_user_id<>p->>'representativeUserId' OR a.representative_organization_id<>(p->>'representativeOrganizationId')::uuid
    OR a.status::text<>'active' OR a.revoked_at IS NOT NULL OR a.revoked_by IS NOT NULL OR a.superseded_by_authority_id IS NOT NULL
    OR NOT isfinite(a.effective_at) OR NOT isfinite(a.expires_at) OR a.effective_at>checked_at OR a.expires_at<=checked_at
    OR a.effective_at IS DISTINCT FROM (p->'authority'->>'effectiveAt')::timestamptz OR a.expires_at IS DISTINCT FROM (p->'authority'->>'expiresAt')::timestamptz
    OR a.created_by<>p->'authority'->>'createdBy' OR a.source<>p->'authority'->>'source' OR to_jsonb(a.scope) IS DISTINCT FROM p->'authority'->'scope'
    OR a.evidence_document_id IS DISTINCT FROM (p->'authority'->>'evidenceDocumentId')::uuid THEN RETURN false; END IF;
  SELECT ${selectedColumns('external_matter_access_grants')} INTO m FROM public.external_matter_access_grants WHERE id=(p->'matter'->>'grantId')::uuid AND organization_id=row_org;
  IF NOT FOUND OR m.authority_id<>a.id OR m.matter_type::text<>'grievance' OR m.matter_id<>case_id OR m.user_id<>a.representative_user_id
    OR m.representative_organization_id<>a.representative_organization_id OR m.status::text<>'active' OR m.revoked_at IS NOT NULL OR m.revoked_by IS NOT NULL
    OR NOT isfinite(m.granted_at) OR NOT isfinite(m.expires_at) OR m.granted_at>checked_at OR m.expires_at<=checked_at
    OR m.granted_by<>p->'matter'->>'grantedBy' OR m.granted_at IS DISTINCT FROM (p->'matter'->>'grantedAt')::timestamptz
    OR m.expires_at IS DISTINCT FROM (p->'matter'->>'expiresAt')::timestamptz
    OR m.can_view IS DISTINCT FROM (p->'matter'->'permissions'->>'view')::boolean
    OR m.can_view_documents IS DISTINCT FROM (p->'matter'->'permissions'->>'viewDocuments')::boolean
    OR m.can_download_documents IS DISTINCT FROM (p->'matter'->'permissions'->>'downloadDocuments')::boolean THEN RETURN false; END IF;
  IF (p->>'effectiveAt')::timestamptz<a.effective_at OR (p->>'effectiveAt')::timestamptz<m.granted_at
    OR (p->>'expiresAt')::timestamptz>a.expires_at OR (p->>'expiresAt')::timestamptz>m.expires_at THEN RETURN false; END IF;
  IF p->'document'<>'null'::jsonb THEN
    SELECT ${selectedColumns('external_document_access_grants')} INTO dg FROM public.external_document_access_grants WHERE id=(p->'document'->>'grantId')::uuid AND organization_id=row_org;
    IF NOT FOUND OR dg.authority_id<>a.id OR dg.matter_grant_id<>m.id OR dg.user_id<>a.representative_user_id
      OR dg.representative_organization_id<>a.representative_organization_id OR dg.matter_id<>case_id OR dg.matter_type::text<>'grievance'
      OR dg.document_id<>(p->'document'->>'id')::uuid OR dg.status::text<>'active' OR dg.revoked_at IS NOT NULL OR dg.revoked_by IS NOT NULL
      OR dg.can_view IS DISTINCT FROM (p->'document'->>'canView')::boolean OR dg.can_download IS DISTINCT FROM (p->'document'->>'canDownload')::boolean
      OR dg.document_version_no IS DISTINCT FROM (p->'document'->>'versionNo')::integer OR NOT isfinite(dg.expires_at)
      OR dg.expires_at<=checked_at OR NOT isfinite(dg.granted_at) OR dg.granted_at>checked_at
      OR dg.granted_by<>p->'document'->>'grantedBy' OR dg.granted_at IS DISTINCT FROM (p->'document'->>'grantedAt')::timestamptz
      OR dg.expires_at IS DISTINCT FROM (p->'document'->>'expiresAt')::timestamptz
      OR (p->>'effectiveAt')::timestamptz<dg.granted_at OR (p->>'expiresAt')::timestamptz>dg.expires_at THEN RETURN false; END IF;
    SELECT ${selectedColumns('documents')} INTO d FROM public.documents WHERE organization_id=row_org AND id=dg.document_id;
    IF NOT FOUND OR d.status::text<>'active' OR d.deleted_at IS NOT NULL OR d.privacy_label::text<>p->'document'->>'privacyLabel'
      OR d.privacy_label::text IN('privileged','highly_sensitive') OR d.contains_legal_privilege OR d.contains_medical_sensitive OR d.medical_sensitive
      OR NOT EXISTS(SELECT FROM public.document_links WHERE organization_id=row_org AND document_id=d.id AND linked_entity_type::text='grievance' AND linked_entity_id=case_id) THEN RETURN false; END IF;
    SELECT ${selectedColumns('document_versions')} INTO v FROM public.document_versions WHERE organization_id=row_org AND document_id=d.id AND id=(p->'document'->>'versionId')::uuid;
    IF NOT FOUND OR v.version_no<>(p->'document'->>'versionNo')::integer OR v.content_hash<>p->'document'->>'checksumSha256'
      OR encode(sha256(convert_to(v.storage_key,'UTF8')),'hex')<>p->'document'->>'storageKeySha256' THEN RETURN false; END IF;
  END IF;
  RETURN true;
END;
`

export const EXTERNAL_READ_AUDIT_BODY = `
DECLARE prior_hash text; content text; stamp timestamptz; entry_id uuid:=gen_random_uuid();
BEGIN
  IF row_org::text IS DISTINCT FROM ${context} OR ${actor} IS NULL THEN RAISE EXCEPTION 'EXTERNAL_AUDIT_CONTEXT_REQUIRED' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('audit_logs:'||row_org::text,0));
  SELECT content_hash INTO prior_hash FROM public.audit_logs WHERE organization_id=row_org ORDER BY created_at DESC,id DESC LIMIT 1;
  content:=encode(sha256(convert_to(public.ue_external_read_json(jsonb_build_object('action',event_action,'resource_type','external_read_qualifications',
    'resource_id',resource_id::text,'user_id',${actor},'correlation_id','','details',event_details,'previous_hash',COALESCE(prior_hash,''))),'UTF8')),'hex');
  stamp:=clock_timestamp();
  INSERT INTO public.audit_logs(id,audit_id,created_at,updated_at,organization_id,action,resource_type,resource_id,user_id,details,changes,content_hash,previous_hash)
    VALUES(entry_id,gen_random_uuid(),stamp,stamp,row_org,event_action,'external_read_qualifications',resource_id::text,${actor},event_details,'{}',content,prior_hash);
END;
`

export const EXTERNAL_READ_RECORD_GUARD_BODY = `
DECLARE row_org uuid;case_id uuid; p jsonb; c record; checked_at timestamptz:=clock_timestamp(); ${saved}
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'EXTERNAL_SOURCE_IMMUTABLE' USING ERRCODE='42501'; END IF;
  row_org:=NEW.organization_id;case_id:=NEW.matter_id;
  ${lock}
  PERFORM set_config('ue.external_read_org',row_org::text,true);
  IF TG_OP='UPDATE' THEN
    IF (to_jsonb(OLD)-ARRAY['revoked_at','revoked_by']) IS DISTINCT FROM (to_jsonb(NEW)-ARRAY['revoked_at','revoked_by'])
      OR OLD.revoked_at IS NOT NULL OR OLD.revoked_by IS NOT NULL OR NEW.revoked_at IS NULL OR NEW.revoked_by IS DISTINCT FROM ${actor}
      OR NOT isfinite(NEW.revoked_at) OR NEW.revoked_at>checked_at OR user_management.auth_business_org_authorized(row_org,NULL::text[]) IS NOT TRUE
      THEN RAISE EXCEPTION 'EXTERNAL_SOURCE_IMMUTABLE' USING ERRCODE='42501'; END IF;
    IF (TG_TABLE_NAME='ue_external_read_consents' AND NEW.member_user_id IS DISTINCT FROM ${actor})
      OR (TG_TABLE_NAME='ue_external_read_qualifications' AND public.ue_case_domain_authorized(row_org,case_id,'case:disclose_to_member') IS NOT TRUE)
      THEN RAISE EXCEPTION 'EXTERNAL_REVOCATION_DENIED' USING ERRCODE='42501'; END IF;
  ELSIF TG_TABLE_NAME='ue_external_read_consents' THEN
    IF NEW.member_user_id IS DISTINCT FROM ${actor} OR user_management.auth_business_org_authorized(row_org,NULL::text[]) IS NOT TRUE
      OR NOT EXISTS(SELECT FROM public.grievances WHERE organization_id=row_org AND id=case_id
        AND represented_member_user_id=NEW.member_user_id AND grievant_id::text=NEW.member_user_id)
      OR NEW.recipient_user_id=NEW.member_user_id OR NEW.representative_organization_id=row_org
      OR NEW.payload_hash !~ '^[a-f0-9]{64}$' OR length(btrim(NEW.consent_text)) NOT BETWEEN 1 AND 8000
      OR NEW.consent_text_sha256 IS DISTINCT FROM encode(sha256(convert_to(NEW.consent_text,'UTF8')),'hex')
      OR NOT isfinite(NEW.granted_at) OR NEW.granted_at>checked_at OR NOT isfinite(NEW.effective_at) OR NOT isfinite(NEW.expires_at)
      OR NEW.expires_at<=NEW.effective_at OR NEW.expires_at<=checked_at
      OR NEW.revoked_at IS NOT NULL OR NEW.revoked_by IS NOT NULL
      THEN RAISE EXCEPTION 'EXTERNAL_MEMBER_CONSENT_REQUIRED' USING ERRCODE='42501'; END IF;
  ELSE
    p:=NEW.payload;
    SELECT * INTO c FROM public.ue_external_read_consents WHERE id=NEW.consent_id AND organization_id=row_org;
    IF NOT FOUND OR NEW.qualified_by IS DISTINCT FROM ${actor} OR NEW.recipient_user_id=NEW.qualified_by OR NEW.member_user_id=NEW.qualified_by
      OR public.ue_case_domain_authorized(row_org,case_id,'case:disclose_to_member') IS NOT TRUE
      OR user_management.auth_business_org_authorized(row_org,NULL::text[]) IS NOT TRUE
      OR public.ue_external_sources_match(p) IS NOT TRUE OR public.ue_external_institution_valid(p,true) IS NOT TRUE OR NEW.id IS DISTINCT FROM (p->>'qualificationId')::uuid
      OR NEW.organization_id IS DISTINCT FROM (p->>'organizationId')::uuid OR NEW.matter_id IS DISTINCT FROM (p->'matter'->>'id')::uuid
      OR NEW.member_user_id IS DISTINCT FROM p->>'representedMemberUserId' OR NEW.recipient_user_id IS DISTINCT FROM p->>'representativeUserId'
      OR NEW.representative_organization_id IS DISTINCT FROM (p->>'representativeOrganizationId')::uuid
      OR NEW.qualified_by IS DISTINCT FROM p->>'issuerUserId'
      OR NEW.payload_hash IS DISTINCT FROM encode(sha256(convert_to(public.ue_external_read_json(p),'UTF8')),'hex')
      OR NEW.payload_hash IS DISTINCT FROM c.payload_hash OR c.matter_id<>case_id OR c.member_user_id<>NEW.member_user_id
      OR c.recipient_user_id<>NEW.recipient_user_id OR c.representative_organization_id<>NEW.representative_organization_id
      OR NOT(${liveTerm('c')}) OR NOT isfinite(NEW.qualified_at) OR NEW.qualified_at>checked_at
      OR NEW.effective_at IS DISTINCT FROM (p->>'effectiveAt')::timestamptz OR NEW.expires_at IS DISTINCT FROM (p->>'expiresAt')::timestamptz
      OR NEW.effective_at<c.effective_at OR NEW.expires_at>c.expires_at OR NEW.expires_at<=NEW.effective_at
      OR NEW.revoked_at IS NOT NULL OR NEW.revoked_by IS NOT NULL
      THEN RAISE EXCEPTION 'EXTERNAL_QUALIFICATION_SOURCE_REQUIRED' USING ERRCODE='42501'; END IF;
  END IF;
  ${restore} RETURN NEW;
EXCEPTION WHEN OTHERS THEN ${restore} RAISE;
END;
`

export const EXTERNAL_READ_LEGACY_GUARD_BODY = `
DECLARE row_org uuid:=OLD.organization_id;case_id uuid:=OLD.matter_id; relevant boolean; ${saved}
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('ue.external-read-institution:'||row_org::text,0));
  PERFORM set_config('ue.external_read_org',row_org::text,true);
  SELECT EXISTS(SELECT FROM public.ue_external_read_qualifications q WHERE q.organization_id=row_org AND (
    (TG_TABLE_NAME='representation_authorities' AND q.payload->'authority'->>'id'=OLD.id::text)
    OR (TG_TABLE_NAME='external_matter_access_grants' AND q.payload->'matter'->>'grantId'=OLD.id::text)
    OR (TG_TABLE_NAME='external_document_access_grants' AND q.payload->'document'->>'grantId'=OLD.id::text))) INTO relevant;
  IF NOT relevant THEN ${restore} IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
  ${lock}
  IF TG_OP='DELETE' OR (to_jsonb(OLD)-ARRAY['status','revoked_at','revoked_by','updated_at']) IS DISTINCT FROM (to_jsonb(NEW)-ARRAY['status','revoked_at','revoked_by','updated_at'])
    OR OLD.status::text<>'active' OR OLD.revoked_at IS NOT NULL OR OLD.revoked_by IS NOT NULL
    OR NEW.status::text NOT IN('revoked','expired') OR NEW.revoked_at IS NULL OR NOT isfinite(NEW.revoked_at)
    OR NEW.revoked_at>clock_timestamp() OR NEW.revoked_by IS DISTINCT FROM ${actor}
    OR user_management.auth_business_org_authorized(row_org,NULL::text[]) IS NOT TRUE
    OR public.ue_case_domain_authorized(row_org,case_id,'case:disclose_to_member') IS NOT TRUE
    THEN RAISE EXCEPTION 'QUALIFIED_EXTERNAL_GRANT_IMMUTABLE' USING ERRCODE='42501'; END IF;
  ${restore} RETURN NEW;
EXCEPTION WHEN OTHERS THEN ${restore} RAISE;
END;
`

export const EXTERNAL_READ_SOURCE_LOCK_BODY = `
DECLARE source jsonb:=to_jsonb(OLD); row_org uuid:=OLD.organization_id; case_id uuid; ${saved}
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('ue.external-read-institution:'||row_org::text,0));
  PERFORM set_config('ue.external_read_org',row_org::text,true);
  FOR case_id IN SELECT DISTINCT q.matter_id FROM public.ue_external_read_qualifications q WHERE q.organization_id=row_org AND (
    (TG_TABLE_NAME='grievances' AND q.matter_id=OLD.id)
    OR (TG_TABLE_NAME='documents' AND q.payload->'document'->>'id'=source->>'id')
    OR (TG_TABLE_NAME='document_versions' AND q.payload->'document'->>'versionId'=source->>'id')
    OR (TG_TABLE_NAME='document_links' AND q.payload->'document'->>'id'=source->>'document_id')) ORDER BY q.matter_id
  LOOP
    ${lock}
    IF TG_TABLE_NAME='document_versions' AND (TG_OP='DELETE'
      OR (source-ARRAY['metadata','uploaded_by','uploaded_at']) IS DISTINCT FROM (to_jsonb(NEW)-ARRAY['metadata','uploaded_by','uploaded_at']))
      THEN RAISE EXCEPTION 'QUALIFIED_EXTERNAL_VERSION_IMMUTABLE' USING ERRCODE='42501'; END IF;
  END LOOP;
  ${restore} IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
EXCEPTION WHEN OTHERS THEN ${restore} RAISE;
END;
`

export const EXTERNAL_READ_CONSENT_BODY = `
DECLARE row_org uuid:=(binding->>'organizationId')::uuid;case_id uuid:=(binding->'matter'->>'id')::uuid; result uuid; checked_at timestamptz:=clock_timestamp(); ${saved}
BEGIN
  IF public.ue_external_payload_valid(binding) IS NOT TRUE THEN RAISE EXCEPTION 'EXTERNAL_BINDING_INVALID' USING ERRCODE='42501'; END IF;
  PERFORM set_config('ue.external_read_org',row_org::text,true);
  IF NOT EXISTS(SELECT FROM public.grievances WHERE organization_id=row_org AND id=case_id
    AND represented_member_user_id=binding->>'representedMemberUserId'
    AND grievant_id::text=represented_member_user_id AND grievant_id=(binding->'authority'->>'representedPersonId')::uuid)
    THEN RAISE EXCEPTION 'EXTERNAL_REPRESENTED_PERSON_BINDING_REQUIRED' USING ERRCODE='42501'; END IF;
  INSERT INTO public.ue_external_read_consents(organization_id,matter_id,member_user_id,recipient_user_id,representative_organization_id,
    payload_hash,consent_text,consent_text_sha256,granted_at,effective_at,expires_at)
    VALUES(row_org,case_id,binding->>'representedMemberUserId',binding->>'representativeUserId',(binding->>'representativeOrganizationId')::uuid,
      encode(sha256(convert_to(public.ue_external_read_json(binding),'UTF8')),'hex'),wording,encode(sha256(convert_to(wording,'UTF8')),'hex'),
      checked_at,(binding->>'effectiveAt')::timestamptz,(binding->>'expiresAt')::timestamptz) RETURNING id INTO result;
  PERFORM public.ue_external_append_audit(row_org,'external.consent.grant',result,jsonb_build_object('payloadHash',encode(sha256(convert_to(public.ue_external_read_json(binding),'UTF8')),'hex')));
  ${restore} RETURN result;
EXCEPTION WHEN OTHERS THEN ${restore} RAISE;
END;
`

export const EXTERNAL_READ_QUALIFY_BODY = `
DECLARE row_org uuid:=(binding->>'organizationId')::uuid;case_id uuid:=(binding->'matter'->>'id')::uuid;result uuid; ${saved}
BEGIN
  IF public.ue_external_payload_valid(binding) IS NOT TRUE THEN RAISE EXCEPTION 'EXTERNAL_BINDING_INVALID' USING ERRCODE='42501'; END IF;
  PERFORM set_config('ue.external_read_org',row_org::text,true);
  INSERT INTO public.ue_external_read_qualifications(id,organization_id,matter_id,member_user_id,recipient_user_id,representative_organization_id,
    consent_id,payload_hash,payload,qualified_by,effective_at,expires_at)
    VALUES((binding->>'qualificationId')::uuid,row_org,case_id,binding->>'representedMemberUserId',binding->>'representativeUserId',(binding->>'representativeOrganizationId')::uuid,
      member_consent,encode(sha256(convert_to(public.ue_external_read_json(binding),'UTF8')),'hex'),binding,${actor},
      (binding->>'effectiveAt')::timestamptz,(binding->>'expiresAt')::timestamptz) RETURNING id INTO result;
  PERFORM public.ue_external_append_audit(row_org,'external.qualification.bind',result,jsonb_build_object('consentId',member_consent,'payloadHash',encode(sha256(convert_to(public.ue_external_read_json(binding),'UTF8')),'hex')));
  ${restore} RETURN result;
EXCEPTION WHEN OTHERS THEN ${restore} RAISE;
END;
`

export const EXTERNAL_READ_REVOKE_BODY = `
DECLARE row_org uuid;case_id uuid; result uuid; ${saved}
BEGIN
  PERFORM set_config('ue.external_read_org',COALESCE(NULLIF(current_setting('app.current_org_id',true),''),''),true);
  IF record_kind='consent' THEN
    SELECT organization_id,matter_id INTO row_org,case_id FROM public.ue_external_read_consents WHERE id=record_id AND organization_id::text=current_setting('app.current_org_id',true);
  ELSIF record_kind='qualification' THEN
    SELECT organization_id,matter_id INTO row_org,case_id FROM public.ue_external_read_qualifications WHERE id=record_id AND organization_id::text=current_setting('app.current_org_id',true);
  ELSE RAISE EXCEPTION 'EXTERNAL_REVOCATION_DENIED' USING ERRCODE='42501'; END IF;
  IF row_org IS NULL THEN RAISE EXCEPTION 'EXTERNAL_REVOCATION_DENIED' USING ERRCODE='42501'; END IF;
  PERFORM set_config('ue.external_read_org',row_org::text,true);
  ${lock}
  IF record_kind='consent' THEN
    UPDATE public.ue_external_read_consents SET revoked_at=clock_timestamp(),revoked_by=${actor} WHERE id=record_id RETURNING id INTO result;
  ELSE
    UPDATE public.ue_external_read_qualifications SET revoked_at=clock_timestamp(),revoked_by=${actor} WHERE id=record_id RETURNING id INTO result;
  END IF;
  IF result IS NULL THEN RAISE EXCEPTION 'EXTERNAL_REVOCATION_DENIED' USING ERRCODE='42501'; END IF;
  PERFORM public.ue_external_append_audit(row_org,'external.'||record_kind||'.revoke',result,'{}');
  ${restore} RETURN result;
EXCEPTION WHEN OTHERS THEN ${restore} RAISE;
END;
`

const validQualification = `q.organization_id=row_org AND q.matter_id=case_id AND q.recipient_user_id=${actor}
  AND q.representative_organization_id::text=NULLIF(current_setting('app.current_org_id',true),'') AND ${liveTerm('q')}
  AND c.organization_id=q.organization_id AND c.matter_id=q.matter_id AND c.id=q.consent_id AND c.payload_hash=q.payload_hash
  AND c.member_user_id=q.member_user_id AND c.recipient_user_id=q.recipient_user_id AND c.representative_organization_id=q.representative_organization_id
  AND ${liveTerm('c')} AND public.ue_external_sources_match(q.payload) AND public.ue_external_institution_valid(q.payload,false)`
const metadataProjection = `jsonb_build_object('id',d.id,'title',COALESCE(d.title,d.filename,d.name),'filename',d.filename,
  'documentType',d.document_type,'mimeType',d.mime_type,'privacyLabel',d.privacy_label,'uploadedAt',d.uploaded_at,'createdAt',d.created_at)`

export const EXTERNAL_READ_RPC_BODY = `
#variable_conflict use_column
DECLARE selected record;p jsonb;checked_at timestamptz;result jsonb; doc record; v record; ${saved}
BEGIN
  IF requested_operation NOT IN('matter','documents','document','locate_download','finalize_download') OR ${actor} IS NULL
    OR user_management.auth_business_org_authorized(NULLIF(current_setting('app.current_org_id',true),'')::uuid,NULL::text[]) IS NOT TRUE
    THEN RAISE EXCEPTION 'EXTERNAL_READ_DENIED' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('ue.case-mail.principal:'||${actor},0));
  PERFORM set_config('ue.external_read_org',row_org::text,true);
  ${lock}
  checked_at:=clock_timestamp();
  SELECT q.* INTO selected FROM public.ue_external_read_qualifications q JOIN public.ue_external_read_consents c ON c.id=q.consent_id
    WHERE ${validQualification}
      AND (document_id IS NULL OR q.payload->'document'->>'id'=document_id::text)
      AND (expected_hash IS NULL OR q.payload_hash=expected_hash)
    ORDER BY q.qualified_at DESC,q.id DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'EXTERNAL_READ_DENIED' USING ERRCODE='42501'; END IF;
  p:=selected.payload;
  IF requested_operation='matter' THEN
    IF NOT(p->'matter'->'permissions'->>'view')::boolean THEN RAISE EXCEPTION 'EXTERNAL_READ_DENIED' USING ERRCODE='42501'; END IF;
    SELECT jsonb_build_object('id',id,'caseNumber',grievance_number,'title',title,'status',status,'step',step,
      'filedDate',filed_date,'responseDeadline',response_deadline,'summary',NULL) INTO result FROM public.grievances WHERE organization_id=row_org AND id=case_id;
  ELSIF requested_operation='documents' THEN
    IF NOT(p->'matter'->'permissions'->>'viewDocuments')::boolean THEN RAISE EXCEPTION 'EXTERNAL_READ_DENIED' USING ERRCODE='42501'; END IF;
    SELECT COALESCE(jsonb_agg(item ORDER BY item->>'id'),'[]'::jsonb) INTO result FROM (
      SELECT DISTINCT ${metadataProjection}||jsonb_build_object('canDownload',(q.payload->'document'->>'canDownload')::boolean) AS item
      FROM public.ue_external_read_qualifications q JOIN public.ue_external_read_consents c ON c.id=q.consent_id
      JOIN public.documents d ON d.id=(q.payload->'document'->>'id')::uuid
      WHERE ${validQualification} AND (q.payload->'matter'->'permissions'->>'viewDocuments')::boolean AND (q.payload->'document'->>'canView')::boolean
    ) listed;
  ELSE
    IF document_id IS NULL OR p->'document'->>'id' IS DISTINCT FROM document_id::text
      OR NOT(p->'matter'->'permissions'->>'viewDocuments')::boolean OR NOT(p->'document'->>'canView')::boolean
      THEN RAISE EXCEPTION 'EXTERNAL_READ_DENIED' USING ERRCODE='42501'; END IF;
    SELECT ${selectedColumns('documents')} INTO doc FROM public.documents WHERE organization_id=row_org AND id=document_id;
    IF requested_operation='document' THEN
      SELECT ${metadataProjection} INTO result FROM public.documents d WHERE d.organization_id=row_org AND d.id=document_id;
    ELSE
      IF NOT(p->'matter'->'permissions'->>'downloadDocuments')::boolean OR NOT(p->'document'->>'canDownload')::boolean
        THEN RAISE EXCEPTION 'EXTERNAL_READ_DENIED' USING ERRCODE='42501'; END IF;
      SELECT ${selectedColumns('document_versions')} INTO v FROM public.document_versions WHERE organization_id=row_org AND id=(p->'document'->>'versionId')::uuid;
      IF requested_operation='locate_download' THEN
        result:=jsonb_build_object('qualificationId',selected.id,'qualificationHash',selected.payload_hash,'documentId',document_id,'versionId',v.id,'versionNo',v.version_no,
          'storageKey',v.storage_key,'storageKeySha256',p->'document'->>'storageKeySha256','checksumSha256',v.content_hash,
          'sizeBytes',(p->'document'->>'sizeBytes')::integer,'filename',COALESCE(doc.filename,doc.title,doc.name),'mimeType',doc.mime_type);
      ELSE
        IF expected_hash IS NULL OR receipt IS DISTINCT FROM jsonb_build_object('qualificationId',selected.id,'documentId',document_id,
          'versionId',v.id,'versionNo',v.version_no,'checksumSha256',v.content_hash,'sizeBytes',(p->'document'->>'sizeBytes')::integer)
          THEN RAISE EXCEPTION 'EXTERNAL_DOWNLOAD_RECHECK_DENIED' USING ERRCODE='42501'; END IF;
        result:=jsonb_build_object('released',true,'qualificationId',selected.id,'qualificationHash',selected.payload_hash);
      END IF;
    END IF;
  END IF;
  IF result IS NULL OR user_management.auth_business_org_authorized(NULLIF(current_setting('app.current_org_id',true),'')::uuid,NULL::text[]) IS NOT TRUE
    OR public.ue_external_sources_match(p) IS NOT TRUE THEN RAISE EXCEPTION 'EXTERNAL_READ_DENIED' USING ERRCODE='42501'; END IF;
  PERFORM public.ue_external_append_audit(row_org,CASE WHEN requested_operation='finalize_download' THEN 'document.external_download' ELSE 'external.resource.'||requested_operation END,
    selected.id,jsonb_build_object('qualificationId',selected.id,'qualificationHash',selected.payload_hash,'matterId',case_id,'documentId',document_id,
      'operation',requested_operation,'receipt',receipt,'delivery',CASE WHEN requested_operation='finalize_download' THEN 'verified_bytes_release_authorized' ELSE 'metadata_only' END));
  ${restore} RETURN QUERY SELECT result;
EXCEPTION WHEN OTHERS THEN ${restore} RAISE;
END;
`

const functionSpec = (name: string, args: string, returns: string, body: string, callers: readonly string[] = [], immutable = false) =>
  ({ name, args, returns, body, callers, immutable })
export const EXTERNAL_READ_FUNCTIONS = [
  functionSpec('ue_external_read_json', 'value jsonb', 'text', EXTERNAL_AUDIT_JSON_BODY, [], true),
  functionSpec('ue_external_payload_valid', 'p jsonb', 'boolean', EXTERNAL_READ_PAYLOAD_VALID_BODY),
  functionSpec('ue_external_sources_match', 'p jsonb', 'boolean', EXTERNAL_READ_SOURCES_MATCH_BODY),
  functionSpec('ue_external_authority_event_valid', 'row_org uuid, target_source_table text, target_source_id uuid, target_operation text, expected_after jsonb, expected_before jsonb', 'boolean', EXTERNAL_AUTHORITY_EVENT_BODY),
  functionSpec('ue_external_approval_valid', 'row_org uuid, request_id uuid, expected_subject_type text, expected_subject_id uuid, proposer text, author text, minimum_votes integer', 'boolean', EXTERNAL_APPROVAL_VALID_BODY),
  functionSpec('ue_external_office_valid', 'row_org uuid, case_id uuid, person text, power text, authorized_at timestamp with time zone, until_at timestamp with time zone, live_membership boolean', 'boolean', EXTERNAL_OFFICE_VALID_BODY),
  functionSpec('ue_external_institution_valid', 'p jsonb, live_membership boolean', 'boolean', EXTERNAL_INSTITUTION_VALID_BODY),
  functionSpec('ue_external_guard_approval', '', 'trigger', EXTERNAL_APPROVAL_GUARD_BODY),
  functionSpec('ue_external_authorizer_scope_v1', 'target_org uuid, approved_request_id uuid, authorizer_id text', 'boolean', EXTERNAL_AUTHORIZER_SCOPE_BODY, [CASE_AUTHORITY_READER_ROLE]),
  functionSpec('ue_external_lock_institution', '', 'trigger', EXTERNAL_INSTITUTION_LOCK_BODY),
  functionSpec('ue_external_append_audit', 'row_org uuid, event_action text, resource_id uuid, event_details jsonb', 'void', EXTERNAL_READ_AUDIT_BODY),
  functionSpec('ue_external_guard_record', '', 'trigger', EXTERNAL_READ_RECORD_GUARD_BODY),
  functionSpec('ue_external_guard_legacy', '', 'trigger', EXTERNAL_READ_LEGACY_GUARD_BODY),
  functionSpec('ue_external_lock_source', '', 'trigger', EXTERNAL_READ_SOURCE_LOCK_BODY),
  functionSpec('ue_external_member_consent_v1', 'binding jsonb, wording text', 'uuid', EXTERNAL_READ_CONSENT_BODY, ['union_eyes_runtime']),
  functionSpec('ue_external_qualify_read_v1', 'binding jsonb, member_consent uuid', 'uuid', EXTERNAL_READ_QUALIFY_BODY, ['ue_v2_owner']),
  functionSpec('ue_external_revoke_read_v1', 'record_kind text, record_id uuid', 'uuid', EXTERNAL_READ_REVOKE_BODY, ['union_eyes_runtime', 'ue_v2_owner']),
  functionSpec('ue_external_resource_read_v1', 'row_org uuid, case_id uuid, document_id uuid, requested_operation text, expected_hash text, receipt jsonb', 'TABLE(payload jsonb)', EXTERNAL_READ_RPC_BODY, ['union_eyes_runtime']),
] as const
const signatures = (args: string) => args ? args.split(',').map(arg => arg.trim().split(/\s+/).slice(1).join(' ')).join(',') : ''
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
export const EXTERNAL_READ_TRIGGER_TABLES = [
  ...['ue_authority_approval_requests','ue_authority_approval_decisions'].map(table => ({ table, name: 'a_ue_external_approval_source', fn: 'ue_external_guard_approval', events: 'INSERT' })),
  ...['ue_authority_issuance_rules','ue_authority_mandates','ue_authority_approval_requests','ue_authority_approval_decisions','ue_authority_acceptances','case_authority_scopes'].map(table => ({ table, name: 'a_ue_external_institution_lock', fn: 'ue_external_lock_institution', events: 'UPDATE OR DELETE' })),
  ...['ue_authority_recusals','case_respondents'].map(table => ({ table, name: 'a_ue_external_institution_lock', fn: 'ue_external_lock_institution', events: 'INSERT OR UPDATE OR DELETE' })),
  ...EXTERNAL_READ_STORAGE_TABLES.map(table => ({ table, name: 'ue_external_protected_record', fn: 'ue_external_guard_record', events: 'INSERT OR UPDATE OR DELETE' })),
  ...['representation_authorities', 'external_matter_access_grants', 'external_document_access_grants'].map(table =>
    ({ table, name: 'ue_external_qualified_immutable', fn: 'ue_external_guard_legacy', events: 'UPDATE OR DELETE' })),
  ...['grievances', 'documents', 'document_versions', 'document_links'].map(table =>
    ({ table, name: 'ue_external_source_lock', fn: 'ue_external_lock_source', events: 'UPDATE OR DELETE' })),
] as const

/** Trusted operator phase, inside the SAME installer transaction. The ordinary
 * installer keeps its canonical attributes; the only temporary edge permits
 * the exact function ownership/ACL construction and is removed before commit. */
export function compileExternalReadRolePreparationSql(options: { rolesPreprovisioned?: boolean } = {}): string {
  const role = options.rolesPreprovisioned ? `DO $ue_external_role$ BEGIN
      IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='${EXTERNAL_READ_OWNER}' AND NOT(rolsuper OR rolinherit OR rolcreaterole OR rolcreatedb OR rolcanlogin OR rolbypassrls))
        OR EXISTS(SELECT FROM pg_auth_members m JOIN pg_roles r ON r.oid IN(m.roleid,m.member) WHERE r.rolname='${EXTERNAL_READ_OWNER}')
        THEN RAISE EXCEPTION 'EXTERNAL_PREPROVISIONED_ROLE_DIFFERS' USING ERRCODE='42501'; END IF;
    END $ue_external_role$;`
    : `CREATE ROLE ${EXTERNAL_READ_OWNER} NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;`
  return `DO $ue_external_auth_role$ BEGIN
      IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='${CASE_AUTHORITY_READER_ROLE}' AND NOT(rolsuper OR rolinherit OR rolcreaterole OR rolcreatedb OR rolcanlogin OR rolbypassrls))
        OR NOT has_schema_privilege('${CASE_AUTHORITY_READER_ROLE}','public','USAGE')
        OR has_schema_privilege('${CASE_AUTHORITY_READER_ROLE}','public','CREATE')
        OR has_schema_privilege('${CASE_AUTHORITY_READER_ROLE}','public','USAGE WITH GRANT OPTION')
        THEN RAISE EXCEPTION 'EXTERNAL_AUTH_READER_CANONICAL_PREPARATION_REQUIRED' USING ERRCODE='42501'; END IF;
    END $ue_external_auth_role$;
    ${role}
    GRANT USAGE,CREATE ON SCHEMA public TO ${EXTERNAL_READ_OWNER};
    GRANT CREATE ON SCHEMA public TO ${CASE_AUTHORITY_READER_ROLE};
    GRANT USAGE ON SCHEMA user_management TO ${EXTERNAL_READ_OWNER};
    ${EXTERNAL_READ_PREREQUISITE_FUNCTIONS.map(fn => `GRANT EXECUTE ON FUNCTION ${fn} TO ${EXTERNAL_READ_OWNER};`).join('\n')}
    DO $ue_external_set$ BEGIN
      IF current_setting('server_version_num')::integer>=160000 THEN
        EXECUTE 'GRANT ${EXTERNAL_READ_OWNER} TO ue_v2_owner WITH ADMIN FALSE,INHERIT FALSE,SET TRUE';
      ELSE GRANT ${EXTERNAL_READ_OWNER} TO ue_v2_owner; END IF;
    END $ue_external_set$;`
}
export function compileExternalReadRoleFinalizationSql(): string {
  return `REVOKE CREATE ON SCHEMA public FROM ${EXTERNAL_READ_OWNER};
    REVOKE CREATE ON SCHEMA public FROM ${CASE_AUTHORITY_READER_ROLE};
    REVOKE ${EXTERNAL_READ_OWNER} FROM ue_v2_owner;
    DO $ue_external_final$ BEGIN
      IF EXISTS(SELECT FROM pg_auth_members m JOIN pg_roles r ON r.oid IN(m.roleid,m.member) WHERE r.rolname='${EXTERNAL_READ_OWNER}')
        OR has_schema_privilege('${EXTERNAL_READ_OWNER}','public','CREATE')
        OR has_schema_privilege('${CASE_AUTHORITY_READER_ROLE}','public','CREATE')
        THEN RAISE EXCEPTION 'EXTERNAL_PRIVATE_ROLE_NOT_FINAL'; END IF;
    END $ue_external_final$;`
}

export function compileExternalReadSql(options: { rolesPreprovisioned?: boolean } = {}): string {
  const role = EXTERNAL_READ_OWNER
  const grants = EXTERNAL_READ_COLUMN_GRANTS.flatMap(grant => [
    `GRANT SELECT(${grant.select.map(quote).join(',')}) ON public.${quote(grant.table)} TO ${role};`,
    ...('insert' in grant ? [`GRANT INSERT(${grant.insert.map(quote).join(',')}) ON public.${quote(grant.table)} TO ${role};`] : []),
    ...('update' in grant ? [`GRANT UPDATE(${grant.update.map(quote).join(',')}) ON public.${quote(grant.table)} TO ${role};`] : []),
  ])
  const policies = EXTERNAL_READ_COLUMN_GRANTS.flatMap(grant => [
    `CREATE POLICY ue_external_reader ON public.${quote(grant.table)} FOR SELECT TO ${role} USING(organization_id::text=${context});`,
    ...('insert' in grant ? [`CREATE POLICY ue_external_writer ON public.${quote(grant.table)} FOR INSERT TO ${role} WITH CHECK(organization_id::text=${context});`] : []),
    ...('update' in grant ? [`CREATE POLICY ue_external_revoker ON public.${quote(grant.table)} FOR UPDATE TO ${role} USING(organization_id::text=${context}) WITH CHECK(organization_id::text=${context});`] : []),
  ])
  const createFunction = (fn: typeof EXTERNAL_READ_FUNCTIONS[number]) => `CREATE FUNCTION public.${fn.name}(${fn.args}) RETURNS ${fn.returns}
    LANGUAGE plpgsql ${fn.immutable ? 'IMMUTABLE' : 'VOLATILE'} SECURITY DEFINER SET search_path=pg_catalog AS $ue_external$${fn.body}$ue_external$;`
  // CREATE TRIGGER requires EXECUTE on its function. Attach while the
  // installer still owns it; the isolated private role is SET-only on PG16.
  // Ownership and final ACL transfer happen only after all attachments exist.
  const transferFunction = (fn: typeof EXTERNAL_READ_FUNCTIONS[number]) => `ALTER FUNCTION public.${fn.name}(${fn.args}) OWNER TO ${role};`
  const functionAcl = (fn: typeof EXTERNAL_READ_FUNCTIONS[number]) => `REVOKE ALL ON FUNCTION public.${fn.name}(${signatures(fn.args)}) FROM PUBLIC,union_eyes_runtime,union_eyes_system;
    ${fn.callers.map(caller => `GRANT EXECUTE ON FUNCTION public.${fn.name}(${signatures(fn.args)}) TO ${caller};`).join('\n')}`
  const triggers = EXTERNAL_READ_TRIGGER_TABLES.map(trigger => `CREATE TRIGGER ${trigger.name} BEFORE ${trigger.events} ON public.${quote(trigger.table)} FOR EACH ROW EXECUTE FUNCTION public.${trigger.fn}();`).join('\n')
  const roleAdmission = options.rolesPreprovisioned ? `
    IF current_user<>'ue_v2_owner' OR NOT EXISTS(SELECT FROM pg_roles WHERE rolname='${role}' AND NOT(rolsuper OR rolinherit OR rolcreaterole OR rolcreatedb OR rolcanlogin OR rolbypassrls))
      THEN RAISE EXCEPTION 'EXTERNAL_SOURCE_PREPROVISIONED_AUTHORITY_REQUIRED' USING ERRCODE='42501'; END IF;
    IF NOT has_schema_privilege('${role}','public','USAGE') OR NOT has_schema_privilege('${role}','public','CREATE')
      OR NOT has_schema_privilege('${role}','user_management','USAGE')
      OR NOT EXISTS(SELECT FROM pg_auth_members m WHERE m.roleid=(SELECT oid FROM pg_roles WHERE rolname='${role}')
        AND m.member=(SELECT oid FROM pg_roles WHERE rolname='ue_v2_owner') AND NOT m.admin_option
        AND COALESCE((to_jsonb(m)->>'set_option')::boolean,true) AND NOT COALESCE((to_jsonb(m)->>'inherit_option')::boolean,false))
      OR EXISTS(SELECT FROM pg_auth_members m WHERE (m.roleid=(SELECT oid FROM pg_roles WHERE rolname='${role}') OR m.member=(SELECT oid FROM pg_roles WHERE rolname='${role}'))
        AND NOT(m.roleid=(SELECT oid FROM pg_roles WHERE rolname='${role}') AND m.member=(SELECT oid FROM pg_roles WHERE rolname='ue_v2_owner')))
      OR ${EXTERNAL_READ_PREREQUISITE_CONTRACTS.map(fn => `NOT EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='${fn.schema}' AND p.proname='${fn.name}' AND p.proargtypes::text='${fn.argumentTypes}' AND has_function_privilege('${role}',p.oid,'EXECUTE'))`).join(' OR ')}
      THEN RAISE EXCEPTION 'EXTERNAL_SOURCE_PREPROVISIONED_AUTHORITY_REQUIRED' USING ERRCODE='42501'; END IF;`
    : `IF EXISTS(SELECT FROM pg_roles WHERE rolname='${role}') THEN RAISE EXCEPTION 'EXTERNAL_SOURCE_REQUIRES_EXACT_CATALOG_ADMISSION'; END IF;`
  return `DO $ue_external_admission$ BEGIN
      IF EXISTS(SELECT FROM unnest(ARRAY[${EXTERNAL_READ_COLUMN_GRANTS.map(grant => `'${grant.table}'`).join(',')}]) expected(name)
        LEFT JOIN pg_namespace n ON n.nspname='public' LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=expected.name AND c.relkind='r'
        WHERE c.oid IS NULL OR NOT c.relrowsecurity OR NOT c.relforcerowsecurity
          OR (expected.name IN('ue_external_read_consents','ue_external_read_qualifications') AND pg_get_userbyid(c.relowner)<>'ue_v2_owner'))
        THEN RAISE EXCEPTION 'EXTERNAL_SOURCE_FORCED_STORAGE_REQUIRED'; END IF;
      IF EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.proname IN(${EXTERNAL_READ_FUNCTIONS.map(fn => `'${fn.name}'`).join(',')}))
        THEN RAISE EXCEPTION 'EXTERNAL_SOURCE_REQUIRES_EXACT_CATALOG_ADMISSION'; END IF;
      ${roleAdmission}
    END $ue_external_admission$;
    ${options.rolesPreprovisioned ? '' : `CREATE ROLE ${role} NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    GRANT USAGE,CREATE ON SCHEMA public TO ${role};
    GRANT USAGE ON SCHEMA user_management TO ${role};`}
    ${grants.join('\n')}
    ${policies.join('\n')}
    ${options.rolesPreprovisioned ? '' : EXTERNAL_READ_PREREQUISITE_FUNCTIONS.map(fn => `GRANT EXECUTE ON FUNCTION ${fn} TO ${role};`).join('\n')}
    ${EXTERNAL_READ_FUNCTIONS.map(createFunction).join('\n')}
    ${triggers}
    ${EXTERNAL_READ_FUNCTIONS.map(transferFunction).join('\n')}
    ${options.rolesPreprovisioned ? `SET LOCAL ROLE ${role};` : ''}
    ${EXTERNAL_READ_FUNCTIONS.map(functionAcl).join('\n')}
    ${options.rolesPreprovisioned ? 'SET LOCAL ROLE ue_v2_owner;' : ''}
    ${options.rolesPreprovisioned ? '' : `REVOKE CREATE ON SCHEMA public FROM ${role};`}`
}
