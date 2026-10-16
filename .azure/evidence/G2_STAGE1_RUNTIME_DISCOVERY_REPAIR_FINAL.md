# Final Stage 1 source-repair authority

`RUNTIME_DISCOVERY_SOURCE_REPAIR_COMPLETE`  
`SERIAL_MARKER_CONTRACT = PASS`  
`IDENTITY_ASSERTION_MODEL = PASS`  
`APT_DEB822_PARSER = PASS`  
`INFRASTRUCTURE_BYTES_UNCHANGED = YES`  
`RUNTIME_REEXECUTION_MODE = NEW_VM_EXECUTION_REQUIRED`

Overall G2 remains FAIL; current Stage 1 remains PARTIAL. No Azure mutation,
new guest execution or cleanup occurred. Retry 2 remains consumed.

## Latest content-addressed authority

Use [V2 source authority](./G2_STAGE1_RUNTIME_DISCOVERY_REPAIR_V2.json)
and [V2 candidate template](./G2_STAGE1_RUNTIME_REPAIR_CANDIDATE_TEMPLATE_V2.json).
The first repair manifest/template are preserved intermediate snapshots,
superseded for source-byte authority by V2.

Final review added the explicit disabled-malformed syntax case: classify
parse errors using the completed stanza's Enabled field, including errors
before or after that field. A disabled malformed stanza does not invalidate
valid active endpoint observations; malformed active stanzas still fail closed.
The fixture regression covers this behavior. All 22 tests, compilation,
Bicep build/lint, DNS/NSG, VM/firewall/preservation, negative contracts,
compiled topology comparison and whitespace checks passed on final bytes.

The [investigation report](./G2_STAGE1_RUNTIME_DISCOVERY_REPAIR.md) documents
the three defects, serial/proof semantics and evidence limitations.
The [next-execution proposal](./G2_STAGE1_RUNTIME_REEXECUTION_PROPOSAL.md)
remains proposal-only; its hash binding must use V2, not the superseded initial
manifest. Any source change invalidates V2 authority.

No exact raw guest APT files were available through the authorized channels.
Modeled fixtures validate the repaired syntax; they do not retroactively prove
all 35 historical errors. Corrected Azure runtime proof remains pending new
explicit first-boot execution authority.
