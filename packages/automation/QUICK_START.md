# Nzila Migration Automation — Quick Start Guide

**Version**: 1.0.0  
**Purpose**: Automated migration of 15 legacy platforms to unified Azure infrastructure

---

## 🎯 What This System Does

This automation dramatically reduces migration time from **175 weeks (sequential)** to **~40 weeks (parallel)** by:

1. **Analyzing** all 15 legacy platforms automatically (tech stack, database, auth, complexity)
2. **Generating** optimized `scripts-book.manifest.json` for each platform
3. **Creating** intelligent migration plans (parallel batching, dependency analysis)
4. **Provisioning** Azure infrastructure as code (Bicep templates)
5. **Standardizing** all platforms on Clerk auth + Azure Container Apps + PostgreSQL
6. **Sharing** code patterns across platforms (60%+ code reuse)

---

## 📦 Prerequisites

### Required
- **Python 3.12+** 
- **Node.js 20+** with **pnpm**
- **Azure CLI** (for infrastructure provisioning)
- **Git** (for repository management)

### Setup

```powershell
# Install Python dependencies (none required for base system)
# All scripts use standard library only

# Install template generator dependencies
cd nzila-scripts-book-template
pnpm install
pnpm build
```

---

## 🚀 Complete Workflow

### Step 1: Analyze All Platforms

```powershell
# Analyze all platforms in legacy-codebases/
python automation/orchestrator.py analyze --all

# Output: automation/data/platform_profiles.json
```

**What it does:**
- Scans each legacy codebase
- Detects framework (Next.js, Django, React+Vite, etc.)
- Counts entities (models, components, routes)
- Analyzes database (Drizzle, Prisma, Django ORM, Supabase)
- Detects authentication (Clerk, NextAuth, Supabase, custom)
- Estimates migration complexity and timeline

**Example output:**
```
✓ Analyzed: Union Eyes (EXTREME)
✓ Analyzed: C3uo (EXTREME)
✓ Analyzed: Abr Insights (HIGH)
...
```

---

### Step 2: Generate Manifests

```powershell
# Generate scripts-book manifests for all platforms
python automation/orchestrator.py generate-manifests

# Output: automation/data/manifests/*.manifest.json
```

**What it does:**
- Selects appropriate profile (Next.js, Django, Node API)
- Configures modules based on platform needs
- Sets up Clerk auth configuration
- Generates Azure resource names
- Creates migration phase plans

**Generated files:**
- `automation/data/manifests/union-eyes.manifest.json`
- `automation/data/manifests/c3uo.manifest.json`
- `automation/data/manifests/README.md` (summary)
- ...

---

### Step 3: Create Migration Plan

```powershell
# Create parallel migration plan (recommended)
python automation/orchestrator.py plan --strategy parallel

# Output: MIGRATION_PLAN.json + MIGRATION_PLAN.md
```

**What it does:**
- Groups platforms into intelligent batches
- Identifies parallelization opportunities
- Respects dependency constraints
- Optimizes resource allocation
- Calculates time savings

**Example plan:**
- **Batch 1**: Foundation (Union Eyes, C3UO) — 12 weeks sequential
- **Batch 2**: Next.js platforms (ABR Insights, CongoWave, etc.) — 10 weeks **parallel**
- **Batch 3**: Django platforms — 10 weeks **parallel**
- **Total**: ~40 weeks (77% time savings!)

---

### Step 4: Generate Azure Infrastructure

```powershell
# Generate Bicep templates and GitHub workflows
python automation/generators/azure_resource_manager.py generate-infra `
  automation/data/manifests/all_manifests.json `
  azure-infrastructure

# Output: azure-infrastructure/<platform-id>/
#   - main.bicep
#   - deploy.yml
#   - README.md
```

**What it does:**
- Creates Bicep infrastructure as code for each platform
- Generates GitHub Actions workflows with OIDC authentication
- Produces deployment instructions
- Configures Azure Container Apps, PostgreSQL, Key Vault, Managed Identity

---

### Step 5: Apply Scripts-Book Template (Per Platform)

```powershell
# For each platform, apply the template

# 1. Create target repository
mkdir ..\union-eyes-platform
cd ..\union-eyes-platform
git init

# 2. Copy manifest
cp ..\nzila-automation\automation\data\manifests\union-eyes.manifest.json `
   scripts-book.manifest.json

# 3. Apply template
cd ..\nzila-automation\nzila-scripts-book-template
pnpm sb:apply --target ..\..\union-eyes-platform

# 4. Review generated files
cd ..\..\union-eyes-platform
# scripts-book/, docs/, .github/workflows/, etc.
```

**What it generates:**
- `scripts-book/` — Bash/PowerShell/Python parity scripts
- `docs/` — Comprehensive documentation
- `.github/workflows/` — CI/CD pipelines
- `Dockerfile` — Containerization
- Security baselines, observability setup

---

### Step 6: Provision Azure Resources

```powershell
# First, create shared resources (one time)
python automation/generators/azure_resource_manager.py provision-shared

# Then, for each platform, deploy infrastructure
cd ..\azure-infrastructure\union-eyes

az login
az account set --subscription <subscription-id>

# Create resource group
az group create `
  --name rg-nzila-union-eyes-prod `
  --location canadacentral

# Deploy Bicep template
az deployment group create `
  --resource-group rg-nzila-union-eyes-prod `
  --template-file main.bicep
```

---

### Step 7: Configure Clerk Auth

For each platform:

1. **Create Clerk Application** (via Clerk Dashboard)
   - Go to [clerk.com](https://clerk.com)
   - Create new application
   - Copy API keys

2. **Configure Environment Variables**
   ```env
   CLERK_SECRET_KEY=sk_live_...
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
   ```

3. **Set in Azure Key Vault**
   ```powershell
   az keyvault secret set `
     --vault-name kv-unioneyes-prod `
     --name clerk-secret `
     --value "sk_live_..."
   ```

---

### Step 8: Migrate Code

For each platform, follow migration phases from the manifest:

1. **Phase 1**: Infrastructure Setup (Azure resources)
2. **Phase 2**: Database Migration (schema + data)
3. **Phase 3**: Auth Migration (Clerk integration)
4. **Phase 4**: Application Code (API routes, business logic)
5. **Phase 5**: Frontend Migration (UI components)
6. **Phase 6**: Testing & Validation
7. **Phase 7**: Production Cutover

**Use the generated scripts:**
```powershell
# Database migration
.\scripts-book\04-database-azure-postgresql\migrate.ps1

# Deploy application
.\scripts-book\05-deploy-container-apps\deploy.ps1
```

---

## 🔄 Quick Commands Reference

```powershell
# Full automated setup (one command!)
python automation/orchestrator.py full-setup

# Check migration status
python automation/orchestrator.py status

# Analyze single platform
python automation/orchestrator.py analyze --platform union-eyes

# Preview template application (dry run)
python automation/orchestrator.py apply-template --platform union-eyes --dry-run

# Sequential plan (if preferred)
python automation/orchestrator.py plan --strategy sequential
```

---

## 📊 Expected Results

### Analysis Output

```
PLATFORM ANALYSIS
============================================================
✓ Analyzed: Union Eyes (EXTREME)
  - Entities: 4,773
  - Framework: Next.js 14.2
  - Database: Drizzle (238 RLS policies)
  - Auth: Custom → Clerk (HIGH complexity)
  - Estimated: 12 weeks

✓ Analyzed: C3uo (EXTREME)
  - Entities: 485
  - Framework: Next.js
  - Database: Supabase
  - Auth: Supabase → Clerk (MEDIUM complexity)
  - Estimated: 10 weeks

... (15 platforms total)

ANALYSIS SUMMARY
============================================================
Total Platforms: 15
Total Entities: 12,000+
Total Migration Weeks (Sequential): 175
Complexity Distribution:
  LOW: 2
  MEDIUM: 4
  HIGH: 5
  EXTREME: 4
```

### Migration Plan Output

```
Nzila Migration Plan

Strategy: PARALLEL
Total Platforms: 15
Estimated Duration: 38 weeks
Sequential Baseline: 175 weeks
Time Savings: 137 weeks (78% reduction)

Migration Batches:

Batch 1: Foundation Platforms
- Duration: 12 weeks
- Execution: Sequential
- Platforms: union-eyes, c3uo

Batch 2: Next.js Platforms (Parallel)
- Duration: 10 weeks
- Execution: Parallel
- Platforms: abr-insights, congowave, cyberlearn, flow

... (more batches)
```

---

## 🎨 Pattern Library (Future Enhancement)

The system can extract reusable patterns:

- **Auth Adapters**: Standardized Clerk integration
- **Database Connections**: Azure PostgreSQL patterns
- **Error Handling**: Consistent error middleware
- **Logging**: OpenTelemetry setup
- **API Middleware**: Rate limiting, CORS, validation

*Note: Pattern extraction is planned for v1.1*

---

## 🔐 Security & Compliance

All generated infrastructure includes:

- ✅ **Managed Identities** (no hard-coded credentials)
- ✅ **OIDC Authentication** (GitHub → Azure)
- ✅ **Key Vault** for secrets management
- ✅ **Private Endpoints** for databases
- ✅ **Network Security Groups**
- ✅ **Audit Logging** (Azure Monitor)
- ✅ **Encryption** at rest and in transit

---

## 📈 Success Metrics

| Metric | Target | Notes |
|--------|--------|-------|
| **Total Migration Time** | <40 weeks | 77% reduction vs sequential |
| **Code Reuse** | >60% | Shared patterns across platforms |
| **Azure Consolidation** | 100% | Unified resource strategy |
| **Auth Standardization** | 100% | All on Clerk |
| **Automated Testing** | >80% | Generated test suites |
| **Zero-Downtime** | 100% | Blue-green deployments |

---

## 🆘 Troubleshooting

### "Platform not found"

Ensure your legacy codebases are in `legacy-codebases/` directory:

```
nzila-automation/
  legacy-codebases/
    union-eyes/
    c3uo/
    abr-insights/
    ...
```

### "No manifest found"

Run manifest generation first:

```powershell
python automation/orchestrator.py generate-manifests
```

### "Azure CLI not found"

Install Azure CLI:

```powershell
winget install Microsoft.AzureCLI
```

### Template generator fails

Ensure template dependencies are installed:

```powershell
cd nzila-scripts-book-template
pnpm install
pnpm build
```

---

## 📚 Next Steps

1. ✅ **Run full-setup**: `python automation/orchestrator.py full-setup`
2. ✅ **Review generated manifests**: Check `automation/data/manifests/`
3. ✅ **Review migration plan**: Read `MIGRATION_PLAN.md`
4. ✅ **Provision shared resources**: Azure Container Registry, Log Analytics
5. ✅ **Start with foundation platforms**: Union Eyes, C3UO
6. ✅ **Iterate and optimize**: Learn from first migrations
7. ✅ **Execute parallel batches**: Maximize efficiency

---

## 💡 Pro Tips

- **Start with one platform**: Test the full workflow with Union Eyes first
- **Use dry-run**: Preview template application before executing
- **Review generated code**: Customize scripts-book overrides as needed
- **Track progress**: Use the status command regularly
- **Document learnings**: Update migration plan based on actual experience

---

**Questions or issues?** This is a living system — iterate and improve as you migrate!
