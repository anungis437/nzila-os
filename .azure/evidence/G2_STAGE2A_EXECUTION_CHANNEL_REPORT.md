# Stage 2A governed builder execution

Mission: `NZ-20261008-INFRA-001`  
Disposition: `STAGE2A_BUILDER_ARTIFACT_FAILED`  
Toolchain: `STAGE2_BUILD_TOOLCHAIN_UNRESOLVED`  
Overall G2: `FAIL`

## Safety and preflight

Reviewed Microsoft Custom Script Extension documentation, exact public
package-release source, embedded script delivery, root execution, status/log
persistence, sequence guards and uninstall behavior. No secret-bearing download,
new Storage account, role, network rule, SSH or Run Command was needed.

The supported live agent was Ready at version 2.16.0.2. Microsoft documents
fabric-controller redirection for supported-agent handler download and status
reporting. The payload used only existing DNS, targeted IMDS and private ACR.
No new egress rule was authorized.

The proposed script was bounded inventory-only. Nine initial focused tests,
Bicep build/lint, governed CLI validation and exact structured what-if passed.
The structured preview contained one exact extension Create and sixteen Ignore
records. No unrelated Modify/Create/Delete or Unsupported was accepted.

## Exact failed attempt

- Deployment: `g2-stage2a-inventory-20261011-001517`.
- Correlation: `8f988eb2-e40b-4dd7-8191-3c8201b47a47`.
- Operation: `B42A284648DBE244`.
- Provider error: `InvalidParameter`.
- Target: `typeHandlerVersion`.
- Message: "The value of parameter typeHandlerVersion is invalid."

The authoring error was using the available **package release** `2.1.19` as the
deployment property's version. The [Microsoft SDK property reference](https://learn.microsoft.com/en-us/dotnet/api/azure.resourcemanager.compute.virtualmachineextensiondata.typehandlerversion?view=azure-dotnet)
states: "Customer is able to specify only the Major.Minor version of an
extension, Azure platform will deliver the latest Patch.Hotfix version in the
Major.Minor series."

The earlier safety record's exact handler pin claim is therefore superseded
for this field by this correction. Its other reviewed controls remain analysis,
not an executed safety proof. Provider validation did not detect this defect;
it does not supersede the live Compute error.

Phase 1 authority was recorded consumed before Create. No retry was performed.
The child does not exist; no extension Delete was necessary or issued.
No guest script, inventory, authentication, package change, build or push ran.
Tooling is unresolved, not missing; no package-install proposal is justified.

## Source-only correction

The failed Bicep bytes are preserved in
[failed source snapshot](G2_STAGE2A_FAILED_EXTENSION_SOURCE.bicep.txt).
The [failed emitted template](G2_STAGE2A_PHASE1_TEMPLATE.json) and
[consumed payload authority](G2_STAGE2A_PHASE1_PAYLOAD_AUTHORITY.json) are unchanged.

Current [extension source](../../infrastructure/landing-zone/g2-builder/stage2a/inventory-extension.bicep)
uses documented `2.1`, keeping automatic upgrades disabled. A regression rejects
three-component handler properties. This is a source-only candidate:
**not provider-validated, not a replacement authority manifest, not permission
to retry**. Azure-selected patch bytes must not be falsely described as pinned
by `typeHandlerVersion`. Any future authorization must explicitly acknowledge
this platform version-selection boundary and revalidate the exact new payload.

## Final state

- Frozen Stage 1 hashes and source/infrastructure authority unchanged.
- Exact protected raw estate matches; final resource count sixteen.
- Builder-only UAMI attachment and role conditions unchanged.
- Extension absent; no cleanup of another resource.
- No token bodies persisted.
- Stage 1 remains `STAGE1_DISCOVERY_PROVEN`.
- Stage 2B execution and Stage 3 remain unauthorized.

See [failed deployment](G2_STAGE2A_PHASE1_DEPLOYMENT.json),
[operations](G2_STAGE2A_PHASE1_OPERATIONS.json),
[result](G2_STAGE2A_PHASE1_RESULT.json),
[extension absence](G2_STAGE2A_EXTENSION_RETIREMENT.json),
[final estate](G2_STAGE2A_FINAL_ESTATE.json) and
[final disposition](G2_STAGE2A_FINAL_DISPOSITION.json).

## Next bounded decision

New authority is required for any corrected Phase 1 attempt. Do not install
tools until actual inventory proves what is missing. Keep runtime identity
proof separate; see [Stage 2B proposal](G2_STAGE2B_SUBSTRATE_PROPOSAL.md).
