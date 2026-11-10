# Runbook: Union Eyes V2 staging deploy identities (new subscription)

**Status:** prepared, **not executed**. No command in this runbook has been run. Run it only after the
security review and an approved Union Eyes STAGING change record (product-owner directive of
2026-11-04, item 5). Production deployment, data migration and decommissioning are **not** authorized
by this runbook.

| Item | Value |
| --- | --- |
| Tenant | `cc15259a-d2bf-421f-8e44-dccf8dc6232a` |
| Subscription (new) | `d562ba7f-d891-4504-a489-10917c0ebaaf` |
| Staging resource group | `nzila-canada-staging-rg` (Canada Central), created in step 1 |
| Registry | `nzilaventuresacr` (Basic) in `nzila-canada-prod-rg` |
| Template | `infrastructure/bicep/ue-v2/main.bicep`, `env=staging` |
| Repository | `anungis437/nzila-os` |
| Workflows | `.github/workflows/ue-v2-staging-build.yml`, `.github/workflows/ue-v2-staging-deploy.yml` |

## 1. Design

Three OIDC identities, each bound to one GitHub **environment** (never to a branch) and each with no
client secret. No registry admin user is used anywhere.

| GitHub environment | Identity | Job | Can do |
| --- | --- | --- | --- |
| `build` (exists) | `nzila-os-build` (exists, CHG-2026-0113) | build and push | push images to `nzilaventuresacr` |
| `ue-staging-plan` (new) | `nzila-os-ue-staging-plan` (new) | registry attestation and `what-if` | read only, plus `what-if` |
| `ue-staging` (new, founder-operated manual checkpoint) | `nzila-os-ue-staging-deploy` (new) | apply | deploy the V2 template into `nzila-canada-staging-rg` |

The identities are user-assigned managed identities kept in a separate resource group,
`nzila-canada-cicd-rg`. They must **not** live in `nzila-canada-staging-rg`: the deployer manages
identities there, and it must not be able to edit its own federated credentials.

Why the deployer needs more than Container Apps Contributor and Managed Identity Operator: the V2
template creates a VNet, private DNS zones, private endpoints, Key Vault, storage, Azure Managed Redis,
PostgreSQL Flexible Server, a user-assigned identity, a Container Apps environment, apps and a job, alert
rules and three role assignments. It gets a custom role limited to those resource providers on the
staging resource group only, not built-in Contributor. It holds nothing at subscription scope.

## 2. Role assignments and federated credentials (complete list)

The platform engineer creates exactly these. Nothing else is needed, and nothing broader is acceptable.

### `nzila-os-build` (existing, verify only)

| Role | Scope |
| --- | --- |
| `AcrPush` | registry `nzilaventuresacr` |

Federated credential (existing): subject `repo:anungis437/nzila-os:environment:build`. Verify that it
has no other role assignment (`az role assignment list --assignee <principalId> --all`).

### `nzila-os-ue-staging-plan` (new)

| Role | Scope | Why |
| --- | --- | --- |
| `Reader` | resource group `nzila-canada-staging-rg` | what-if reads current state |
| `Nzila UE Deployment What-If` (custom, below) | resource group `nzila-canada-staging-rg` | `what-if` on the staging group |
| `Nzila UE Deployment What-If` (custom) | resource group `nzila-canada-prod-rg` | the template's `acr-pull` module is a nested deployment in the registry's group |
| `Reader` | registry `nzilaventuresacr` | `az acr login --expose-token` resolves the registry |
| `AcrPull` | registry `nzilaventuresacr` | reads manifests and config labels for digest attestation |
| `Reader` | workspace `nzila-canada-prod-law` and the action group, **only if** the staging parameters reference them | what-if resolves the existing references |

Federated credential: name `gh-ue-staging-plan`, issuer `https://token.actions.githubusercontent.com`,
subject `repo:anungis437/nzila-os:environment:ue-staging-plan`, audience `api://AzureADTokenExchange`.

### `nzila-os-ue-staging-deploy` (new)

| Role | Scope | Why |
| --- | --- | --- |
| `Nzila UE V2 Staging Deployer` (custom, below) | resource group `nzila-canada-staging-rg` | create and update the V2 stack's resources |
| `Role Based Access Control Administrator`, **conditioned** to assign or delete only `Key Vault Secrets User` and `Key Vault Crypto User` for service principals | resource group `nzila-canada-staging-rg` | the template grants the app identity Key Vault access |
| `Role Based Access Control Administrator`, **conditioned** to assign or delete only `AcrPull` for service principals | registry `nzilaventuresacr` | the template grants the app identity `AcrPull` |
| `Nzila UE Deployment What-If` and `Nzila UE Cross-RG Deployment Writer` (custom, below) | resource group `nzila-canada-prod-rg` | nested `acr-pull` deployment record and its what-if. Grants no write on any resource in that group |
| `Reader` and `AcrPull` | registry `nzilaventuresacr` | digest re-attestation at apply time |
| `Nzila UE Shared Monitoring Consumer` (custom, below) | workspace `nzila-canada-prod-law` and the action group, **only if** the staging parameters reference them | the Container Apps environment reads the workspace key; alerts reference the action group |

Federated credential: name `gh-ue-staging`, issuer `https://token.actions.githubusercontent.com`,
subject `repo:anungis437/nzila-os:environment:ue-staging`, audience `api://AzureADTokenExchange`.

**Never assign** to these identities: Owner, Contributor or User Access Administrator at any scope; any
role at subscription scope; any Key Vault data-plane role; any role on `nzila-os-web-prod` or other
resources in `nzila-canada-prod-rg`.

Shared monitoring note: if the staging parameters point at `nzila-canada-prod-law`, staging logs share
the production workspace and its daily cap. A small staging workspace inside `nzila-canada-staging-rg`
removes the last two cross-group assignments; that is a template choice for the Bicep parameters, not for
this runbook.

## 3. GitHub configuration

| Environment | Protection | Secrets (names only) | Variables |
| --- | --- | --- | --- |
| `ue-staging-plan` | deployment branches: `main` only; no reviewers | `AZURE_CLIENT_ID` (plan identity client ID), `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` | none |
| `ue-staging` | deployment branches: `main` only; **founder-operated manual approval** (both GitHub accounts are the same owner; do not assert independent review; configure a legitimate owner approval path) | `AZURE_CLIENT_ID` (deploy identity client ID), `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `UE_V2_STAGING_DB_ADMIN_PASSWORD` (generated, stored only here) | none |
| `build` (exists) | unchanged | unchanged | `AZURE_AD_CLIENT_ID_STAGING`, `AZURE_AD_TENANT_ID_STAGING` (public Entra identifiers baked into the staging app image) |

Do not create `PLAYWRIGHT_TEST_AUTH`, `UE_E2E_RISK_BYPASS` or `UNION_EYES_ACCEPTANCE_AUTH_ENABLED` in any
of these environments. The deploy workflow refuses parameters that contain them.

## 4. Commands (not executed; run in order after approval)

Run as a platform engineer who holds Owner or User Access Administrator on the new subscription, from a
shell signed in with `az login --tenant cc15259a-d2bf-421f-8e44-dccf8dc6232a`.

### Step 0: variables

```bash
SUB=d562ba7f-d891-4504-a489-10917c0ebaaf
TENANT=cc15259a-d2bf-421f-8e44-dccf8dc6232a
LOC=canadacentral
REPO=anungis437/nzila-os
STAGING_RG=nzila-canada-staging-rg
CICD_RG=nzila-canada-cicd-rg
PROD_RG=nzila-canada-prod-rg
az account set --subscription "$SUB"
test "$(az account show --query tenantId -o tsv)" = "$TENANT"
ACR_ID=$(az acr show -n nzilaventuresacr -g "$PROD_RG" --query id -o tsv)
LAW_ID=$(az monitor log-analytics workspace show -g "$PROD_RG" -n nzila-canada-prod-law --query id -o tsv)
```

### Step 1: resource groups

```bash
az group create -n "$STAGING_RG" -l "$LOC" --tags environment=staging service=union-eyes-v2 managedBy=bicep
az group create -n "$CICD_RG" -l "$LOC" --tags purpose=github-oidc-identities
STAGING_RG_ID=$(az group show -n "$STAGING_RG" --query id -o tsv)
PROD_RG_ID=$(az group show -n "$PROD_RG" --query id -o tsv)
```

### Step 2: custom roles

```bash
cat > ue-whatif-role.json <<JSON
{
  "Name": "Nzila UE Deployment What-If",
  "Description": "Run ARM what-if and validate in a resource group. No resource writes.",
  "Actions": [
    "Microsoft.Resources/deployments/read",
    "Microsoft.Resources/deployments/whatIf/action",
    "Microsoft.Resources/deployments/validate/action",
    "Microsoft.Resources/deployments/operationstatuses/read",
    "Microsoft.Resources/subscriptions/resourceGroups/read"
  ],
  "NotActions": [],
  "AssignableScopes": ["$STAGING_RG_ID", "$PROD_RG_ID"]
}
JSON
az role definition create --role-definition @ue-whatif-role.json

cat > ue-crossrg-deployment-role.json <<JSON
{
  "Name": "Nzila UE Cross-RG Deployment Writer",
  "Description": "Create the deployment record of the nested acr-pull module. Each resource it touches is still authorized separately.",
  "Actions": [
    "Microsoft.Resources/deployments/read",
    "Microsoft.Resources/deployments/write",
    "Microsoft.Resources/deployments/operations/read",
    "Microsoft.Resources/deployments/operationstatuses/read"
  ],
  "NotActions": [],
  "AssignableScopes": ["$PROD_RG_ID"]
}
JSON
az role definition create --role-definition @ue-crossrg-deployment-role.json

cat > ue-staging-deployer-role.json <<JSON
{
  "Name": "Nzila UE V2 Staging Deployer",
  "Description": "Deploy infrastructure/bicep/ue-v2 into the staging resource group only. No data-plane actions.",
  "Actions": [
    "Microsoft.Resources/deployments/*",
    "Microsoft.Resources/subscriptions/resourceGroups/read",
    "Microsoft.Authorization/*/read",
    "Microsoft.App/*",
    "Microsoft.ManagedIdentity/userAssignedIdentities/*",
    "Microsoft.Network/virtualNetworks/*",
    "Microsoft.Network/privateDnsZones/*",
    "Microsoft.Network/privateEndpoints/*",
    "Microsoft.Network/locations/*",
    "Microsoft.KeyVault/vaults/*",
    "Microsoft.KeyVault/locations/*/read",
    "Microsoft.Storage/storageAccounts/*",
    "Microsoft.Cache/redisEnterprise/*",
    "Microsoft.Cache/locations/*",
    "Microsoft.DBforPostgreSQL/flexibleServers/*",
    "Microsoft.DBforPostgreSQL/locations/*",
    "Microsoft.Insights/metricAlerts/*",
    "Microsoft.Insights/scheduledQueryRules/*",
    "Microsoft.Insights/diagnosticSettings/*",
    "Microsoft.OperationalInsights/workspaces/read"
  ],
  "NotActions": [
    "Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials/*",
    "Microsoft.Authorization/*/write",
    "Microsoft.Authorization/*/delete"
  ],
  "DataActions": [],
  "AssignableScopes": ["$STAGING_RG_ID"]
}
JSON
az role definition create --role-definition @ue-staging-deployer-role.json

cat > ue-monitoring-consumer-role.json <<JSON
{
  "Name": "Nzila UE Shared Monitoring Consumer",
  "Description": "Attach the staging Container Apps environment and alerts to the shared workspace and action group.",
  "Actions": [
    "Microsoft.OperationalInsights/workspaces/read",
    "Microsoft.OperationalInsights/workspaces/sharedKeys/action",
    "Microsoft.Insights/actionGroups/read"
  ],
  "NotActions": [],
  "AssignableScopes": ["$PROD_RG_ID"]
}
JSON
az role definition create --role-definition @ue-monitoring-consumer-role.json
```

If the first `what-if` run of the deploy identity reports `AuthorizationFailed` for an action missing
from `Nzila UE V2 Staging Deployer`, add that single action to the custom role. Do not replace it with
built-in Contributor; if that is ever unavoidable, scope Contributor to `nzila-canada-staging-rg` only
and record the reason in the change record.

### Step 3: identities and federated credentials

```bash
az identity create -g "$CICD_RG" -n nzila-os-ue-staging-plan
az identity create -g "$CICD_RG" -n nzila-os-ue-staging-deploy
PLAN_PID=$(az identity show -g "$CICD_RG" -n nzila-os-ue-staging-plan --query principalId -o tsv)
DEPLOY_PID=$(az identity show -g "$CICD_RG" -n nzila-os-ue-staging-deploy --query principalId -o tsv)

az identity federated-credential create -g "$CICD_RG" --identity-name nzila-os-ue-staging-plan \
  -n gh-ue-staging-plan --issuer https://token.actions.githubusercontent.com \
  --subject "repo:${REPO}:environment:ue-staging-plan" --audiences api://AzureADTokenExchange
az identity federated-credential create -g "$CICD_RG" --identity-name nzila-os-ue-staging-deploy \
  -n gh-ue-staging --issuer https://token.actions.githubusercontent.com \
  --subject "repo:${REPO}:environment:ue-staging" --audiences api://AzureADTokenExchange
```

### Step 4: role assignments

```bash
assign() { az role assignment create --assignee-object-id "$1" --assignee-principal-type ServicePrincipal --role "$2" --scope "$3"; }

# Plan identity
assign "$PLAN_PID" Reader "$STAGING_RG_ID"
assign "$PLAN_PID" "Nzila UE Deployment What-If" "$STAGING_RG_ID"
assign "$PLAN_PID" "Nzila UE Deployment What-If" "$PROD_RG_ID"
assign "$PLAN_PID" Reader "$ACR_ID"
assign "$PLAN_PID" AcrPull "$ACR_ID"
assign "$PLAN_PID" Reader "$LAW_ID"            # only if staging parameters use nzila-canada-prod-law
# assign "$PLAN_PID" Reader "<action group id>" # only if staging parameters use a prod-RG action group

# Deploy identity
assign "$DEPLOY_PID" "Nzila UE V2 Staging Deployer" "$STAGING_RG_ID"
assign "$DEPLOY_PID" "Nzila UE Deployment What-If" "$PROD_RG_ID"
assign "$DEPLOY_PID" "Nzila UE Cross-RG Deployment Writer" "$PROD_RG_ID"
assign "$DEPLOY_PID" Reader "$ACR_ID"
assign "$DEPLOY_PID" AcrPull "$ACR_ID"
assign "$DEPLOY_PID" "Nzila UE Shared Monitoring Consumer" "$LAW_ID"            # only if used
# assign "$DEPLOY_PID" "Nzila UE Shared Monitoring Consumer" "<action group id>" # only if used

# Conditioned RBAC administration (role definition GUIDs are built-in and fixed)
KV_SECRETS_USER=4633458b-17de-408a-b874-0445c86b69e6
KV_CRYPTO_USER=12338af0-0e69-4776-bea7-57ae8d297424
ACR_PULL=7f951dda-4ed3-4680-a7ca-43fe172d538d
cond() {
  printf '%s' "((!(ActionMatches{'Microsoft.Authorization/roleAssignments/write'})) OR (@Request[Microsoft.Authorization/roleAssignments:RoleDefinitionId] ForAnyOfAnyValues:GuidEquals {$1} AND @Request[Microsoft.Authorization/roleAssignments:PrincipalType] StringEqualsIgnoreCase 'ServicePrincipal')) AND ((!(ActionMatches{'Microsoft.Authorization/roleAssignments/delete'})) OR (@Resource[Microsoft.Authorization/roleAssignments:RoleDefinitionId] ForAnyOfAnyValues:GuidEquals {$1}))"
}
az role assignment create --assignee-object-id "$DEPLOY_PID" --assignee-principal-type ServicePrincipal \
  --role "Role Based Access Control Administrator" --scope "$STAGING_RG_ID" \
  --condition "$(cond "$KV_SECRETS_USER, $KV_CRYPTO_USER")" --condition-version 2.0
az role assignment create --assignee-object-id "$DEPLOY_PID" --assignee-principal-type ServicePrincipal \
  --role "Role Based Access Control Administrator" --scope "$ACR_ID" \
  --condition "$(cond "$ACR_PULL")" --condition-version 2.0
```

### Step 5: verify (read-only)

```bash
for ID in nzila-os-ue-staging-plan nzila-os-ue-staging-deploy; do
  PID=$(az identity show -g "$CICD_RG" -n "$ID" --query principalId -o tsv)
  az role assignment list --assignee "$PID" --all --query "[].{role:roleDefinitionName, scope:scope, condition:condition}" -o table
  az identity federated-credential list -g "$CICD_RG" --identity-name "$ID" --query "[].{name:name, subject:subject}" -o table
done
```

Expected: exactly the rows in section 2, no subscription-scope row, and one federated credential per
identity whose subject ends in `environment:ue-staging-plan` or `environment:ue-staging`.

### Step 6: GitHub environments

Create `ue-staging-plan` and `ue-staging` in the repository settings with the protections and secret
names in section 3. Put the client IDs from
`az identity show -g "$CICD_RG" -n <name> --query clientId -o tsv` into each environment's
`AZURE_CLIENT_ID`. Generate the database admin password with a password manager and store it only as
the `ue-staging` secret `UE_V2_STAGING_DB_ADMIN_PASSWORD`.

## 5. Using the pipeline (after setup)

1. Run **Union Eyes V2 · Staging Build** from `main` with `source_sha` and the two upstream images
   pinned by digest. Download the `ue-v2-staging-release-manifest-<sha>` artifact.
2. Run **Union Eyes V2 · Staging Deploy** with `operation=what-if` and the three digests from the
   manifest. Review the `ue-v2-staging-what-if-<run>` artifact.
3. Raise a change record `CHG-YYYY-NNNN.json` under `ops/change-records/` with `service: union-eyes`,
   `environment: STAGING`, approvals, window, and `linked_commits` containing the source SHA. Merge it.
4. Run the deploy workflow again with `operation=apply` and `change_record_id`. A reviewer of
   `ue-staging` reads the what-if in that run's summary and artifact, then approves. The apply job
   re-runs `what-if` and refuses if the change set differs from the reviewed one.

## 6. Rollback and stop conditions

- Stop if any gate prints a defect. Do not edit the gate to pass it.
- Stop if `what-if` shows a `Delete`, a change outside `nzila-canada-staging-rg` other than the
  registry `AcrPull` assignment, or any resource in the old subscription. The gate refuses these.
- To revoke the pipeline: delete the two federated credentials (step 3). The workflows then fail at
  `azure/login` and nothing else changes.
- The staging stack holds synthetic data only. Tearing it down is a separate, change-recorded action
  and is not part of this pipeline.

## 7. Legacy workflows

The `build` and `production` GitHub environments now resolve to the new subscription (CHG-2026-0113).
The legacy Union Eyes workflows (`deploy-union-eyes.yml`, `union-eyes-authority-rollout.yml`,
`retire-legacy-union-eyes-ca.yml`, `ue-staging-discovery.yml`, `ue-build-push-proof.yml`, and
`canary-deploy.yml` when `app=nzila-os-union-eyes`) now assert the legacy subscription
`5d819f33-d16f-429c-a3c0-5b0e94740ba3` right after `azure/login` and stop otherwise. They are kept,
not deleted: decommissioning is not authorized.

## 2026-11-10 qualification update

Azure what-if run [42753019682](https://github.com/anungis437/nzila-os/actions/runs/42753019682) completed the provider what-if step, superseding the earlier Canada Central ManagedEnvironmentCount rejection. Its downstream policy gate rejected an Azure symbolic AcrPull role assignment; PR [#1159](https://github.com/anungis437/nzila-os/pull/1159) restricts acceptance to the exact intended staging identity and built-in AcrPull role. The founder-operated change approval is recorded in CHG-2026-0114. A new complete what-if and staging apply are still required; this is not deployed-runtime evidence.
