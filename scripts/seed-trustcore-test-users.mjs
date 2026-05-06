/**
 * Seed TrustCore test users and demo data.
 *
 * Creates a Trustcore Demo Corp org and two test accounts with realistic
 * Law 25 compliance data so the trustcore app UI can be validated locally.
 *
 * Seeded accounts:
 *   admin@trustcore-demo.com  — org_admin   (Privacy Officer)
 *   staff@trustcore-demo.com  — org_viewer  (Staff)
 *
 * Password for all: Test1234!
 *
 * Usage: node scripts/seed-trustcore-test-users.mjs
 * DB:    postgres://nzila:nzila_dev@localhost:5433/nzila_automation (native PG, NOT Docker)
 */
import argon2 from 'argon2'
import postgres from 'postgres'

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://nzila:nzila_dev@localhost:5433/nzila_automation'

const sql = postgres(DATABASE_URL)

const TEST_PASSWORD = 'Test1234!'

// Deterministic IDs — safe to re-run
const TC_ORG_ID   = 'a1b2c3d4-1111-4aaa-8aaa-000000000001'
const TC_ADMIN_ID = 'user_tc_admin_001_trustcore_seed'
const TC_STAFF_ID = 'user_tc_staff_001_trustcore_seed'

// Fixed UUIDs for domain data (idempotency)
const PROGRAM_ID  = 'b1c2d3e4-2222-4bbb-8bbb-000000000001'
const VENDOR_1_ID = 'c1d2e3f4-3333-4ccc-8ccc-000000000001'
const VENDOR_2_ID = 'd1e2f3a4-4444-4ddd-8ddd-000000000001'
const ASSET_1_ID  = 'e1f2a3b4-5555-4eee-8eee-000000000001'
const ASSET_2_ID  = 'f1a2b3c4-6666-4fff-8fff-000000000001'
const ASSET_3_ID  = 'a2b3c4d5-7777-4aaa-9aaa-000000000001'
const DSR_1_ID    = 'b2c3d4e5-8888-4bbb-9bbb-000000000001'
const INCIDENT_ID = 'c2d3e4f5-9999-4ccc-9ccc-000000000001'
const CONSENT_1_ID= 'd2e3f4a5-aaaa-4ddd-9ddd-000000000001'
const CONSENT_2_ID= 'e2f3a4b5-bbbb-4eee-9eee-000000000001'
const PIA_1_ID    = 'f2a3b4c5-cccc-4fff-9fff-000000000001'
const SNAPSHOT_ID = 'a3b4c5d6-dddd-4aaa-aaaa-000000000001'

async function main() {
  console.log('🔐 Generating Argon2id hash…')
  const hash = await argon2.hash(TEST_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  })
  console.log('  ✓ Hash generated\n')

  // ── 1. Org ────────────────────────────────────────────────────────────────
  console.log('🏢 Upserting Trustcore Demo Corp org…')
  await sql`
    INSERT INTO orgs (
      id, legal_name, jurisdiction, status, clerk_org_id, created_at, updated_at
    ) VALUES (
      ${TC_ORG_ID},
      'Trustcore Demo Corp',
      'CA-QC',
      'active',
      NULL,
      NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      legal_name  = 'Trustcore Demo Corp',
      updated_at  = NOW()
  `

  await sql`
    INSERT INTO organizations (
      id, name, slug,
      organization_type, hierarchy_path, hierarchy_level,
      status, created_at, updated_at
    ) VALUES (
      ${TC_ORG_ID},
      'Trustcore Demo Corp',
      'trustcore-demo-corp-local',
      'union', ARRAY[${TC_ORG_ID}::text], 0,
      'active', NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      status = EXCLUDED.status,
      updated_at = NOW()
  `
  console.log('  ✓ org ensured\n')

  // ── 2. Users ──────────────────────────────────────────────────────────────
  const ACCOUNTS = [
    {
      userId:    TC_ADMIN_ID,
      email:     'admin@trustcore-demo.com',
      firstName: 'Priya',
      lastName:  'Sharma',
      role:      'org_admin',
    },
    {
      userId:    TC_STAFF_ID,
      email:     'staff@trustcore-demo.com',
      firstName: 'Marc',
      lastName:  'Tremblay',
      role:      'org_viewer',
    },
  ]

  console.log('👤 Seeding users…')
  for (const acct of ACCOUNTS) {
    await sql`
      INSERT INTO user_management.users (
        user_id, email, email_verified, email_verified_at,
        password_hash, first_name, last_name, display_name,
        is_active, created_at, updated_at
      ) VALUES (
        ${acct.userId}, ${acct.email}, true, NOW(),
        ${hash}, ${acct.firstName}, ${acct.lastName},
        ${acct.firstName + ' ' + acct.lastName},
        true, NOW(), NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        password_hash     = ${hash},
        email_verified    = true,
        email_verified_at = NOW(),
        updated_at        = NOW()
    `

    await sql`
      INSERT INTO user_management.organization_users (
        user_id, organization_id, role, is_primary, is_active
      ) VALUES (
        ${acct.userId}, ${TC_ORG_ID}, ${acct.role}, true, true
      )
      ON CONFLICT (user_id, organization_id) DO UPDATE SET
        role       = ${acct.role},
        is_primary = true,
        is_active  = true,
        updated_at = NOW()
    `

    await sql`
      INSERT INTO organization_members (
        id, user_id, organization_id, name, email, role, status, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), ${acct.userId}, ${TC_ORG_ID},
        ${acct.firstName + ' ' + acct.lastName}, ${acct.email},
        ${acct.role}, 'active', NOW(), NOW()
      )
      ON CONFLICT DO NOTHING
    `

    console.log(`  ✓ ${acct.email} (${acct.role})`)
  }
  console.log()

  // ── 3. Privacy program (active + onboarding complete) ─────────────────────
  console.log('📋 Seeding privacy program…')
  await sql`
    INSERT INTO trustcore_privacy_programs (
      id, org_id, framework,
      privacy_officer_name, privacy_officer_email, privacy_officer_role,
      public_contact_email,
      status, onboarding_completed_at, last_reviewed_at,
      created_at, updated_at
    ) VALUES (
      ${PROGRAM_ID}, ${TC_ORG_ID}, 'law25',
      'Priya Sharma', 'admin@trustcore-demo.com', 'Privacy Officer',
      'privacy@trustcore-demo.com',
      'active', NOW(), NOW(),
      NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      status                    = 'active',
      onboarding_completed_at   = COALESCE(trustcore_privacy_programs.onboarding_completed_at, NOW()),
      updated_at                = NOW()
  `
  console.log('  ✓ program ensured\n')

  // ── 4. Vendors ─────────────────────────────────────────────────────────────
  console.log('🤝 Seeding vendors…')
  await sql`
    INSERT INTO trustcore_vendors (
      id, org_id, name, service_description, country,
      data_shared_description, risk_level, cross_border_transfer,
      pia_required, contract_reviewed, status,
      created_at, updated_at
    ) VALUES
    (
      ${VENDOR_1_ID}, ${TC_ORG_ID},
      'Salesforce Canada', 'CRM and customer engagement platform', 'Canada',
      'Contact details, interaction history, deal records',
      'medium', false, true, true, 'active',
      NOW(), NOW()
    ),
    (
      ${VENDOR_2_ID}, ${TC_ORG_ID},
      'Amazon Web Services (US)', 'Cloud infrastructure and storage', 'USA',
      'System logs, backup data, document storage',
      'high', true, true, false, 'active',
      NOW(), NOW()
    )
    ON CONFLICT (id) DO NOTHING
  `
  console.log('  ✓ 2 vendors\n')

  // ── 5. Data assets ─────────────────────────────────────────────────────────
  console.log('🗄️  Seeding data assets…')
  await sql`
    INSERT INTO trustcore_data_assets (
      id, org_id, name, description, data_category, sensitivity_level,
      processing_purpose, lawful_basis_or_consent_basis,
      storage_location, system_owner, retention_period,
      cross_border_transfer, destination_country,
      vendor_id, status,
      created_at, updated_at
    ) VALUES
    (
      ${ASSET_1_ID}, ${TC_ORG_ID},
      'Employee HR Records',
      'Full name, SIN, date of birth, salary, bank account numbers',
      'employment', 'critical',
      'Payroll processing and HR administration',
      'legal_obligation',
      'On-premise PostgreSQL', 'HR Department', '7 years after termination',
      false, NULL,
      NULL, 'active',
      NOW(), NOW()
    ),
    (
      ${ASSET_2_ID}, ${TC_ORG_ID},
      'Customer Contact Database',
      'Name, email, phone, mailing address, purchase history',
      'contact', 'medium',
      'Order fulfillment and customer communications',
      'consent',
      'Salesforce Canada CRM', 'Sales & Marketing', '3 years after last activity',
      false, NULL,
      ${VENDOR_1_ID}, 'active',
      NOW(), NOW()
    ),
    (
      ${ASSET_3_ID}, ${TC_ORG_ID},
      'Website Analytics Logs',
      'IP addresses, browser fingerprints, page visit sequences',
      'other', 'low',
      'Website performance monitoring and UX improvement',
      'legitimate_interest',
      'AWS S3 (us-east-1)', 'Engineering', '12 months',
      true, 'USA',
      ${VENDOR_2_ID}, 'active',
      NOW(), NOW()
    )
    ON CONFLICT (id) DO NOTHING
  `
  console.log('  ✓ 3 data assets\n')

  // ── 6. PIA ─────────────────────────────────────────────────────────────────
  console.log('🔍 Seeding PIA…')
  await sql`
    INSERT INTO trustcore_pias (
      id, org_id, title, trigger_type, description,
      risk_score, status, reviewer_name,
      mitigation_plan,
      created_at, updated_at
    ) VALUES (
      ${PIA_1_ID}, ${TC_ORG_ID},
      'Employee Wellness App Integration',
      'new_system',
      'Assessment of privacy risks from integrating a third-party mental health app that processes sensitive health data of employees.',
      72, 'in_review', 'Priya Sharma',
      'Require data processing agreement, restrict data to anonymized aggregates, add opt-in consent flow.',
      NOW(), NOW()
    )
    ON CONFLICT (id) DO NOTHING
  `
  console.log('  ✓ 1 PIA\n')

  // ── 7. Consent records ─────────────────────────────────────────────────────
  console.log('✅ Seeding consent records…')
  await sql`
    INSERT INTO trustcore_consent_records (
      id, org_id, subject_name, subject_email, purpose,
      consent_method, granted_at, withdrawn_at,
      consent_text_version, evidence_ref,
      created_at, updated_at
    ) VALUES
    (
      ${CONSENT_1_ID}, ${TC_ORG_ID},
      'Sophie Martin', 'sophie.martin@example.com',
      'Marketing communications and promotional offers',
      'web_form', NOW() - INTERVAL '30 days', NULL,
      'v2.1', 'consent-log-2025-001',
      NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'
    ),
    (
      ${CONSENT_2_ID}, ${TC_ORG_ID},
      'Jean-François Leblanc', 'jf.leblanc@example.com',
      'Marketing communications and promotional offers',
      'email', NOW() - INTERVAL '10 days', NOW() - INTERVAL '2 days',
      'v2.1', 'consent-log-2025-002',
      NOW() - INTERVAL '10 days', NOW() - INTERVAL '2 days'
    )
    ON CONFLICT (id) DO NOTHING
  `
  console.log('  ✓ 2 consent records (1 active, 1 withdrawn)\n')

  // ── 8. DSR request ─────────────────────────────────────────────────────────
  console.log('📨 Seeding DSR request…')
  await sql`
    INSERT INTO trustcore_dsr_requests (
      id, org_id, requester_name, requester_email,
      request_type, identity_verified,
      received_at, due_at, completed_at,
      status, response_summary, denial_reason,
      created_at, updated_at
    ) VALUES (
      ${DSR_1_ID}, ${TC_ORG_ID},
      'Amina Kouassi', 'amina.kouassi@example.com',
      'access', true,
      NOW() - INTERVAL '5 days',
      NOW() + INTERVAL '25 days',
      NULL,
      'received', NULL, NULL,
      NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'
    )
    ON CONFLICT (id) DO NOTHING
  `
  console.log('  ✓ 1 DSR request (access, pending)\n')

  // ── 9. Incident ────────────────────────────────────────────────────────────
  console.log('🚨 Seeding incident…')
  await sql`
    INSERT INTO trustcore_incidents (
      id, org_id, title, description,
      incident_type, severity,
      date_detected, date_occurred,
      harm_assessment, serious_harm_likely,
      reported_to_cai, cai_reported_at,
      affected_individuals_notified, individual_notification_at,
      containment_actions, resolution_status,
      created_at, updated_at
    ) VALUES (
      ${INCIDENT_ID}, ${TC_ORG_ID},
      'Unauthorized Access to Customer Email List',
      'A misconfigured S3 bucket policy exposed a CSV export of customer email addresses (approx. 1,200 records) for approximately 6 hours before detection.',
      'unauthorized_access', 'high',
      NOW() - INTERVAL '14 days',
      NOW() - INTERVAL '14 days',
      'Email addresses only; no passwords, SIN, or financial data. Low risk of direct financial harm.',
      false,
      false, NULL,
      false, NULL,
      'Bucket policy corrected immediately. Access logs reviewed. No evidence of exfiltration.',
      'open',
      NOW() - INTERVAL '14 days', NOW() - INTERVAL '1 day'
    )
    ON CONFLICT (id) DO NOTHING
  `
  console.log('  ✓ 1 incident (investigating)\n')

  // ── 10. Compliance snapshot ────────────────────────────────────────────────
  console.log('📊 Seeding compliance snapshot…')
  await sql`
    INSERT INTO trustcore_compliance_snapshots (
      id, org_id, score, confidence, status,
      risks, summary,
      risk_count, blocking_count,
      triggered_by, created_at
    ) VALUES (
      ${SNAPSHOT_ID}, ${TC_ORG_ID},
      74, 81, 'at-risk',
      ${JSON.stringify([
        { key: 'missing_pia', label: 'PIA not completed for AWS vendor', severity: 'high' },
        { key: 'unreviewed_contract', label: 'AWS contract not reviewed', severity: 'high' },
        { key: 'cross_border_unmitigated', label: 'Cross-border transfer to USA without mitigation', severity: 'medium' },
      ])},
      ${JSON.stringify({
        strengths: ['Active privacy program', 'Privacy officer assigned', 'Consent records tracked'],
        gaps: ['Vendor PIA incomplete (AWS)', 'Contract review pending', 'Cross-border transfer risk unmitigated'],
      })},
      3, 2,
      'manual', NOW()
    )
    ON CONFLICT (id) DO NOTHING
  `
  console.log('  ✓ compliance snapshot (score: 74, at-risk)\n')

  await sql.end()

  console.log('═══════════════════════════════════════════════════════')
  console.log('  TrustCore test seed complete.')
  console.log('═══════════════════════════════════════════════════════')
  console.log()
  console.log('  Test credentials:')
  console.log()
  console.log('  Email                         Password    Role')
  console.log('  ─────────────────────────────────────────────────────')
  console.log('  admin@trustcore-demo.com      Test1234!   org_admin')
  console.log('  staff@trustcore-demo.com      Test1234!   org_viewer')
  console.log()
  console.log(`  Org ID: ${TC_ORG_ID}`)
  console.log()
  console.log('  Login at: http://localhost:3010/login')
  console.log('═══════════════════════════════════════════════════════')
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
