# Corrected Stage2A synthetic artifact proof

Mission: `NZ-20261008-INFRA-001`. Gate: `G2_PRIVATE_CONTROL_PLANE`.
Slice: `G2_STAGE2A_CORRECTED_SYNTHETIC_ARTIFACT_PRODUCTION`.

## Disposition

**STAGE2A_BUILDER_ARTIFACT_PROVEN**

**OVERALL_G2 = FAIL**. UE and Cora remain `INFRA_NO_GO`.
This is not a production-readiness, tenant isolation, security, or DR claim.
No Stage2B or Stage3 execution took place.

Exactly one fresh CSE execution:
`g2-corrected-production-20261011-233826`.
Correlation `037823f0-5925-4261-85d1-8021700c875b`.
Deployment Succeeded; terminal CSE `nzila-g2-oci-repaired` retired.
Corrected execution authority consumed, remaining executions zero.

## Concurrency

Isolated branch `g2/synthetic-health-source`.
HEAD `7bec20aad11d43eeae8099c14e021b3074154b27`.
Before every write batch the observed status remained only the two existing
untracked work areas `.azure/` and `infrastructure/landing-zone/g2-builder/`.
No foreign work was reverted or dispositioned. Historical source/evidence
and local OCI proof root hashes preserved. No product-domain edits.

## Authorization proof

Operator canonical prevalidation, immediate predispatch, and post-retirement
builder assignment census hashes all equal:

`ab355ef1e0697b1bf0e4328cdfb68d2a6f92eb49e8721c8326f93261a950fd63`

Exactly conditioned tooling Reader and synthetic-health Writer; no tooling
Writer, wildcard, registry-wide push role, or management-plane read added.
Guest immediately proved tooling read allowed, tooling write denied,
control repository write denied, exact synthetic-health pull/push allowed.
Final tooling write denial passed.

## Artifact evidence

Private ORAS1.3.4 archive streamed from private data IP `10.90.2.4`, TLS PASS,
4,679,642 bytes. Archive SHA256:

`f27adb935022d94df8dc77719c322dda592c78a0d57a6f7dcdd8d900b248c454`

Approved ORAS executed only for local OCI packaging, followed by the frozen
strict no-retry Python uploader for remote transfer. No native remote ORAS
push is claimed. Authenticated tag absence passed before committing.
Exactly one remote artifact attempt; exactly one manifest commit.

Repository: `synthetic-health`.
Tag: `stage2a-2457502e49df5a77cd6403052c37ad7dc8cce95f3947378aa5e3dcf2f12703db`.

Local and remote manifest digest:

`sha256:13fbd3f9de68376f8e55af8ce64172eec3ae65a73b9ce70f9d26e73271bef690`

Payload SHA256:

`2457502e49df5a77cd6403052c37ad7dc8cce95f3947378aa5e3dcf2f12703db`

Remote blob digest is `sha256:` plus that exact payload hash.
Payload size 326, media `application/vnd.nzila.g2.synthetic-health.v1+json`.
Manifest media `application/vnd.oci.image.manifest.v1+json`.
Artifact type `application/vnd.nzila.g2.synthetic-health.v1`.
Config media `application/vnd.oci.empty.v1+json`, size2, raw `{}`, inline
`data = e30=`, digest
`sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a`.
These fields are bound by the strict validator and exact raw manifest digest;
there is no schema relaxation. Prior defect: expected descriptor omitted
`config.data`; disposition REPAIRED. Prior failed result untouched.

Raw manifest readback by tag and immutable digest both equaled generated
bytes. Payload readback equaled sealed bytes and SHA. All roundtrips PASS.

## Final state

Protected infrastructure exactly16, no CSE.
Full protected ARM resources, role snapshots, source registry, private NIC,
DNS A records, and zone group match the accepted previous estate.
Target public Disabled, bypass None, admin disabled.
Source and target temporary importer assignments absent.
Builder tooling Reader and synthetic-health Writer present.
Runtime synthetic-health Reader unchanged, runtime tooling access absent.
Builder VM retains only builder UAMI; runtime UAMI not attached.
No registry/network/RBAC/package/product changes or additional import.
No tokens/Authorization headers/raw instanceview persisted.
Temporary guest workspace absent, configuration unchanged, no persistent install.
Local downloaded archive removed; requested forensic local layouts retained.

## Validation

- Fresh network-isolated actual local packaging twice: PASS.
- Eight Python unittest suites, 93 tests: PASS.
- Bicep build/lint and `git diff --check`: PASS.
- Official core deployment validation: PASS.
- Raw FullResourcePayloads: exactly one CSE Create, no Modify/Delete/Unsupported.
  Helper textual Create2 double-counts formatting, not two Azure changes.
- Applicable policy census empty; static candidate has no role changes.
- Official azure-prepare / azure-validate / azure-deploy sequence completed.
- Sanitized deployment operations: one successful exact CSE Create.
- Postexecution operator estate/census and executed-source bindings: PASS.
- Final integrity root plus independent hash verification retained separately.

## Evidence and stop boundary

- [Required output fields](G2_CORRECTED_PRODUCTION_DISPOSITION.json)
- [Sanitized guest result](G2_CORRECTED_PRODUCTION_GUEST_RESULT.json)
- [Source authority](G2_CORRECTED_PRODUCTION_SOURCE_AUTHORITY.json)
- [Final estate](G2_CORRECTED_PRODUCTION_FINAL_ESTATE.json)
- [Postexecution census](G2_CORRECTED_PRODUCTION_POSTEXEC_AUTHORIZATION.json)
- [Final integrity root](G2_CORRECTED_PRODUCTION_FINAL_VERIFICATION.json)
- [Stage2B proposal only](G2_CORRECTED_PRODUCTION_STAGE2B_RUNTIME_IDENTITY_PROOF_DRAFT.md)

Stop here. Stage2B requires separate explicit authority; no runtime workload
deployment or identity attachment is implied by this proof.
