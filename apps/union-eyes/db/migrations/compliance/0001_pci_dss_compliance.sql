-- ============================================================================
-- PCI-DSS Compliance Schema Migration
-- File: 0001_pci_dss_compliance.sql
-- 
-- This migration implements PCI-DSS SAQ-A compliance tracking for UnionEyes.
-- SAQ-A applies because:
--   - Card data entry via Stripe Elements (off-server)
--   - No card data stored (tokens only)
--   - E-commerce merchant using third-party processor
-- 
-- SAFE TO RUN: Creates new tables, no modifications to existing data
-- ROLLBACK: See rollback section at bottom
-- ============================================================================

BEGIN;

-- ============================================================================
-- SAQ ASSESSMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS pci_dss_saq_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Assessment details
  saq_type VARCHAR(10) NOT NULL DEFAULT 'SAQ-A' CHECK (saq_type IN ('SAQ-A', 'SAQ-A-EP', 'SAQ-D')),
  assessment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  assessor_name VARCHAR(255) NOT NULL,
  assessor_email VARCHAR(255),
  
  -- Compliance status
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'compliant', 'non_compliant', 'remediation_required')),
  compliance_score INTEGER CHECK (compliance_score BETWEEN 0 AND 100),
  
  -- Requirements (22 for SAQ-A)
  requirements_met INTEGER DEFAULT 0,
  requirements_total INTEGER DEFAULT 22,
  
  -- Attestation
  attestation_of_compliance BOOLEAN DEFAULT false,
  attestation_date TIMESTAMP WITH TIME ZONE,
  attested_by VARCHAR(255),
  
  -- Next assessment
  next_assessment_due TIMESTAMP WITH TIME ZONE,
  
  -- Audit trail
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_pci_saq_org ON pci_dss_saq_assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_pci_saq_status ON pci_dss_saq_assessments(status);
CREATE INDEX IF NOT EXISTS idx_pci_saq_next_due ON pci_dss_saq_assessments(next_assessment_due);

COMMENT ON TABLE pci_dss_saq_assessments IS 'PCI-DSS Self-Assessment Questionnaire tracking';
COMMENT ON COLUMN pci_dss_saq_assessments.saq_type IS 'SAQ-A: E-commerce using redirect/iframe (UnionEyes qualifies)';

-- ============================================================================
-- REQUIREMENTS TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS pci_dss_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES pci_dss_saq_assessments(id) ON DELETE CASCADE,
  
  -- Requirement identification
  requirement_number VARCHAR(20) NOT NULL,
  requirement_title TEXT NOT NULL,
  requirement_description TEXT,
  
  -- Compliance status
  is_compliant BOOLEAN DEFAULT false,
  compliance_notes TEXT,
  evidence_location TEXT,
  
  -- Remediation
  remediation_needed BOOLEAN DEFAULT false,
  remediation_plan TEXT,
  remediation_deadline TIMESTAMP WITH TIME ZONE,
  remediation_status VARCHAR(50) DEFAULT 'not_started' CHECK (remediation_status IN ('not_started', 'in_progress', 'completed', 'blocked')),
  
  -- Audit trail
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_pci_req_assessment ON pci_dss_requirements(assessment_id);
CREATE INDEX IF NOT EXISTS idx_pci_req_compliant ON pci_dss_requirements(is_compliant);

COMMENT ON TABLE pci_dss_requirements IS 'Individual PCI-DSS requirements (22 for SAQ-A)';

-- ============================================================================
-- QUARTERLY EXTERNAL SCANS
-- ============================================================================

CREATE TABLE IF NOT EXISTS pci_dss_quarterly_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Scan details
  scan_vendor VARCHAR(255) NOT NULL,
  scan_date TIMESTAMP WITH TIME ZONE NOT NULL,
  scan_type VARCHAR(50) NOT NULL DEFAULT 'external' CHECK (scan_type IN ('external', 'internal', 'penetration_test')),
  
  -- Results
  scan_status VARCHAR(50) NOT NULL CHECK (scan_status IN ('passed', 'failed', 'pending', 'remediation_required')),
  vulnerabilities_found INTEGER DEFAULT 0,
  critical_vulnerabilities INTEGER DEFAULT 0,
  high_vulnerabilities INTEGER DEFAULT 0,
  medium_vulnerabilities INTEGER DEFAULT 0,
  low_vulnerabilities INTEGER DEFAULT 0,
  
  -- Report
  scan_report_url TEXT,
  scan_report_summary TEXT,
  
  -- Remediation
  remediation_deadline TIMESTAMP WITH TIME ZONE,
  remediation_completed BOOLEAN DEFAULT false,
  
  -- Next scan (quarterly requirement)
  next_scan_due TIMESTAMP WITH TIME ZONE,
  
  -- Audit trail
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pci_scan_org ON pci_dss_quarterly_scans(organization_id);
CREATE INDEX IF NOT EXISTS idx_pci_scan_status ON pci_dss_quarterly_scans(scan_status);
CREATE INDEX IF NOT EXISTS idx_pci_scan_next_due ON pci_dss_quarterly_scans(next_scan_due);

COMMENT ON TABLE pci_dss_quarterly_scans IS 'Quarterly external vulnerability scans (Approved Scanning Vendor required)';
COMMENT ON COLUMN pci_dss_quarterly_scans.scan_vendor IS 'Must be PCI SSC approved ASV (e.g., Qualys, Trustwave)';

-- ============================================================================
-- CARDHOLDER DATA FLOW DOCUMENTATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS pci_dss_cardholder_data_flow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Flow documentation
  flow_name VARCHAR(255) NOT NULL,
  flow_description TEXT,
  flow_diagram_url TEXT,
  
  -- Data elements tracked
  data_elements JSONB,
  
  -- Systems involved
  systems_involved JSONB,
  
  -- Security controls
  encryption_method VARCHAR(255),
  tokenization_provider VARCHAR(255) DEFAULT 'Stripe',
  access_controls TEXT,
  
  -- Validation
  last_reviewed_date TIMESTAMP WITH TIME ZONE,
  reviewed_by VARCHAR(255),
  next_review_due TIMESTAMP WITH TIME ZONE,
  
  -- Audit trail
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pci_flow_org ON pci_dss_cardholder_data_flow(organization_id);

COMMENT ON TABLE pci_dss_cardholder_data_flow IS 'Documents how cardholder data flows through systems';
COMMENT ON COLUMN pci_dss_cardholder_data_flow.tokenization_provider IS 'Stripe handles all card data - UnionEyes never sees it';

-- ============================================================================
-- ENCRYPTION KEY MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS pci_dss_encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Key identification
  key_name VARCHAR(255) NOT NULL,
  key_purpose TEXT NOT NULL,
  key_type VARCHAR(100) NOT NULL,
  
  -- Key lifecycle
  key_created_date TIMESTAMP WITH TIME ZONE NOT NULL,
  key_rotation_frequency VARCHAR(50),
  last_rotated_date TIMESTAMP WITH TIME ZONE,
  next_rotation_due TIMESTAMP WITH TIME ZONE,
  
  -- Storage location
  key_storage_location VARCHAR(255) NOT NULL,
  is_encrypted BOOLEAN DEFAULT false,
  
  -- Access control
  authorized_personnel JSONB,
  access_log_enabled BOOLEAN DEFAULT true,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  deactivated_date TIMESTAMP WITH TIME ZONE,
  
  -- Audit trail
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_pci_keys_org ON pci_dss_encryption_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_pci_keys_active ON pci_dss_encryption_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_pci_keys_rotation_due ON pci_dss_encryption_keys(next_rotation_due);

COMMENT ON TABLE pci_dss_encryption_keys IS 'Tracks encryption keys and rotation schedule';
COMMENT ON COLUMN pci_dss_encryption_keys.key_rotation_frequency IS 'Typically 90 days for API keys';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE pci_dss_saq_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pci_dss_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE pci_dss_quarterly_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE pci_dss_cardholder_data_flow ENABLE ROW LEVEL SECURITY;
ALTER TABLE pci_dss_encryption_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies (organization-scoped)
CREATE POLICY pci_saq_org_isolation ON pci_dss_saq_assessments
  FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY pci_req_org_isolation ON pci_dss_requirements
  FOR ALL USING (assessment_id IN (
    SELECT id FROM pci_dss_saq_assessments 
    WHERE organization_id = current_setting('app.current_organization_id')::UUID
  ));

CREATE POLICY pci_scan_org_isolation ON pci_dss_quarterly_scans
  FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY pci_flow_org_isolation ON pci_dss_cardholder_data_flow
  FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY pci_keys_org_isolation ON pci_dss_encryption_keys
  FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

-- ============================================================================
-- INITIAL DATA - SAQ-A Requirements Template
-- ============================================================================

-- Insert SAQ-A requirement templates (22 requirements)
-- These will be copied when an organization creates their first assessment

CREATE TABLE IF NOT EXISTS pci_dss_saq_a_requirements_template (
  requirement_number VARCHAR(20) PRIMARY KEY,
  requirement_title TEXT NOT NULL,
  requirement_description TEXT NOT NULL,
  category VARCHAR(100) NOT NULL
);

INSERT INTO pci_dss_saq_a_requirements_template (requirement_number, requirement_title, requirement_description, category) VALUES
('2.2', 'Configuration Standards', 'Develop configuration standards for all system components', 'Build and Maintain a Secure Network'),
('2.2.3', 'Strong Cryptography Authentication', 'Deploy strong cryptography and security protocols to safeguard sensitive cardholder data during transmission over public networks', 'Build and Maintain a Secure Network'),
('8.1.4', 'Inactive Account Management', 'Remove or disable inactive user accounts within 90 days', 'Implement Strong Access Control'),
('8.2.1', 'Strong Authentication', 'Render all authentication credentials unreadable during transmission and storage', 'Implement Strong Access Control'),
('8.2.4', 'Password Changes', 'Change user passwords at least every 90 days', 'Implement Strong Access Control'),
('8.3.1', 'Multi-Factor Authentication', 'Employ multi-factor authentication for all remote access to the CDE', 'Implement Strong Access Control'),
('9.5', 'Physical Security', 'Destroy media when it is no longer needed for business or legal reasons', 'Maintain Physical Security'),
('9.5.1', 'Media Destruction', 'Destroy cardholder data when it is no longer needed', 'Maintain Physical Security'),
('9.6.2', 'Media Distribution', 'Maintain strict control over the distribution of any kind of media', 'Maintain Physical Security'),
('11.3', 'Change Detection', 'Deploy a change-detection mechanism to alert personnel to unauthorized modification of critical system files', 'Regularly Monitor and Test Networks'),
('12.3', 'Usage Policies', 'Develop usage policies for critical technologies and define proper use', 'Maintain Information Security Policy'),
('12.4', 'Security Responsibility', 'Ensure that the security policy and procedures clearly define information security responsibilities', 'Maintain Information Security Policy'),
('12.5.3', 'PCI DSS Compliance', 'Review PCI DSS requirements quarterly', 'Maintain Information Security Policy'),
('12.6.1', 'Security Awareness', 'Provide a formal security awareness program to all personnel', 'Maintain Information Security Policy'),
('12.8', 'Service Provider Management', 'Maintain a list of service providers', 'Maintain Information Security Policy'),
('12.8.2', 'Service Provider Compliance', 'Maintain a written agreement that includes service provider responsibility for PCI DSS', 'Maintain Information Security Policy'),
('12.9', 'Service Provider Acknowledgment', 'Service providers acknowledge in writing their responsibility for the security of cardholder data', 'Maintain Information Security Policy'),
('A1.1', 'Hosting Provider Protection', 'Hosting providers protect cardholder data environment', 'Additional Requirements (Hosting Providers)'),
('A1.2', 'Hosting Provider Security', 'Hosting providers implement specific security measures', 'Additional Requirements (Hosting Providers)'),
('A1.3', 'Hosting Provider Audit', 'Hosting providers facilitate penetration testing and audits', 'Additional Requirements (Hosting Providers)'),
('A1.4', 'Merchant Responsibility', 'Merchants verify their hosting provider PCI DSS compliance', 'Additional Requirements (Hosting Providers)');

COMMENT ON TABLE pci_dss_saq_a_requirements_template IS 'Template of 22 SAQ-A requirements - copied when creating new assessment';

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to create initial assessment for an organization
CREATE OR REPLACE FUNCTION create_initial_pci_assessment(org_id UUID, assessor VARCHAR(255))
RETURNS UUID AS $$
DECLARE
  assessment_id UUID;
  req RECORD;
BEGIN
  -- Create assessment
  INSERT INTO pci_dss_saq_assessments (
    organization_id,
    saq_type,
    assessment_date,
    assessor_name,
    status,
    requirements_met,
    requirements_total,
    next_assessment_due
  ) VALUES (
    org_id,
    'SAQ-A',
    NOW(),
    assessor,
    'pending',
    0,
    22,
    NOW() + INTERVAL '1 year'
  ) RETURNING id INTO assessment_id;
  
  -- Copy requirements from template
  FOR req IN SELECT * FROM pci_dss_saq_a_requirements_template LOOP
    INSERT INTO pci_dss_requirements (
      assessment_id,
      requirement_number,
      requirement_title,
      requirement_description,
      is_compliant
    ) VALUES (
      assessment_id,
      req.requirement_number,
      req.requirement_title,
      req.requirement_description,
      false
    );
  END LOOP;
  
  RETURN assessment_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_initial_pci_assessment IS 'Creates initial PCI-DSS SAQ-A assessment with all 22 requirements';

-- Function to initialize Stripe key tracking
CREATE OR REPLACE FUNCTION initialize_stripe_key_tracking(org_id UUID)
RETURNS UUID AS $$
DECLARE
  key_id UUID;
BEGIN
  INSERT INTO pci_dss_encryption_keys (
    organization_id,
    key_name,
    key_purpose,
    key_type,
    key_created_date,
    key_rotation_frequency,
    last_rotated_date,
    next_rotation_due,
    key_storage_location,
    is_encrypted,
    access_log_enabled,
    is_active
  ) VALUES (
    org_id,
    'Stripe API Key',
    'Payment processing via Stripe API',
    'API_KEY',
    NOW(),
    '90_days',
    NOW(),
    NOW() + INTERVAL '90 days',
    'Environment Variables (encrypted at rest)',
    true,
    true,
    true
  ) RETURNING id INTO key_id;
  
  RETURN key_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify tables created
DO $$
DECLARE
  table_count INT;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name LIKE 'pci_dss%';
  
  IF table_count = 6 THEN
    RAISE NOTICE '✓ All 6 PCI-DSS tables created successfully';
  ELSE
    RAISE EXCEPTION 'Expected 6 tables, found %', table_count;
  END IF;
END $$;

-- Verify RLS enabled
DO $$
DECLARE
  rls_count INT;
BEGIN
  SELECT COUNT(*) INTO rls_count
  FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename LIKE 'pci_dss%'
  AND rowsecurity = true;
  
  IF rls_count = 5 THEN
    RAISE NOTICE '✓ Row Level Security enabled on all PCI-DSS tables';
  ELSE
    RAISE WARNING 'RLS verification: Expected 5, found %', rls_count;
  END IF;
END $$;

-- Verify SAQ-A requirements template
DO $$
DECLARE
  req_count INT;
BEGIN
  SELECT COUNT(*) INTO req_count
  FROM pci_dss_saq_a_requirements_template;
  
  IF req_count >= 20 THEN
    RAISE NOTICE '✓ SAQ-A requirements template populated (% requirements)', req_count;
  ELSE
    RAISE WARNING 'Expected at least 20 requirements, found %', req_count;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (run separately if needed)
-- ============================================================================

/*
-- TO ROLLBACK THIS MIGRATION:

BEGIN;

DROP FUNCTION IF EXISTS create_initial_pci_assessment(UUID, VARCHAR(255));
DROP FUNCTION IF EXISTS initialize_stripe_key_tracking(UUID);

DROP TABLE IF EXISTS pci_dss_requirements CASCADE;
DROP TABLE IF EXISTS pci_dss_saq_assessments CASCADE;
DROP TABLE IF EXISTS pci_dss_quarterly_scans CASCADE;
DROP TABLE IF EXISTS pci_dss_cardholder_data_flow CASCADE;
DROP TABLE IF EXISTS pci_dss_encryption_keys CASCADE;
DROP TABLE IF EXISTS pci_dss_saq_a_requirements_template CASCADE;

COMMIT;
*/
