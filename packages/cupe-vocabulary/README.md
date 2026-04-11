# CUPE Vocabulary Package

Provides configurable vocabulary and taxonomy layer for CUPE union grievance management.

## Features

- **CUPE Case Types**: discipline, harassment, discrimination, wage dispute, safety, etc.
- **Priority Levels**: low, medium, high, critical (with SLA hours)
- **Severity Ratings**: minor, moderate, serious, critical
- **Status Flow**: filed → acknowledged → investigating → settled/denied/escalated → closed
- **Role-Based Permissions**: member, steward, chief steward, business agent, officer, admin
- **Validation**: Zod-based validators for case type, priority, status

## Usage

### Load Vocabulary

```typescript
import { getCUPEVocabulary } from '@nzila/cupe-vocabulary';

const vocab = getCUPEVocabulary();
console.log(vocab.caseTypes); // Returns all case types
```

### Validate User Input

```typescript
import { validateCaseType, validatePriority, validateStatus } from '@nzila/cupe-vocabulary';

const result = validateCaseType('discipline');
if (!result.valid) {
  console.error(result.error?.message);
}
```

### Get Specific Items

```typescript
import { getCaseTypeById, getPriorityById, getStatusById } from '@nzila/cupe-vocabulary';

const discipline = getCaseTypeById('discipline');
const critical = getPriorityById('critical');
const filed = getStatusById('filed');
```

## v0.1 Limitations

- **Hardcoded Vocabulary**: CUPE standards loaded at startup
- **No Per-Org Customization**: System-wide defaults only (Phase 8 feature)
- **No JSON Configuration**: Vocabularies defined in TypeScript (Phase 8 feature)

Customization support deferred to Phase 8 based on post-pilot feedback.

## API Routes (UnionEyes Integration)

Added to `apps/union-eyes/app/api/vocabulary/`:

- `GET /api/vocabulary` — Returns complete vocabulary
- `GET /api/vocabulary/case-types` — Case types only
- `GET /api/vocabulary/priorities` — Priorities only
- `GET /api/vocabulary/statuses` — Statuses only

All endpoints are org-scoped and RLS-enforced.

## Tests

```bash
pnpm --filter @nzila/cupe-vocabulary test
```

## Related

- **PR-010**: Package creation + integration
- **PR-011**: CUPE taxonomy pack fixtures
- **PR-012**: Seed scripts + admin form integration
