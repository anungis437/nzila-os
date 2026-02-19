# Union Eyes Service Migration Guide

## Phase 1: Critical Services (50+ database operations)

Total services to migrate: 8

### Migration Steps

#### 1. Install Generated Django ViewSets

```bash
# Copy generated ViewSets to Django backend
cp data/django_api_views/*.py C:/APPS/nzila-union-eyes/backend/union_eyes/views/
```

#### 2. Update Django URLs

Add to `C:/APPS/nzila-union-eyes/backend/union_eyes/urls.py`:

```python
from django.urls import path, include
from .views import router  # Import generated router

urlpatterns = [
    # ... existing patterns ...
    path('api/services/', include(router.urls)),
]
```

#### 3. Install TypeScript API Clients

```bash
# Copy generated API clients to frontend
cp data/typescript_api_clients/*.ts C:/APPS/nzila-union-eyes/frontend/lib/api/
```

#### 4. Update Service Files

For each service, replace Drizzle database calls with API client calls:


##### 1. workflows.test (92 operations)

**File:** `services\financial-service\src\tests\workflows.test.ts`

**Before:**
```typescript
import { db } from '@/db';
import { someTable } from '@/db/schema/...';

export async function getSomething() {
  return db.select().from(someTable).where(...);
}
```

**After:**
```typescript
import { getWorkflows.testList } from '@/lib/api/workflows.test-api';

export async function getSomething() {
  return getWorkflows.testList();
}
```


##### 2. governance-service (74 operations)

**File:** `services\governance-service.ts`

**Before:**
```typescript
import { db } from '@/db';
import { someTable } from '@/db/schema/...';

export async function getSomething() {
  return db.select().from(someTable).where(...);
}
```

**After:**
```typescript
import { getGovernanceserviceList } from '@/lib/api/governance-service-api';

export async function getSomething() {
  return getGovernanceserviceList();
}
```


##### 3. schema (68 operations)

**File:** `services\financial-service\src\db\schema.ts`

**Before:**
```typescript
import { db } from '@/db';
import { someTable } from '@/db/schema/...';

export async function getSomething() {
  return db.select().from(someTable).where(...);
}
```

**After:**
```typescript
import { getSchemaList } from '@/lib/api/schema-api';

export async function getSomething() {
  return getSchemaList();
}
```


##### 4. certification-management-service (62 operations)

**File:** `services\certification-management-service.ts`

**Before:**
```typescript
import { db } from '@/db';
import { someTable } from '@/db/schema/...';

export async function getSomething() {
  return db.select().from(someTable).where(...);
}
```

**After:**
```typescript
import { getCertificationmanagementserviceList } from '@/lib/api/certification-management-service-api';

export async function getSomething() {
  return getCertificationmanagementserviceList();
}
```


##### 5. lmbp-immigration-service (62 operations)

**File:** `services\lmbp-immigration-service.ts`

**Before:**
```typescript
import { db } from '@/db';
import { someTable } from '@/db/schema/...';

export async function getSomething() {
  return db.select().from(someTable).where(...);
}
```

**After:**
```typescript
import { getLmbpimmigrationserviceList } from '@/lib/api/lmbp-immigration-service-api';

export async function getSomething() {
  return getLmbpimmigrationserviceList();
}
```


##### 6. schema (62 operations)

**File:** `services\financial-service\drizzle\schema.ts`

**Before:**
```typescript
import { db } from '@/db';
import { someTable } from '@/db/schema/...';

export async function getSomething() {
  return db.select().from(someTable).where(...);
}
```

**After:**
```typescript
import { getSchemaList } from '@/lib/api/schema-api';

export async function getSomething() {
  return getSchemaList();
}
```


##### 7. tax-slip-service (53 operations)

**File:** `services\tax-slip-service.ts`

**Before:**
```typescript
import { db } from '@/db';
import { someTable } from '@/db/schema/...';

export async function getSomething() {
  return db.select().from(someTable).where(...);
}
```

**After:**
```typescript
import { getTaxslipserviceList } from '@/lib/api/tax-slip-service-api';

export async function getSomething() {
  return getTaxslipserviceList();
}
```


##### 8. signature-service (51 operations)

**File:** `services\pki\signature-service.ts`

**Before:**
```typescript
import { db } from '@/db';
import { someTable } from '@/db/schema/...';

export async function getSomething() {
  return db.select().from(someTable).where(...);
}
```

**After:**
```typescript
import { getSignatureserviceList } from '@/lib/api/signature-service-api';

export async function getSomething() {
  return getSignatureserviceList();
}
```


#### 5. Remove Drizzle Dependencies

After all services are migrated:

```bash
cd C:/APPS/nzila-union-eyes/frontend
pnpm remove drizzle-orm drizzle-zod
pnpm remove --save-dev drizzle-kit
```

#### 6. Remove Database Configuration

Delete or comment out:
- `C:/APPS/nzila-union-eyes/frontend/db/` directory
- `drizzle.config.ts`
- Database connection in Next.js config

#### 7. Test Migration

```bash
# Start Django backend
cd C:/APPS/nzila-union-eyes/backend
python manage.py runserver

# Start Next.js frontend
cd C:/APPS/nzila-union-eyes/frontend
pnpm dev

# Run tests
pnpm test
```

### Migration Checklist

- [ ] 1. Migrate workflows.test (92 ops)
- [ ] 2. Migrate governance-service (74 ops)
- [ ] 3. Migrate schema (68 ops)
- [ ] 4. Migrate certification-management-service (62 ops)
- [ ] 5. Migrate lmbp-immigration-service (62 ops)
- [ ] 6. Migrate schema (62 ops)
- [ ] 7. Migrate tax-slip-service (53 ops)
- [ ] 8. Migrate signature-service (51 ops)

- [ ] Remove Drizzle dependencies
- [ ] Remove database config
- [ ] Test all features
- [ ] Deploy to staging

## Next Phases

- **Phase 2:** High priority (20-49 ops) - 31 services
- **Phase 3:** Medium priority (5-19 ops) - 15 services
- **Phase 4:** Low priority (1-4 ops) - 9 services
