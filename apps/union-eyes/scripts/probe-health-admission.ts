import { evaluateCatalogAdmission } from '@/lib/operations/catalog-admission'
import { GET } from '@/app/api/health/route'

async function main() {
  const admission = await evaluateCatalogAdmission(process.env.DATABASE_URL)
  const response = await GET()
  const body = await response.json()
  process.stdout.write(JSON.stringify({
    httpStatus: response.status,
    ok: body.ok,
    status: body.status,
    catalog: body.checks?.catalogAuthority ?? null,
    admissionOk: admission.ok,
    applicationReady: admission.applicationReady,
    violationCount: admission.violations.length,
    violations: admission.violations.slice(0, 8),
  }))
}

main()
