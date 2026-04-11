# Nzila Migration Orchestration System (MOS)

**Version**: 1.0.0  
**Date**: February 17, 2026  
**Purpose**: Automate the migration of 15 legacy platforms to unified, production-ready infrastructure

---

## 🎯 SYSTEM OBJECTIVES

1. **Reduce Migration Time**: From 175 weeks (sequential) to **<40 weeks** through intelligent automation
2. **Ensure Standardization**: All platforms follow scripts-book template patterns
3. **Cross-Platform Intelligence**: Share code patterns, components, and configurations
4. **Unified Auth**: Clerk authentication across all platforms
5. **Azure Consolidation**: Single unified resource group strategy
6. **Quality Assurance**: Automated validation, testing, and compliance checks

---

## 🏗️ SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                  Migration Orchestration System                  │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   ANALYSIS   │      │  GENERATION  │      │  EXECUTION   │
│    LAYER     │      │    LAYER     │      │    LAYER     │
└──────────────┘      └──────────────┘      └──────────────┘
```

### Analysis Layer Components

1. **Platform Analyzer** (`platform_analyzer.py`)
   - Scans legacy codebase structure
   - Detects framework, language, dependencies
   - Analyzes database schema (Django models, Drizzle, Prisma, Supabase)
   - Identifies authentication patterns
   - Maps API endpoints
   - Counts entities, migrations, components

2. **Pattern Extractor** (`pattern_extractor.py`)
   - Identifies reusable components across platforms
   - Catalogs authentication adapters
   - Extracts database migration patterns
   - Detects shared UI components
   - Maps common business logic patterns
   - Builds pattern library database

3. **Dependency Analyzer** (`dependency_analyzer.py`)
   - Creates platform dependency graph
   - Identifies migration order constraints
   - Detects parallelization opportunities
   - Maps shared infrastructure needs

### Generation Layer Components

4. **Manifest Generator** (`manifest_generator.py`)
   - Auto-generates `scripts-book.manifest.json` for each platform
   - Selects appropriate profile (Next.js, Django, Node API)
   - Configures modules based on platform needs
   - Injects Clerk auth configuration
   - Sets up Azure resource naming

5. **Code Generator** (`code_generator.py`)
   - Invokes scripts-book template generator
   - Injects platform-specific code
   - Applies shared patterns from pattern library
   - Generates Clerk auth adapters
   - Creates Azure infrastructure as code (Bicep)
   - Produces migration scripts

6. **Migration Planner** (`migration_planner.py`)
   - Creates optimized migration roadmap
   - Schedules parallel migrations
   - Allocates resources
   - Defines testing milestones
   - Sets up rollback strategies

### Execution Layer Components

7. **Azure Resource Manager** (`azure_resource_manager.py`)
   - Creates unified resource groups
   - Provisions Azure Container Apps
   - Sets up Azure PostgreSQL Flexible Servers
   - Configures networking, security groups
   - Manages Managed Identities for OIDC
   - Sets up monitoring and logging

8. **Migration Executor** (`migration_executor.py`)
   - Coordinates migration execution
   - Runs database migrations
   - Deploys infrastructure
   - Configures Clerk applications
   - Executes smoke tests
   - Manages rollbacks

9. **Progress Tracker** (`progress_tracker.py`)
   - Monitors migration status per platform
   - Tracks blockers and issues
   - Generates progress reports
   - Alerts on failures
   - Calculates timeline projections

---

## 📊 DATA MODELS

### Platform Profile
```python
{
    "platform_id": "union-eyes",
    "name": "UnionEyes",
    "business_vertical": "Uniontech",
    "size_mb": 332.81,
    "entity_count": 4773,
    "complexity": "EXTREME",
    
    "tech_stack": {
        "framework": "Next.js",
        "version": "14.2",
        "language": "TypeScript",
        "package_manager": "pnpm",
        "monorepo": true,
        "build_tool": "turbo"
    },
    
    "database": {
        "orm": "Drizzle",
        "provider": "PostgreSQL",
        "migrations_count": 342,
        "has_rls": true,
        "rls_policies": 238
    },
    
    "auth": {
        "current": "custom",
        "target": "clerk",
        "migration_complexity": "HIGH"
    },
    
    "infrastructure": {
        "current": null,
        "target": "azure-container-apps",
        "resource_group": "rg-nzila-union-eyes-prod",
        "region": "Canada Central"
    },
    
    "migration": {
        "priority": 1,
        "estimated_weeks": 12,
        "dependencies": [],
        "blockers": []
    }
}
```

### Pattern Library Entry
```python
{
    "pattern_id": "clerk-auth-nextjs-middleware",
    "name": "Clerk Auth Middleware for Next.js",
    "category": "authentication",
    "source_platforms": ["union-eyes", "abr-insights"],
    "reusability_score": 0.95,
    "code_template": "...",
    "dependencies": ["@clerk/nextjs"],
    "documentation": "..."
}
```

### Migration Plan
```python
{
    "plan_id": "nzila-unified-migration-2026",
    "created": "2026-02-17",
    "total_platforms": 15,
    "estimated_weeks_sequential": 175,
    "estimated_weeks_parallel": 38,
    
    "phases": [
        {
            "phase": 1,
            "name": "Foundation Platforms",
            "weeks": 8,
            "platforms": ["union-eyes", "c3uo-diasporacore"],
            "goal": "Establish patterns for Next.js + Django migrations"
        },
        {
            "phase": 2,
            "name": "Parallel Batch 1",
            "weeks": 10,
            "platforms": ["abr-insights", "congowave", "cyberlearn", "agrimoops"],
            "goal": "Apply established patterns in parallel"
        }
    ]
}
```

---

## 🚀 USAGE WORKFLOW

### Phase 1: Analysis
```bash
# Analyze all platforms
python automation/orchestrator.py analyze --all

# Analyze specific platform
python automation/orchestrator.py analyze --platform union-eyes

# Extract patterns across platforms
python automation/orchestrator.py extract-patterns --output automation/data/pattern-library.json
```

### Phase 2: Planning
```bash
# Generate migration plan
python automation/orchestrator.py plan --strategy parallel --output MIGRATION_PLAN.json

# Generate manifests for all platforms
python automation/orchestrator.py generate-manifests --all
```

### Phase 3: Execution
```bash
# Execute migration for specific platform
python automation/orchestrator.py migrate --platform union-eyes --phase scaffold

# Provision Azure resources
python automation/orchestrator.py azure-provision --platform union-eyes

# Full automated migration
python automation/orchestrator.py migrate --platform union-eyes --full
```

### Phase 4: Monitoring
```bash
# Check migration status
python automation/orchestrator.py status --all

# Generate progress report
python automation/orchestrator.py report --format markdown --output MIGRATION_PROGRESS.md
```

---

## 🔧 INTELLIGENT AUTOMATION FEATURES

### 1. Smart Profile Detection
Automatically selects the best scripts-book profile based on codebase analysis:
- **Next.js projects**: `nextjs-aca-azurepg-clerk`
- **Django projects**: `django-aca-azurepg`
- **Express/Fastify APIs**: `nodeapi-aca-azurepg-clerk`

### 2. Code Pattern Sharing
Identifies reusable code across platforms:
- Auth adapters (all → Clerk)
- Database connection patterns
- Error handling utilities
- Logging/observability setup
- API middleware
- UI component library

### 3. Clerk Migration Automation
For each platform:
1. Creates Clerk application via API
2. Configures OAuth providers
3. Sets up webhooks for user sync
4. Generates environment variables
5. Creates auth middleware from templates
6. Migrates existing user data (with consent)

### 4. Azure Resource Optimization
- **Unified Resource Group Strategy**: `rg-nzila-{vertical}-{env}`
- **Shared Services**: Single Azure Container Registry, shared monitoring
- **Cost Optimization**: Right-sized container apps, serverless PostgreSQL
- **Network Isolation**: VNets per vertical, private endpoints

### 5. Database Migration Intelligence
- Detects ORM patterns (Drizzle, Prisma, Django ORM)
- Generates unified schema documentation
- Creates migration scripts with rollback support
- Validates data integrity post-migration
- Handles RLS policies migration (Supabase → PostgreSQL)

### 6. Parallel Execution
Identifies platforms that can migrate simultaneously:
- Group by tech stack similarity
- Respect dependency constraints
- Optimize resource allocation
- Monitor concurrent operations

---

## 📈 SUCCESS METRICS

| Metric | Target |
|--------|--------|
| **Total Migration Time** | < 40 weeks (77% reduction) |
| **Code Reuse** | > 60% across platforms |
| **Azure Resource Consolidation** | Single unified strategy |
| **Auth Standardization** | 100% on Clerk |
| **Automated Testing Coverage** | > 80% |
| **Zero-Downtime Migrations** | 100% |
| **Cost Optimization** | 30% reduction vs separate deployments |

---

## 🔐 SECURITY & COMPLIANCE

- **Secrets Management**: Azure Key Vault integration
- **OIDC Authentication**: GitHub Actions → Azure via Managed Identity
- **Network Security**: Private endpoints, VNet integration
- **Data Protection**: Encrypted at rest and in transit
- **Compliance**: GDPR, PIPEDA, HIPAA (where applicable)
- **Audit Logging**: All operations logged to Azure Monitor

---

## 🧩 EXTENSIBILITY

The system is designed for extensibility:
- **Custom Analyzers**: Add platform-specific detectors
- **Pattern Plugins**: Contribute to pattern library
- **Profile Extensions**: Create custom scripts-book profiles
- **Hook System**: Pre/post migration hooks for custom logic

---

## 📝 DELIVERABLES

1. **Per Platform**:
   - Generated `scripts-book.manifest.json`
   - Complete scaffolded repository structure
   - Azure infrastructure as code (Bicep)
   - Clerk application configuration
   - Migration documentation
   - Testing suite

2. **Global**:
   - Pattern library database
   - Unified Azure resource topology
   - Migration progress dashboard
   - Knowledge base of lessons learned

---

## 🎯 NEXT STEPS

1. ✅ Build core orchestrator framework
2. ✅ Implement platform analyzer
3. ✅ Create manifest generator
4. ✅ Build Azure resource manager
5. ✅ Develop migration executor
6. ✅ Test with pilot platform (UnionEyes)
7. ✅ Iterate and optimize
8. ✅ Execute full portfolio migration
