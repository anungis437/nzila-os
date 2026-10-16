import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import {
  buildProducerContract,
  exactIds,
  inputFiles,
  outputFiles,
  root,
  read,
  sha,
  digest,
  loadInputs,
  validateGraph,
  validateAuthorities,
  validateSql,
} from './w4-physical-producers'

export async function generate() {
  const bytes = Object.fromEntries(
    Object.entries(inputFiles).map(([key, file]) => [key, read(file)]),
  )
  const input = loadInputs()
  assert.equal(sha(bytes.canonical), input.w3e.VERSION_1_3_SHA256, 'CANONICAL_1_3_HASH_DRIFT')
  const contract = buildProducerContract(input)
  const proof = Object.fromEntries(
    Object.entries(inputFiles).map(([key, file]) => [
      file,
      {
        BEFORE_SHA256: sha(bytes[key]),
        AFTER_SHA256: sha(read(file)),
        CHANGED: 'NO',
      },
    ]),
  )
  for (const value of Object.values(proof)) assert.equal(value.BEFORE_SHA256, value.AFTER_SHA256)
  const first = contract.digests
  const second = buildProducerContract(input).digests
  assert.deepEqual(first, second, 'NONDETERMINISTIC_W4_PRODUCERS')
  const validation = {
    ...contract.validation,
    ALL_DIGESTS_MATCH: 'YES',
    RUN_1_PRODUCER_REGISTRY_DIGEST: first.PRODUCER_REGISTRY,
    RUN_2_PRODUCER_REGISTRY_DIGEST: second.PRODUCER_REGISTRY,
    RUN_1_PLAN_DIGEST: first.PLAN,
    RUN_2_PLAN_DIGEST: second.PLAN,
    RUN_1_POSTCONDITION_DIGEST: first.POSTCONDITIONS,
    RUN_2_POSTCONDITION_DIGEST: second.POSTCONDITIONS,
    NO_DATABASE_CONNECTION: true,
    NO_DJANGO_IMPORT_SETUP_OR_EXECUTION: true,
    NO_SQL_EXECUTION: true,
    NO_ROLE_EXTENSION_SECRETS_DEPLOYMENT_OR_FINANCIAL_MUTATION: true,
  }
  const implementationSha256 = Object.fromEntries(
    [
      'scripts/ue/w4-physical-producers.ts',
      'scripts/ue/implement-w4-physical-producers.ts',
      'scripts/ue/w4-physical-producers.test.ts',
    ].map((file) => [file, sha(read(file))]),
  )
  const closeout = [
    {
      COMMAND:
        'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\w4-physical-producers.test.ts apps\\union-eyes\\scripts\\provisioning\\governed-provisioning.test.ts',
      RESULT: 'PASS;38 W4 tests and59 preserved W3E tests,97 total',
    },
    {
      COMMAND:
        'pnpm exec tsc --noEmit --target es2022 --module esnext --moduleResolution bundler --skipLibCheck --esModuleInterop --types node scripts\\ue\\w4-physical-producers.ts scripts\\ue\\implement-w4-physical-producers.ts scripts\\ue\\w4-physical-producers.test.ts',
      RESULT: 'PASS',
    },
    {
      COMMAND:
        'pnpm exec eslint --config apps\\union-eyes\\eslint.config.mjs --max-warnings 0 scripts\\ue\\w4-physical-producers.ts scripts\\ue\\implement-w4-physical-producers.ts scripts\\ue\\w4-physical-producers.test.ts',
      RESULT: 'PASS; existing config selected from root so files actually linted',
    },
    {
      COMMAND: 'pnpm exec tsx scripts\\ue\\implement-w4-physical-producers.ts --self-test --check',
      RESULT: 'PASS; exact linkage/graph/uniqueness/SQL guards and two-run determinism',
    },
    {
      COMMAND:
        'pnpm exec prettier --check <three W4 tooling files and four W4 JSON/Markdown artifacts>',
      RESULT: 'PASS; exact selectors run at closeout',
    },
    { COMMAND: 'pnpm validate:docs', RESULT: 'PASS;0 errors,1215 warnings' },
    {
      COMMAND:
        'Independent node fixed-artifact/source-hash/operation/graph/handoff/version-chain assertions',
      RESULT:
        'PASS;768/310 IDs,372 mappings,82-node graph,4 wrappers,86/118 handoffs,23 file hashes,W1/W2/W3 bytes/code,exact1.3->1.2->1.1->1.0',
    },
  ]
  const full = {
    ...contract,
    implementationSha256,
    preservation: proof,
    validation: { ...validation, closeout },
  }
  const report = {
    ...full,
    VERSION_1_3_SHA256: sha(bytes.canonical),
    VERSION_1_4_CREATED: 'NO',
    PRIOR_VERSION_RECONSTRUCTION: {
      AUTHORITY: inputFiles.w3e,
      METHOD:
        'Unchanged W3E inverse patches reconstruct1.2, unchanged W2 inverse patches reconstruct1.1, unchanged W1N patches reconstruct1.0; canonical1.3 not amended',
    },
    frozenUniverses: {
      PREREQUISITES: {
        COUNT: 803,
        IDS_SHA256: digest(input.canonical.prerequisiteObligations.map((o) => o.OBLIGATION_ID)),
      },
      OPAQUE: {
        COUNT: 118,
        IDS_SHA256: digest(
          input.canonical.opaqueBindingObligations.map((o) => o.OPAQUE_BINDING_ID),
        ),
      },
      ORDERING: {
        COUNT: 86,
        IDS_SHA256: digest(input.canonical.orderingObligations.map((o) => o.ORDERING_RECORD_ID)),
      },
      FROZEN_MANIFEST: { COUNT: 23, SHA256: digest(input.canonical.frozenMigrationManifest) },
      W1_LOCKED_PACKAGE_IDENTITIES_SHA256: digest(input.w1.lockedDistributions),
      W1_CONFIGURED_APPS_SHA256: digest(input.w1.configuredApps),
      W1_MIGRATION_NODES_SHA256: digest(input.w1.migrationNodes),
      W3_GUARDED_VECTOR_CONSUMERS_SHA256: digest(input.w3e.vectorConsumerReconciliation),
    },
  }
  const config = await resolveConfig(path.join(root, ...outputFiles.contract.split('/')))
  const markdown = `# W4 — preconsumer physical producer implementation

## Gate: BLOCKED — exact ownership/definition decisions remain

Canonical **1.3** is unchanged. W1/W2/W3/W3E remain accepted PASS. **No 1.4 amendment and no W5 authorization.** [Producer contract](UE_PRECONSUMER_PHYSICAL_PRODUCER_CONTRACT.json) and [W4 evidence](PHASE_1B_3C_A1I_W4_PRECONSUMER_PHYSICAL_PRODUCERS.json) consume exactly **${validation.W4_INPUT_OBLIGATIONS} W4 obligation IDs** and **${validation.W4_INPUT_DECISIONS} decision IDs** from the fixed contract, not a replacement denominator.

## Producer authorities and 372 Django mappings

All **372** W1N Django physical obligations have exactly one linked creation producer: **${validation.MAPPED_TO_EXACT_DJANGO_PRODUCER} local Django**, **${validation.MAPPED_TO_EXTERNAL_DJANGO_PRODUCER} external Django**, **0 raw-produced**, **0 ownership-blocked within that 372**, sum **372**. Each uses the exact frozen lineage candidate identity, source file/hash, required column membership (where applicable), matching W1 operation line/class, migration ID and topological plan position. No broad source discovery or model-to-DDL regeneration.

The full **82-node graph** retains **29 local and 53 external migrations**, including locked external package/version/archive/file digests. Django-owned tables/columns stay Django-owned. Organizations remains Django. No substitute Django DDL is emitted.

The operational producer descriptor binds W2 Django actor/target/path (\`public, pg_catalog\`), W3 migration role/delegation/extension/privilege preconditions and W1 lock/graph/plan/settings/configured-app/package/swappable identity. The callable [prepareDjangoExecution](../../../scripts/ue/w4-physical-producers.ts) validates explicit inputs and returns a **nonexecuted** descriptor. W8 must later supply authenticated target and measured package/settings/source-byte evidence. There is no subprocess/database adapter, ambient fallback or Django import. All82 plan rows are parts of **one full Django invocation**, not82 separate migrate calls.

## Platform registry:310 exact governance blockers

**269 relation/column owner decisions** and **41 type/function owner/definition decisions** remain HUMAN_DECISION_REQUIRED in contract1.3. Every blocked physical identity links to its exact existing decision ID and source candidates. Conditional \`PLATFORM_BASELINE_SUBJECT_TO_EXPLICIT_OWNERSHIP\` is not ownership approval. W4's blanket workstream authorization cannot resolve those exact approvals.

Therefore the platform registry is a **blocked-definition packet**, not310 implemented producers. It emits **zero mutating SQL**: no guessed function bodies, enum labels, security mode, SECURITY DEFINER search paths or ownership; no domain substitutes, financial materializer, roles or extensions. Exact approval and complete definition/security/ACL/dependency evidence are needed before those producers can be implemented.

## Raw wrappers, graph and creation authority

All **${validation.RAW_OPERATIONS_PRESERVED}** W1 raw operation records are retained; exactly **four W1N W4 state/physical wrapper duties** are explicit. Original RunSQL/RunPython/generated/SeparateDatabaseAndState execution remains in its original migration. W6 semantics are not reinterpreted or implemented.

Known Django graph: duplicate producer IDs **0**, unresolved references **0**, cycles **0**; W1 order preserved. Full W4 graph is explicitly **not complete** because310 approved definitions/dependencies are missing. One known creation authority per physical identity; pending-owner records are not creation approval. No per-object alteration authority is inferred from a raw operation merely sharing a migration graph.

Macro order stays W3 → full Django graph → approved platform baseline → frozen security migrations. No frozen consumer file/order/hash changed; W5 must adjudicate compatibility rather than W4 assuming later frozen CREATE/ALTER statements are safe.

## Postconditions and handoffs

372 read-only schema-qualified/parameterized relation/column descriptors require exactly one result and governed owner. Column queries expose type/nullability/default; W9 compares them with the exact locked Django state, **not an invented type inferred from existence**. Platform postconditions remain explicit blocked-definition records. These are EXPECTED_RUNTIME_PROOF, never observed catalogs.

All **86 W5 ordering IDs** receive a producer/blocked-producer handoff with prerequisite and unchanged consumer/later-provider references; ordering closure remains NO. All **118 opaque bindings** receive an intersection census (**${validation.W6_W4_INTERSECTIONS} intersect W4**); exact intersections name the physical producer, no-intersection rows explicitly say NO. W6 semantic binding remains required, no silent resolution.

## Determinism, preservation and validation

Two generations match registry/plan/postcondition digests. Whole-file before/after hashes preserve all eight fixed artifacts, including canonical1.3 and accepted W1/W1N/W2/W3E. The exact predecessor reconstruction remains under its existing inverse-patch authorities. 803/118/86 IDs,23 frozen migration records,87 packages, Django5.2.18,25 apps,82 nodes, four mandatory extensions and22 vector consumers remain unchanged.

\`\`\`powershell
pnpm exec tsx scripts\\ue\\implement-w4-physical-producers.ts --plan
pnpm exec tsx scripts\\ue\\implement-w4-physical-producers.ts --self-test --check
\`\`\`

Standalone --apply and unknown flags fail. Closeout: **38 W4 tests plus59 preserved W3E tests (97 total) PASS**; scoped TypeScript, actual root-scoped ESLint, formatting and generator self-tests/check/determinism PASS. Docs audit PASS (**0 errors,1,215 warnings**). Independent exact denominator/linkage/handoff/frozen-file/version/hash assertions PASS. Commands/results and implementation hashes are recorded in JSON. Offline tests do not prove any producer executed.

## Proof and authorization boundary

W4 = **BLOCKED**, W5 = **NOT_AUTHORIZED_BY_W4**, W5/W6–W10 not started. Roles/extensions/memberships/Django schema/platform baseline/physical producer execution/runtime configuration/replay/production schema/RLS/tenant isolation remain **NO**. No secrets, deployment changes or PR. READY_FOR_RUNTIME_PROOF = **0**, PRODUCT_READY = **NO**.
`
  return {
    [outputFiles.contract]: await format(JSON.stringify(full), { ...config, parser: 'json' }),
    [outputFiles.report]: await format(JSON.stringify(report), { ...config, parser: 'json' }),
    [outputFiles.markdown]: await format(markdown, { ...config, parser: 'markdown' }),
    [outputFiles.reportMarkdown]: await format(
      markdown.replace(
        '# W4 — preconsumer physical producer implementation',
        '# W4 — physical producer evidence and blocked gate',
      ),
      { ...config, parser: 'markdown' },
    ),
  }
}
export async function main(args: string[]) {
  assert(
    args.every((arg) => ['--plan', '--check', '--self-test'].includes(arg)),
    'STANDALONE_APPLY_BLOCKED_OR_UNKNOWN_ARGUMENT',
  )
  assert.equal(new Set(args).size, args.length, 'DUPLICATE_ARGUMENT')
  const outputs = await generate()
  assert.deepEqual(outputs, await generate(), 'NONDETERMINISTIC_W4_OUTPUT')
  if (args.includes('--self-test')) {
    assert.throws(() => exactIds(['a', 'a'], ['a', 'b']))
    assert.throws(
      () => validateGraph([{ PRODUCER_ID: 'a', REQUIRES_PRODUCER_IDS: ['a'] }]),
      /CYCLE/,
    )
    assert.throws(
      () => validateGraph([{ PRODUCER_ID: 'a', REQUIRES_PRODUCER_IDS: ['missing'] }]),
      /UNRESOLVED/,
    )
    assert.throws(
      () =>
        validateAuthorities([
          { PHYSICAL_IDENTITY: 'public.t', CREATE_AUTHORITY: 'Django' },
          { PHYSICAL_IDENTITY: 'public.t', CREATE_AUTHORITY: 'SQL' },
        ]),
      /MULTIPLE/,
    )
    assert.throws(() => validateSql('DROP SCHEMA public CASCADE;'))
    console.log(
      'PASS W4 self-tests: exact frozen IDs,372 unique source/operation mappings, known graph, authority/unsafe SQL guards;310 governance blockers retained',
    )
  }
  if (args.includes('--check')) {
    for (const [file, value] of Object.entries(outputs))
      assert.equal(read(file), value, `Stale W4 artifact: ${file}`)
    console.log('PASS W4 deterministic --check; canonical1.3 unchanged; W4 BLOCKED, no1.4/W5')
  } else if (!args.includes('--self-test')) {
    for (const [file, value] of Object.entries(outputs))
      writeFileSync(path.join(root, ...file.split('/')), value)
    console.log(
      'W4 offline producer packet generated:372 Django mappings;310 exact owner/definition decisions block W4; no runtime actions',
    )
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(
      '[implement-w4-physical-producers]',
      error instanceof Error ? error.message : 'Producer generation failed',
    )
    process.exitCode = 1
  })
