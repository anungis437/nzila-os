const fs = require('fs')
fs.writeFileSync('lib/api/org-references.ts', `import { and, eq } from 'drizzle-orm';
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import { ApiError } from '@/lib/api/errors';
import { db } from '@/db/db';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface OrgReference {
  /** The body field that carries the id, for the error message. */
  field: string;
  value: unknown;
  table: PgTable & { id: PgColumn; organizationId: PgColumn };
}

/**
 * A foreign key taken from a request body names a row, not an authority: it must be a row of the caller's own organization. An absent
 * or null value is left to the column's own rules; a present one that is malformed is a 400 and one that is not the organization's is a
 * 404, so a body cannot link a record to another tenant's employer, worksite or agreement.
 */
export async function assertOrganizationOwns(references: OrgReference[], organizationId: string | null | undefined): Promise<void> {
  const present = references.filter((reference) => reference.value !== undefined && reference.value !== null);
  if (present.length === 0) return;
  if (!organizationId) throw ApiError.forbidden('Organization context required');
  for (const { field, value, table } of present) {
    if (typeof value !== 'string' || !UUID.test(value)) throw ApiError.badRequest(\`\${field} must be a valid id\`);
    const [row] = await db
      .select({ id: table.id })
      .from(table as PgTable)
      .where(and(eq(table.id, value), eq(table.organizationId, organizationId)))
      .limit(1);
    if (!row) throw ApiError.notFound(field);
  }
}
`)

const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}
edit('app/api/units/route.ts', [
  ["import { bargainingUnits } from '@/db/schema';", "import { bargainingUnits, employers, worksites } from '@/db/schema';\nimport { assertOrganizationOwns } from '@/lib/api/org-references';"],
  [
    "  writableFields: ['employerId',",
    "  // The employer and the worksite must be the caller's own organization's.\n  beforeCreate: async (values, { organizationId }) => {\n    await assertOrganizationOwns([\n      { field: 'employerId', value: values.employerId, table: employers },\n      { field: 'worksiteId', value: values.worksiteId, table: worksites },\n    ], organizationId);\n    return values;\n  },\n  writableFields: ['employerId',",
  ],
])
edit('app/api/units/[id]/route.ts', [
  ["import { bargainingUnits } from '@/db/schema';", "import { bargainingUnits, employers, worksites } from '@/db/schema';\nimport { assertOrganizationOwns } from '@/lib/api/org-references';"],
  [
    "  omitFromResponse: ['notes', 'customFields'],\n  // Certification",
    "  omitFromResponse: ['notes', 'customFields'],\n  beforeUpdate: async (updates, { organizationId }) => {\n    await assertOrganizationOwns([\n      { field: 'employerId', value: updates.employerId, table: employers },\n      { field: 'worksiteId', value: updates.worksiteId, table: worksites },\n    ], organizationId);\n    return updates;\n  },\n  // Certification",
  ],
])
edit('app/api/worksites/route.ts', [
  ["import { worksites } from '@/db/schema';", "import { employers, worksites } from '@/db/schema';\nimport { assertOrganizationOwns } from '@/lib/api/org-references';"],
  [
    "  writeRole: 'steward',\n});",
    "  writeRole: 'steward',\n  beforeCreate: async (values, { organizationId }) => {\n    await assertOrganizationOwns([{ field: 'employerId', value: values.employerId, table: employers }], organizationId);\n    return values;\n  },\n});",
  ],
])
edit('app/api/worksites/[id]/route.ts', [
  ["import { worksites } from '@/db/schema';", "import { employers, worksites } from '@/db/schema';\nimport { assertOrganizationOwns } from '@/lib/api/org-references';"],
  [
    "  writeRole: 'steward',\n});",
    "  writeRole: 'steward',\n  beforeUpdate: async (updates, { organizationId }) => {\n    await assertOrganizationOwns([{ field: 'employerId', value: updates.employerId, table: employers }], organizationId);\n    return updates;\n  },\n});",
  ],
])
console.log('ok')
