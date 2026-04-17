/**
 * /console/ai/models — AI Model Registry & Deployment Dashboard
 *
 * Shows all registered models, deployment configurations, and
 * per-entity/app/feature routing. Proves DB-backed model governance.
 */
import { platformDb } from '@nzila/db/platform'
import {
  aiModels,
  aiDeployments,
  aiDeploymentRoutes,
} from '@nzila/db/schema'
import { eq, desc } from 'drizzle-orm'
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

const DEFAULT_ENTITY_ID = process.env.NZILA_DEFAULT_ENTITY_ID ?? ''

async function getModelRegistryData(orgId: string) {
  const models = await platformDb
    .select()
    .from(aiModels)
    .orderBy(desc(aiModels.createdAt))

  const deployments = await platformDb
    .select({
      id: aiDeployments.id,
      modelId: aiDeployments.modelId,
      deploymentName: aiDeployments.deploymentName,
      environment: aiDeployments.environment,
      allowedDataClasses: aiDeployments.allowedDataClasses,
      maxTokens: aiDeployments.maxTokens,
      defaultTemperature: aiDeployments.defaultTemperature,
      costProfile: aiDeployments.costProfile,
      enabled: aiDeployments.enabled,
      approvedBy: aiDeployments.approvedBy,
      approvedAt: aiDeployments.approvedAt,
      createdAt: aiDeployments.createdAt,
      modelFamily: aiModels.family,
      modelProvider: aiModels.provider,
      modelModality: aiModels.modality,
    })
    .from(aiDeployments)
    .innerJoin(aiModels, eq(aiDeployments.modelId, aiModels.id))
    .orderBy(desc(aiDeployments.createdAt))

  const routes = await platformDb
    .select({
      id: aiDeploymentRoutes.id,
      orgId: aiDeploymentRoutes.orgId,
      appKey: aiDeploymentRoutes.appKey,
      profileKey: aiDeploymentRoutes.profileKey,
      feature: aiDeploymentRoutes.feature,
      deploymentId: aiDeploymentRoutes.deploymentId,
      deploymentName: aiDeployments.deploymentName,
      environment: aiDeployments.environment,
    })
    .from(aiDeploymentRoutes)
    .innerJoin(aiDeployments, eq(aiDeploymentRoutes.deploymentId, aiDeployments.id))
    .where(eq(aiDeploymentRoutes.orgId, orgId))
    .orderBy(desc(aiDeploymentRoutes.createdAt))

  return { models, deployments, routes }
}

export default async function AiModelsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!DEFAULT_ENTITY_ID) {
    return <div className="p-8 text-red-600">NZILA_DEFAULT_ENTITY_ID not configured</div>
  }

  const { models, deployments, routes } = await getModelRegistryData(DEFAULT_ENTITY_ID)

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-2 pb-8 sm:px-4">
      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-linear-to-br from-card via-card to-muted/40 p-6 shadow-sm">
        <div className="absolute -left-8 top-8 h-24 w-24 rounded-full bg-cyan-500/10 blur-2xl" />
        <div className="absolute -right-8 bottom-0 h-32 w-32 rounded-full bg-violet-500/10 blur-2xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Console / AI</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">AI Model Registry</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Governance view of registered models, active deployments, and per-feature routing for this entity.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:min-w-90">
            <SummaryTile label="Models" value={String(models.length)} />
            <SummaryTile label="Deployments" value={String(deployments.length)} />
            <SummaryTile label="Routes" value={String(routes.length)} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Registered Models</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Base registry of model families and modalities available to the platform.
            </p>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Provider</th>
                <th className="px-4 py-3 text-left font-medium">Family</th>
                <th className="px-4 py-3 text-left font-medium">Modality</th>
                <th className="px-4 py-3 text-left font-medium">Notes</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {models.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    No models registered. Add models to the ai_models table.
                  </td>
                </tr>
              )}
              {models.map((model) => (
                <tr key={model.id} className="border-b hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{model.provider}</td>
                  <td className="px-4 py-3 font-medium">{model.family}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      model.modality === 'text'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {model.modality}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{model.notes ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {model.createdAt.toISOString().slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold tracking-tight">Deployments</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Approved runtime configurations, token limits, environment targeting, and data-class constraints.
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Deployment Name</th>
                <th className="px-4 py-3 text-left font-medium">Model</th>
                <th className="px-4 py-3 text-left font-medium">Env</th>
                <th className="px-4 py-3 text-left font-medium">Modality</th>
                <th className="px-4 py-3 text-left font-medium">Max Tokens</th>
                <th className="px-4 py-3 text-left font-medium">Data Classes</th>
                <th className="px-4 py-3 text-left font-medium">Enabled</th>
                <th className="px-4 py-3 text-left font-medium">Approved</th>
              </tr>
            </thead>
            <tbody>
              {deployments.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                    No deployments configured.
                  </td>
                </tr>
              )}
              {deployments.map((dep) => (
                <tr key={dep.id} className="border-b hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{dep.deploymentName}</td>
                  <td className="px-4 py-3 text-xs">
                    {dep.modelProvider}/{dep.modelFamily}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      dep.environment === 'prod'
                        ? 'bg-red-100 text-red-800'
                        : dep.environment === 'staging'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {dep.environment}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">{dep.modelModality}</td>
                  <td className="px-4 py-3 text-xs">{dep.maxTokens}</td>
                  <td className="px-4 py-3 text-xs">
                    {(dep.allowedDataClasses as string[])?.join(', ') ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block h-2 w-2 rounded-full ${dep.enabled ? 'bg-green-500' : 'bg-red-500'}`} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {dep.approvedBy ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold tracking-tight">Deployment Routes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
          Per-feature routing determines which deployment handles each AI feature.
          Changing a route here changes model routing without code changes.
        </p>
        </div>
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">App</th>
                <th className="px-4 py-3 text-left font-medium">Profile</th>
                <th className="px-4 py-3 text-left font-medium">Feature</th>
                <th className="px-4 py-3 text-left font-medium">Deployment</th>
                <th className="px-4 py-3 text-left font-medium">Env</th>
              </tr>
            </thead>
            <tbody>
              {routes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    No routes configured. The gateway will fall back to env-var defaults.
                  </td>
                </tr>
              )}
              {routes.map((route) => (
                <tr key={route.id} className="border-b hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{route.appKey}</td>
                  <td className="px-4 py-3 font-mono text-xs">{route.profileKey}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-800">
                      {route.feature}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{route.deploymentName}</td>
                  <td className="px-4 py-3 text-xs">{route.environment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background/80 px-4 py-3 shadow-sm backdrop-blur-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  )
}
