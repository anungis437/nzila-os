# Runbook Template Schema

**Status:** Draft  
**Last Updated:** 2026-02-18  
**Owner:** Platform Team

## Purpose

Define a templating system for operational runbooks that supports:
- Replicability across entities
- Version control and lineage tracking
- Customization with divergence logging
- Automated compliance evidence capture

## Template Structure

```yaml
# Runbook Template (runbook-template.yaml)
template:
  id: uuid
  name: string
  version: semver
  category: security | infrastructure | finance | governance
  description: string
  
  # Replicability metadata
  replicability:
    replicationId: uuid
    sourceTemplateId: uuid?
    sourceVersion: semver?
    relation: IS_TEMPLATE | CLONED_FROM | DERIVED_FROM
    
  # Template content
  content:
    title: string
    severity: P1 | P2 | P3 | P4
    steps: RunbookStep[]
    references: string[]
    dependencies: string[]

# Individual Step
RunbookStep:
  order: integer
  action: string
  command: string?
  verification: string?
  timeout: integer (seconds)
  rollback: string?
  
# Runbook Instance (derived from template)
runbook_instance:
  template_id: uuid
  entity_id: uuid
  
  # Customizations from template
  divergence_log:
    - field: string
      original: any
      modified: any
      reason: string
      modified_by: uuid
      modified_at: datetime
      
  # Execution tracking
  executions: Execution[]
  
  # Compliance evidence
  evidence:
    blob_path: string
    sha256: string
    captured_at: datetime
```

## Example Templates

### Standard Incident Response Template

```yaml
template:
  id: ir-001
  name: Standard Incident Response
  version: 1.0.0
  category: security
  description: Standard incident response procedure for security events
  
replicability:
  replicationId: a1b2c3d4-...
  isTemplate: true
  isPublic: true
  
content:
  title: Security Incident Response
  severity: P1
  steps:
    - order: 1
      action: Detect and Triage
      command: |
        1. Review alert details
        2. Determine severity (P1-P4)
        3. Create incident ticket
      verification: Ticket created with severity label
      timeout: 300
      rollback: N/A
      
    - order: 2
      action: Contain
      command: |
        1. Isolate affected systems
        2. Preserve evidence
        3. Block attacker IP
      verification: Systems isolated, evidence preserved
      timeout: 900
      rollback: Restore network access
      
    - order: 3
      action: Eradicate
      command: |
        1. Remove malware
        2. Patch vulnerabilities
        3. Reset compromised credentials
      verification: Clean system state
      timeout: 1800
      
    - order: 4
      action: Recover
      command: |
        1. Restore from clean backups
        2. Verify system integrity
        3. Monitor for recurrence
      verification: Services operational
      timeout: 3600
      
    - order: 5
      action: Post-Incident Review
      command: |
        1. Document timeline
        2. Identify root cause
        3. Update runbooks
        4. Schedule review meeting
      verification: PIR document complete
      timeout: 86400

  references:
    - security/contact.md
    - infrastructure/backup-recovery.md
    
  dependencies:
    - PagerDuty API access
    - AWS Console access
    - Slack #security-incidents
```

### Finance Close Template

```yaml
template:
  id: fc-001
  name: Monthly Finance Close
  version: 1.0.0
  category: finance
  description: Standard month-end close procedure
  
replicability:
  replicationId: f1f2f3f4-...
  isTemplate: true
  
content:
  title: Month-End Finance Close
  severity: P2
  steps:
    - order: 1
      action: Lock Period
      command: Close accounting period in system
      verification: Period shows "Closed" status
      timeout: 60
      
    - order: 2
      action: Reconcile Bank Accounts
      command: Run bank reconciliation report
      verification: All accounts reconciled to $0
      timeout: 3600
      
    - order: 3
      action: Accrue Expenses
      command: Review and post accruals
      verification: Accrual log matches invoices
      timeout: 7200
      
    - order: 4
      action: Generate Reports
      command: Run P&L, Balance Sheet, Cash Flow
      verification: Reports match subledgers
      timeout: 1800
      
    - order: 5
      action: Management Review
      command: Submit reports to CFO
      verification: CFO approval recorded
      timeout: 86400
```

## Clone Example

```yaml
# Cloning for a specific entity
clone:
  source_template_id: ir-001
  target_entity_id: entity-123
  customizations:
    - field: content.steps[2].command
      original: "3. Reset compromised credentials"
      modified: "3. Reset compromised credentials\n4. Rotate API keys"
      reason: "API-heavy environment"
      
divergence_log:
  - field: content.steps[2].command
    original: "3. Reset compromised credentials"
    modified: "3. Reset compromised credentials\n4. Rotate API keys"
    reason: "API-heavy environment"
    modified_by: user-456
    modified_at: 2026-02-18T10:00:00Z
    
compliance_evidence:
  - type: runbook_clone
    blob_path: /compliance/runbooks/entity-123/ir-001-clone.yaml
    sha256: abc123...
    captured_at: 2026-02-18T10:00:00Z
```

## Integration with Compliance

The template system integrates with the Required Evidence Map:

```yaml
evidence_requirements:
  - control_family: Change Management
    artifact_type: runbook_clone
    blob_path_template: /compliance/runbooks/{entity_id}/{template_id}-clone.yaml
    sha256_required: true
    retention_class: PERMANENT
    
  - control_family: Incident Response
    artifact_type: execution_log
    blob_path_template: /compliance/incidents/{incident_id}/execution.yaml
    sha256_required: true
    retention_class: 7_YEARS
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/runbooks/templates | List available templates |
| POST | /api/runbooks/templates | Create new template |
| GET | /api/runbooks/templates/{id} | Get template details |
| POST | /api/runbooks/templates/{id}/clone | Clone template for entity |
| GET | /api/runbooks/instances | List entity instances |
| POST | /api/runbooks/instances/{id}/execute | Execute runbook |
