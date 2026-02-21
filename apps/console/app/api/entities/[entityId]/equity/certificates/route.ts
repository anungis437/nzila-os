// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Share Certificates
 * GET  /api/entities/[entityId]/equity/certificates   → list certificates
 * POST /api/entities/[entityId]/equity/certificates   → issue new certificate
 */
import { NextRequest, NextResponse } from 'next/server'
import { platformDb } from '@nzila/db/platform'
import { shareCertificates } from '@nzila/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'
import { z } from 'zod'

const CreateCertificateSchema = z.object({
  shareholderId: z.string().uuid(),
  classId: z.string().uuid(),
  certificateNumber: z.string().min(1),
  issuedDate: z.string().min(1),
  quantity: z.number().int().positive(),
  documentId: z.string().uuid().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await params
  const guard = await requireEntityAccess(entityId)
  if (!guard.ok) return guard.response

  const rows = await platformDb
    .select()
    .from(shareCertificates)
    .where(eq(shareCertificates.entityId, entityId))
    .orderBy(desc(shareCertificates.createdAt))

  return NextResponse.json(rows)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await params
  const guard = await requireEntityAccess(entityId, { minRole: 'entity_admin' })
  if (!guard.ok) return guard.response

  const body = await req.json()
  const parsed = CreateCertificateSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const [cert] = await platformDb
    .insert(shareCertificates)
    .values({
      entityId,
      shareholderId: parsed.data.shareholderId,
      classId: parsed.data.classId,
      certificateNumber: parsed.data.certificateNumber,
      issuedDate: parsed.data.issuedDate,
      quantity: BigInt(parsed.data.quantity),
      documentId: parsed.data.documentId ?? null,
    })
    .returning()

  return NextResponse.json(cert, { status: 201 })
}
