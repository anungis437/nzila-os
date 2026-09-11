/**
 * Round 55 advisory remediation report — FINAL_NON_VOTING_PARENT_ARCHITECTURE_EXCEPTIONS.
 *
 * Advisory only: never rewrites the manifest. Documents the closure of the
 * two remaining non-voting parent-owned NEEDS_REVIEW tables from round 54
 * (newsletter_list_subscribers, clause_library_tags) plus their blocker
 * root (shared_clause_library), leaving votes/voting_options as the sole
 * remaining parent-owned NEEDS_REVIEW lane.
 */
import * as fs from "fs";
import * as path from "path";

const APP_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(APP_ROOT, "..", "..");
const OUT_DIR = path.resolve(REPO_ROOT, "reports");

interface ClosedTable {
  table: string;
  directParent: string | null;
  authorityModel: "NESTED_COLLECTION_ITEM_AUTHORITY" | "OWNER_PLUS_EXPLICIT_SHARING_AUTHORITY";
  finalClassification: string;
  invocationAuthority: string;
  dbExecutionPrincipal: string;
  djangoDisposition: string;
  concreteDefectsFixed: string[];
  status: "CLOSED";
}

const CLOSED: ClosedTable[] = [
  {
    table: "newsletter_list_subscribers",
    directParent: "newsletter_distribution_lists (CLOSED round 45)",
    authorityModel: "NESTED_COLLECTION_ITEM_AUTHORITY",
    finalClassification: "PARENT_OWNED_RLS_REQUIRED",
    invocationAuthority: "TENANT_USER",
    dbExecutionPrincipal: "TENANT_RUNTIME",
    djangoDisposition: "Already DenyAllPermission since round 47, reverified unchanged",
    concreteDefectsFixed: [
      "route-shape ID conflation: crud-factory itemRoute treated the URL's [id] (distribution list id) as a subscriber row id — replaced with a bespoke collection route (GET) + new item route (DELETE, soft-unsubscribe) that require BOTH listId and subscriberId to match",
      "two frontend callers (distribution-list-manager.tsx, dashboard list-detail page) were unwrapping the withApi response envelope incorrectly and would have silently shown empty subscriber lists even after the backend fix",
    ],
    status: "CLOSED",
  },
  {
    table: "shared_clause_library",
    directParent: null,
    authorityModel: "OWNER_PLUS_EXPLICIT_SHARING_AUTHORITY",
    finalClassification: "MULTI_PARTY_RLS_REQUIRED",
    invocationAuthority: "TENANT_USER",
    dbExecutionPrincipal: "TENANT_RUNTIME",
    djangoDisposition: "Contained via DenyAllPermission (was IsAuthenticated-only, queryset=Model.objects.all())",
    concreteDefectsFixed: [
      "list/search returned every clause regardless of organization or sharingLevel (any steward of any org could read any other org's private CBA clause text)",
      "POST create trusted body.sourceOrganizationId — any steward could create a clause 'owned' by an arbitrary organization",
      "GET/PATCH/DELETE [id] had no ownership or sharing check — any steward could read, edit, or delete any other org's clause",
      "[id]/share GET+POST (sharingLevel/sharedWithOrgIds configuration) had no check — any steward could view or change any clause's sharing settings",
      "compare/route.ts read full clause text/tags and bumped comparisonCount for every requested id with no authorization check",
    ],
    status: "CLOSED",
  },
  {
    table: "clause_library_tags",
    directParent: "shared_clause_library (CLOSED this round)",
    authorityModel: "OWNER_PLUS_EXPLICIT_SHARING_AUTHORITY",
    finalClassification: "MULTI_PARTY_RLS_REQUIRED",
    invocationAuthority: "TENANT_USER",
    dbExecutionPrincipal: "TENANT_RUNTIME",
    djangoDisposition: "Contained via DenyAllPermission (round-54 entry's claim of 'no ViewSet exists' was incorrect — ClauseLibraryTagsViewSet does exist, corrected this round)",
    concreteDefectsFixed: [
      "tag parent injection: DELETE-by-tagId deleted by tagId alone with no clauseId check — a caller could detach a tag belonging to a DIFFERENT clause (possibly a different organization's) as long as they knew or guessed its id",
      "GET/POST/DELETE had zero clause-existence or ownership check at all prior to this round",
    ],
    status: "CLOSED",
  },
];

const FROZEN_VOTING = ["votes", "voting_options"];

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const jsonPath = path.join(OUT_DIR, "union-eyes-parent-architecture-round55.json");
  const mdPath = path.join(OUT_DIR, "union-eyes-parent-architecture-round55.md");

  const report = {
    generatedAt: new Date().toISOString(),
    mission: "FINAL_NON_VOTING_PARENT_ARCHITECTURE_EXCEPTIONS",
    startingParentOwnedNeedsReview: 4,
    activeNonVoting: 2,
    votingFrozen: 2,
    endingParentOwnedNeedsReview: 2,
    endingParentOwnedNeedsReviewTables: FROZEN_VOTING,
    closed: CLOSED,
    frozenVoting: FROZEN_VOTING,
  };

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n");

  const md = [
    "# Round 55 — Final Non-Voting Parent Architecture Exceptions",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    `- Starting parent-owned NEEDS_REVIEW: ${report.startingParentOwnedNeedsReview}`,
    `- Active non-voting this round: ${report.activeNonVoting}`,
    `- Voting frozen (deferred to dedicated round): ${report.votingFrozen}`,
    `- Ending parent-owned NEEDS_REVIEW: ${report.endingParentOwnedNeedsReview} (${FROZEN_VOTING.join(", ")})`,
    "",
    "## Closed tables",
    "",
    ...CLOSED.flatMap((c) => [
      `### ${c.table}`,
      `- Direct parent: ${c.directParent ?? "(owner root)"}`,
      `- Authority model: ${c.authorityModel}`,
      `- Final classification: ${c.finalClassification}`,
      `- Invocation authority: ${c.invocationAuthority} / DB principal: ${c.dbExecutionPrincipal}`,
      `- Django: ${c.djangoDisposition}`,
      `- Concrete defects fixed:`,
      ...c.concreteDefectsFixed.map((d) => `  - ${d}`),
      "",
    ]),
    "## Frozen (not touched this round)",
    "",
    `- Voting: ${FROZEN_VOTING.join(", ")}`,
    "",
  ].join("\n");

  fs.writeFileSync(mdPath, md);

  console.log(`Closed tables: ${CLOSED.length} / 3`);
  console.log(`Parent-owned NEEDS_REVIEW: ${report.startingParentOwnedNeedsReview} -> ${report.endingParentOwnedNeedsReview}`);
  console.log(`Report written to reports/union-eyes-parent-architecture-round55.{json,md}`);
}

main();
