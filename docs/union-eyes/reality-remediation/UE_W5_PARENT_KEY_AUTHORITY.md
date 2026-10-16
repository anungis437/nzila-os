# Prospective pre-W5 parent-key supplement

## Exact authorized authority

10/10 exact canonical ID definitions recovered and independently corroborated by historical CREATE statements.
No naming-convention inference,no conflicting authority,zero terminal key-definition blockers.
Historical W4P,W4A/W5A topology,23frozen sources and historical W5BC ledger/closure are unchanged.

| Exact identity                 | Type | Nullability/key        | Default           | Identity/sequence | Authority |
| ------------------------------ | ---- | ---------------------- | ----------------- | ----------------- | --------- |
| public.allocation_rules.id     | uuid | NOT NULL / PRIMARY KEY | gen_random_uuid() | NONE              | EXACT     |
| public.allocation_runs.id      | uuid | NOT NULL / PRIMARY KEY | gen_random_uuid() | NONE              | EXACT     |
| public.commercial_contracts.id | uuid | NOT NULL / PRIMARY KEY | gen_random_uuid() | NONE              | EXACT     |
| public.committee_meetings.id   | uuid | NOT NULL / PRIMARY KEY | gen_random_uuid() | NONE              | EXACT     |
| public.correspondence.id       | uuid | NOT NULL / PRIMARY KEY | gen_random_uuid() | NONE              | EXACT     |
| public.duplicate_groups.id     | uuid | NOT NULL / PRIMARY KEY | gen_random_uuid() | NONE              | EXACT     |
| public.ingestion_batches.id    | uuid | NOT NULL / PRIMARY KEY | gen_random_uuid() | NONE              | EXACT     |
| public.platform_invoices.id    | uuid | NOT NULL / PRIMARY KEY | gen_random_uuid() | NONE              | EXACT     |
| public.platform_payments.id    | uuid | NOT NULL / PRIMARY KEY | gen_random_uuid() | NONE              | EXACT     |
| public.reconciliation_runs.id  | uuid | NOT NULL / PRIMARY KEY | gen_random_uuid() | NONE              | EXACT     |

Each ID has no type modifier,generated expression,collation,foreign key or explicit column ACL. Uniqueness is the primary-key invariant;no extra UNIQUE index is authored.
Definition statements,source locations,full source hashes and exact declaration digests are recorded in [the authority JSON](./UE_W5_PARENT_KEY_AUTHORITY.json).
10/10 producer payloads,inspectors and verifiers implemented prospectively in [parent-key-supplement.ts](../../../apps/union-eyes/scripts/provisioning/parent-key-supplement.ts).

## Fresh versus legacy safety

Only an empty,exact W4P-shaped standalone ordinary relation with no conflicting column/PK/unique definition can enter KEY_ABSENT_SAFE_TO_CREATE. Inheritance/partition targets deny.
Zero rows requires catalog proof that the pinned actor can see the entire relation despite RLS,not merely a filtered count.
All10keys are inspected before the first send;each send rereads its prestate,then immediate poststate,then all10final states.
An existing populated relation with a missing ID is KEY_ABSENT_AMBIGUOUS_DATA_STATE:deny mutation,no historical/business identity regeneration.
Wrong type/default/nullability/PK,state drift,wrong scope,missing verified W4P or missing exclusive adapter deny.
Owner and grants are not modified. Default function resolution requires an executable PostgreSQL builtin or attested pgcrypto extension member;no PostgreSQL version or default-function schema is invented from an unqualified declaration. Existing exact keys preserve legitimate extra legacy columns while verifying the W4P-owned baseline projection. Receipt key-state digests exclude changing row counts. Future adapter must qualify runtime trigger/extension side effects.

## Receipt,authorization and graph separation

Supplement plan:`6f9eb1190670f1d010c6d44ce6598b4924e806eae3a22d337ca79b5522cd0e90`.
Supplement authority:`69b70908dc1e6fd9fc76a60a4ed29b24849bac5dd0a089ca77041862ae7b379d`.
Receipts bind all10exact key-state digests,plan/authority/graph,target/scope,verified W4P,actor and exclusive execution reference.
Storage remains external;no receipt table or advisory lock invented.
The10producers are outside the107-node frozen W5A graph.

## Honest closure ceiling

The missing-key semantic precondition is representable for all12affected0014helper calls after a verified supplement.
**Full boundary replay eligibility has not yet been proven;full107handlers/inspectors/verifiers are not implemented.**
Offline continuation components exist in [the replay engine](../../../apps/union-eyes/scripts/provisioning/post-w4p-execution.ts),
[structural effect comparators](../../../apps/union-eyes/scripts/provisioning/replay-structural-effects.ts),
[RLS primitives](../../../apps/union-eyes/scripts/provisioning/replay-rls-primitives.ts),
[literal policy comparators](../../../apps/union-eyes/scripts/provisioning/replay-literal-policy.ts)
and [function-definition comparators](../../../apps/union-eyes/scripts/provisioning/replay-function-inspection.ts).
[The typed effect registry](../../../apps/union-eyes/scripts/provisioning/replay-effect-registry.ts)
binds all762original effects to exact frozen byte ranges and compiles all762components:
76original table declarations,2schemas,17FKs,89indexes,43columns,20RLS toggles,61policy drops,
14literal policies,320helper calls,13functions,21ACL effects,7defaults,4backfills and75procedural blocks.
[Actual inspector dispatch](../../../apps/union-eyes/scripts/provisioning/replay-effect-inspection.ts)
routes those762components to their catalog comparators and denies missing independent position authority.
The75procedural comparators include all three nested default-exception bodies.
Those three require genuinely distinct immediately-before/after catalog snapshots,assignment-resolution facts and exact accepted exception branches;
a current-state catalog or caller-supplied completion flag cannot replace predecessor evidence.
[The source-native unit plan](../../../apps/union-eyes/scripts/provisioning/replay-unit-plan.ts)
binds all107unit contracts to their actual component contracts,23source-native transaction assignments,
exact byte payloads and all231predecessor edges without discarding repeated provenance.
This plan is not an installed107handler package and grants no execution authority.
[Temporal source ownership](../../../apps/union-eyes/scripts/provisioning/replay-temporal-ownership.ts)
accounts for all762effects using explicit owned-state selectors.
Source-level ENSURE and exception-conditional operations are not unconditional supersession;
unqualified helper-DDL schemas remain unresolved despite the public existence guard.
Historical temporal witnesses require actual authenticated predecessor receipt chains;receipts alone do not establish catalog completion.
[The independent fake catalog](../../../apps/union-eyes/scripts/provisioning/replay-fake-catalog.ts)
currently supports311frozen effect transitions:41enums,2schemas,20RLS toggles,61policy drops,14literal policy creations,
4backfills,43added columns,7defaults,89indexes,17foreign keys and13function declarations/drops.
It mutates independent enum/catalog/row state,retains immutable predecessor readers,and restores actual state and staged receipts on failure.
It also independently parses and applies all43prospective CREATE declarations without importing their production compilers.
Foreign-key transitions require actual parent uniqueness,compatible physical columns and no orphan rows.
Guarded index creation preserves an existing wrong object so the real comparator can deny drift.
Literal policy transitions validate a separate closed expression grammar,physical column references and comparison types
before publishing actual policy metadata;missing columns,uncast UUID/text equality and unsupported operators deny.
Populated dynamic-default and nonnull-column cases are explicitly unsupported rather than assigned fabricated values.
A composed84-unit CREATE/enum subset follows frozen order and subsequently yields84catalog-proven noops withzeroadditionalfake transitions.
The subset intentionally omits all23original boundaries and is not the required full107canonical noop.
Unknown source grammar and catalog queries deny explicitly.
The [independent function-source interpreter](../../../apps/union-eyes/scripts/provisioning/replay-fake-functions.ts)
stores source-native argument/default/body metadata with independently supplied actor,namespace and default-ACL facts.
Replacement preserves observed ownership,ACL and dependencies;restrictive drop resolves the actual effective path and signature.
Unsupported clauses,ownership changes,parameter renames,return changes and shadowed native types deny atomically.
Function bodies are opaque prosrc here:helper calls and procedural bodies are not executed by this interpreter.
The separate [source-native helper-program interpreter](../../../apps/union-eyes/scripts/provisioning/replay-fake-helper-program.ts)
interprets all320frozen calls against independently supplied physical facts,without using production policy IR to manufacture mutations.
Its standalone synthetic-fact tests do not qualify all320calls against actual W4P catalog state.
[Mutable helper integration](../../../apps/union-eyes/scripts/provisioning/replay-fake-helper-integration.test.ts)
independently applies the exact36type and57relation W4FR4 payloads,then executes45frozen direct-org calls
against those actual source-produced relations;repeated calls retain the same durable policy/RLS state.
All45direct calls now pass the real policy-helper comparator against independently stored native catalog facts,
including physical column input/output identity,equality/cast resolution and source-recorded policy dependencies.
The [closed fake native catalog](../../../apps/union-eyes/scripts/provisioning/replay-fake-native.ts)
does not map unknown names to successful pg_catalog identities or substitute production IR for observed state.
The public existence guard and a nonpublic effective DDL target are kept separate.
Source-emitted target and parent-reference annotations must match actual path resolution;unknown native identities,
borrowed ownership and unsupported expressions deny without publishing partial changes.
The same raw baseline now supports all10exact authorized key SQL transitions,
real key-catalog before/after inspection,and the actual supplement producer's fresh/noop paths.
This is a bounded fake parent-shape proof,not full W4P verification or live execution authorization.
All12formerly blocked0014parent-owned calls now independently emit real mutable fake policies after actual ten-key SQL,
and pass the real helper comparator on those observations;repeated calls preserve durable state.
The same12calls deny missing-parent-ID states without publishing partial mutations.
These component transitions do not yet establish indivisible0014safe replay eligibility,full320mutable helper coverage,
or the required full107fresh/noop/rollback proof.
The physical function inspector reports a missing restrictive-drop target as ABSENT;
the source-effect dispatcher treats that authenticated absence as the DROP postcondition EXACT,not as an absent CREATE.
The [ordered position session](../../../apps/union-eyes/scripts/provisioning/replay-position-session.ts)
binds predecessor capture and actual component inspection to frozen original-effect order.
Primitive and complex positions both validate observed actor,database and effective search path;
minimal primitive identity evidence is not semantic completion evidence.
It records actual inspection queries,parameters and rows separately from authority reads,
and rejects changed authority evidence during inspection.
Both dated authority read-sets are retained;only the snapshot/time fields of the exact marker query are excluded
from semantic-stability comparison,and backend affinity remains required.
A new legitimate observation timestamp is not misclassified as authority drift.
The first frozen original relation effect has been observed EXACT from an independently parsed fake CREATE
and native-type/column/primary-key metadata,with absence,borrowed-reader and principal-change denials.
That individual position witness does not qualify its enclosing indivisible boundary.
The [declarative whole-boundary handler](../../../apps/union-eyes/scripts/provisioning/replay-declarative-boundary.ts)
now qualifies all5structural-only originals at isolated source positions,using exact whole-byte sends and independent net-state comparisons.
[The composed relation contracts](../../../apps/union-eyes/scripts/provisioning/replay-composite-relations.ts)
include subsequent in-boundary foreign keys,with separately authenticated named FK/index comparisons.
Fresh eligibility requires every owned relation absent,source-resolved types,creation/schema privileges,
default-function provenance and no unqualified event-trigger side effects;partial unguarded boundaries deny.
Omitted/reordered components,changed source commitments,missing native prerequisites and borrowed identity deny.
Actual fresh/noop state,stable delayed-query readsets,postcondition rollback and commit-failure receipt absence are tested.
These5isolated original boundaries are not a composed107-unit proof or full23-boundary installation;
later authorized catalog evolution still requires temporal net-state composition.
Its chained observations are not unit receipts,whole-boundary eligibility or installed107-handler qualification.
The [nullable-column whole-boundary handler](../../../apps/union-eyes/scripts/provisioning/replay-nullable-column-boundary.ts)
qualifies the three unguarded nullable/default-free COLUMN+INDEX originals separately,with source-created prior relations,
native resolution,actual whole-byte fresh/noop behavior and rollback/commit-failure receipt absence.
Both handler families share [native DDL type preflight](../../../apps/union-eyes/scripts/provisioning/replay-ddl-type-preflight.ts).
The [source-bound relation evolution](../../../apps/union-eyes/scripts/provisioning/replay-relation-evolution.ts)
compounds the actual first six frozen units into23exact evolved table definitions after six whole-byte fake sends.
Unknown extra columns and changed source/unit commitments still deny;this prefix is not full authenticated temporal receipt composition.
The [native whole-boundary qualifier](../../../apps/union-eyes/scripts/provisioning/replay-fake-boundary-execution.ts)
now validates actual before/after statement positions captured by the independent interpreter inside one whole-byte send.
The [native position tests](../../../apps/union-eyes/scripts/provisioning/replay-fake-native-positions.test.ts)
qualify the actual six-unit prefix through ordered source-position authority without per-effect sends or invented intermediate catalog frames.
Coverage is sealed before fake transaction commit;observer/commit failures restore physical state and discard staged position observations.
The [native graph-reference integration](../../../apps/union-eyes/scripts/provisioning/replay-fake-graph-reference.ts)
uses independently executed source-prefix/final physical fingerprints,not unit-completion flags.
Its certificates are private native-producer objects and its adapters are fake-only;ordinary/live readers are rejected.
Receipt rows alone are excluded from physical fingerprints;schema,columns,keys,functions,ACLs,roles and data remain bound.
Canonical supersession additionally requires the authentic full scope receipt chain and source-qualified final state.
The financial no-effect scope is qualified through the real execution orchestrator with zero sends and rollback tests.
The [AST-only Django baseline](../../../apps/union-eyes/scripts/provisioning/replay-fake-django-baseline.ts)
produces incoming physical state from hash-bound local migrations and cached package sources without importing Django.
Its selected incoming catalog covers215of320helper positions;the other105have frozen later source producers,
not assumed absence from an incomplete inventory. Eighteen external semantic ceilings remain explicit.
The [source-native predecessor fixture](../../../apps/union-eyes/scripts/provisioning/replay-fake-source-fixture.ts)
uses canonical W4P inspect-before-apply semantics and rolls back failed promotion.
Its read-only census retains payload hashes,expected/actual native columns and constraints,and source origins.
Against all162canonical payloads,the current incoming state yields114ABSENT,37PRESENT_MATCHING,
4PRESENT_DRIFTED and7PRECONDITION_MISSING inspections.
The drifted relations are claims,grievances and security_events(nullable organization_id),
and organization_members(UUID organization_id instead of canonical text,with no unique_org_membership).
The missing-operand relations are integration_configs,social_accounts,votes,ml_predictions,cms_pages,
model_metadata and donation_campaigns. These inspections do not replace or reclassify the frozen deferred handoffs.
Membership originates in auth_core::0001_initial,source SHA256
ab91029c78c5d7ae6736a4da8ecf3b5fe13e3f0e046607b5d52cc60f05083f1a;
the source-declared ForeignKey targets organizations.id UUID,no later approved operation changes that column,
and canonical payload UE-W4FR4-PAYLOAD-09ef3aefb86ca556 requires text NOT NULL plus unique_org_membership.
Its canonical SQL SHA256 remains86320b5ed5efccf878808112837aa2df58b7a46e151b5faf5c104f71f210d578.
The [explicit-wheelhouse qualification tests](../../../apps/union-eyes/scripts/provisioning/replay-fake-full-qualification.test.ts)
retain that actual predecessor incompatibility as a denial regression.
The separate canonical-W4P input model consumes actual162canonical payload bytes through the independent native interpreter,
with explicitly assumed accepted-parent context;it does not prove Django-to-W4P reachability or repair an actual target.
Grouped ADD COLUMN/UNIQUE commands are interpreted atomically inside one whole-byte send;
native backing indexes,duplicate-key rejection and distinct-null behavior are independently tested.
Even this conditional input cannot certify the full graph:the exact source-owned member-document block
UE-W5A-MIGRATION-d264f77905daf432:E048 assigns organization_members.organization_id directly into
member_documents.organization_id with no cast. Canonical W4P requires text on the former and UUID on the latter.
The independent native model now rejects this uncast assignment even with zero rows,restoring the whole original boundary.
The block SHA256 remains32f8b632fb11db40437bd9d9f063e30a7ff54fe7ecdeb938736697e685d6775b.
The runtime engine has not been invoked;this is a source/native-model contradiction witness,not a live PostgreSQL result.
No FK is inferred from the guarded ADD COLUMN when the canonical W4P column already exists.
The read-only census and source-denial regressions are not an operational106-unit/762-position PASS.
This is not a missing-ten-key authority failure:the authorized key supplement remains preserved.
Frozen payloads,migrations,graph commitments and canonical1.3.3 are not rewritten;no canonical1.3.4 or successor PASS is issued.
The financial tests and six-unit prefix are not full107proof or an authorization for live execution.
[Original declaration qualification](../../../apps/union-eyes/scripts/provisioning/replay-fake-original-declarations.test.ts)
now compares all76actual original CREATE TABLE sources,including independently parsed CHECKs and inline foreign keys.
Its external parents are labeled fixtures,not a complete source-native W4P baseline.
The [independent CHECK grammar](../../../apps/union-eyes/scripts/provisioning/replay-fake-check.ts)
records source expressions and native column/operator dependencies;unsupported expressions and unknown enum literals deny.
The [independent ACL grammar](../../../apps/union-eyes/scripts/provisioning/replay-fake-acl.ts)
executes all21frozen ACL effects against fixture native inventories,including nonempty sequences and sticky schema-default retractions.
These fixtures do not establish complete mixed-boundary ACL authority.
All34non-enum procedural programs now have bounded independent mutable fake execution:
[19retrofit blocks](../../../apps/union-eyes/scripts/provisioning/replay-fake-retrofit.test.ts),
[5read-only guards](../../../apps/union-eyes/scripts/provisioning/replay-fake-guard.test.ts),
[4guarded policy blocks](../../../apps/union-eyes/scripts/provisioning/replay-fake-guarded-policy.test.ts),
[3default subtransaction programs](../../../apps/union-eyes/scripts/provisioning/replay-fake-defaults.test.ts),
[CONNECT and trigger attachment](../../../apps/union-eyes/scripts/provisioning/replay-fake-catalog-do.test.ts),
and [member-document backfill](../../../apps/union-eyes/scripts/provisioning/replay-fake-member-documents.test.ts).
Guard/default/backfill execution is deliberately restricted to exact preserved program hashes;
the oracle consumes source tokens and actual catalog rows,not production procedural geometry to manufacture postconditions.
Guard incoming-schema fixtures are synthetic prerequisite inventories;they are not independent full-baseline production evidence.
Positive inner-JOIN policy parsing records actual referenced columns and rejects unsupported join forms.
Trigger attachment records the native restrictive-drop function dependency,without executing the stored trigger function body.
Default tests observe actual pre/post catalog snapshots,caught missing-column/type-mismatch branches and real NULL-category updates.
Backfill tests preserve source GROUP BY md.id,distinct nonnull organization counts,actual FK enforcement and UPDATE FROM outcomes;
zero/multiple ownership groups and nondeterministic NULL/nonNULL update choices do not receive inferred PASS.
Unknown native resolution,unsupported collation/escape behavior and unmodeled external UPDATE side effects deny explicitly.
These34component programs do not establish safe eligibility for indivisible mixed originals or install the full107handler package.
The [AST-only Django field reader](../../../apps/union-eyes/scripts/provisioning/read-fake-django-fields.py)
and [source-reader tests](../../../apps/union-eyes/scripts/provisioning/replay-fake-django-source.test.ts)
authenticate all29local frozen W1 migration byte commitments,including Unicode source.
They extract actual field calls and source positions without imports,migration execution or Django initialization.
The two literal RunSQL/noop comprehensions expand from their preserved12+8statement constants with individual hashes;
unknown dynamic expressions retain explicit source ceilings,and ambiguous bindings deny.
This is source extraction only:not physical-baseline production,complete82-node macro verification or full107qualification.
This bounded oracle does not interpret all762effects or prove full107canonical noop/fresh replay/rollback.
All43CREATE and41enum prospective components are compiled using frozen W4P/wrapper enum authority.
Repeated compatibility provenance is preserved:all127records remain bound and duplicate source ranges must agree.
[Backfill comparators](../../../apps/union-eyes/scripts/provisioning/replay-backfill-inspection.ts)
require native dependency types,complete RLS-visible row counts and actual NULL-postcondition aggregates;
file-URL fallback additionally requires nonnull native UUID IDs and executable builtin concatenation/output.
Literal comparisons reject uncast UUID/text equality and invented column qualifiers;UUID text casts require builtin output attestation.
These components are not an installed107-handler registry or23whole-boundary closure.
Historical receipt reuse requires authentic predecessor receipts before any staging;missing receipted effects deny replay.
Final-scope inspections are bound separately from immediate postconditions. Future boundary comparators must still establish exact authorized supersession.
Function bodies are preserved as exact definitions,not executed or treated as proof of their dependencies;missing position-specific schema/owner/ACL authority denies qualification.
No REPLAY_NOOP or W5 rollback result is claimed by these artifacts.
AlltenkeydefinitionsareEXACT:there is no basis to manufacture BLOCKED_TERMINAL_STATIC for key authority.
W5B final adjudication remains pending the required complete replay implementation. Canonical1.3.3 remains unchanged;1.3.4 is not published.
Seven deferred constraints and nine downstream operands remain untouched and are not these ten keys.

## Proof boundaries

DATABASE_CONNECTIONS=0;SQL_EXECUTED=0;W4P_EXECUTED=NO;PARENT_KEY_SUPPLEMENT_EXECUTED=NO;W5_EXECUTED=NO.
EXCLUSIVE_EXECUTION_ADAPTER=ABSENT;LIVE_SUPPLEMENT_EXECUTION=DENY;LIVE_W5_EXECUTION=DENY.
READY_FOR_RUNTIME_PROOF=0;PRODUCT_READY=NO. No G3 work,PR,merge or deployment.
