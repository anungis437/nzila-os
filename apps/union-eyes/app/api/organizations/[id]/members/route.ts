import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { db } from '@/db/db';
import { organizationMembers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

const createMemberSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(['member', 'steward', 'admin', 'executive', 'observer']).default('member'),
  status: z.enum(['active', 'inactive', 'pending', 'suspended']).default('active'),
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  phone: z.string().max(50).optional(),
  department: z.string().max(255).optional(),
  membership_number: z.string().max(100).optional(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const rows = await db.select().from(organizationMembers)
    .where(eq(organizationMembers.organizationId, id));

  const mapped = rows.map(row => ({
    id: row.id,
    user_id: row.userId,
    organization_id: row.organizationId,
    role: row.role,
    status: row.status,
    name: row.name,
    email: row.email,
    phone: row.phone,
    department: row.department,
    membership_number: row.membershipNumber,
    is_primary: row.isPrimary,
    created_at: row.createdAt,
    joined_at: row.joinedAt,
    updated_at: row.updatedAt,
  }));

  return NextResponse.json({ data: mapped });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues.map(i => ({ path: i.path, message: i.message })) }, { status: 400 });
  }

  const { user_id, role, status, name, email, phone, department, membership_number } = parsed.data;

  const [created] = await withRLSContext(async () =>
    db.insert(organizationMembers).values({
      userId: user_id,
      organizationId: id,
      role,
      status,
      name,
      email,
      phone,
      department,
      membershipNumber: membership_number,
    }).returning()
  );

  return NextResponse.json({ data: created }, { status: 201 });
}