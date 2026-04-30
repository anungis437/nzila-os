'use client'

import { useState } from 'react'

const STEPS = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'connectors', label: 'Connect Channels' },
  { id: 'invite', label: 'Invite Your Team' },
  { id: 'import', label: 'Import Inventory' },
  { id: 'golive', label: 'Go Live' },
] as const

type StepId = (typeof STEPS)[number]['id']

export default function OnboardingPage() {
  const [activeStep, setActiveStep] = useState<StepId>('welcome')
  const [completed, setCompleted] = useState<Set<StepId>>(new Set())

  function markDone(step: StepId, next?: StepId) {
    setCompleted((prev) => new Set([...prev, step]))
    if (next) setActiveStep(next)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Onboarding</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Set up Maestria for your store in five steps.
        </p>
      </div>

      {/* Stepper nav */}
      <nav aria-label="Onboarding steps">
        <ol className="flex items-center gap-2 text-sm">
          {STEPS.map((step, i) => {
            const isDone = completed.has(step.id)
            const isActive = step.id === activeStep
            return (
              <li key={step.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveStep(step.id)}
                  className={[
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : isDone
                        ? 'bg-green-100 text-green-800'
                        : 'bg-muted text-muted-foreground',
                  ].join(' ')}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span
                    className={[
                      'w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold',
                      isDone ? 'bg-green-500 text-white' : 'bg-background border',
                    ].join(' ')}
                  >
                    {isDone ? '✓' : i + 1}
                  </span>
                  {step.label}
                </button>
                {i < STEPS.length - 1 && <span className="text-muted-foreground">›</span>}
              </li>
            )
          })}
        </ol>
      </nav>

      {/* Step content */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        {activeStep === 'welcome' && (
          <WelcomeStep onNext={() => markDone('welcome', 'connectors')} />
        )}
        {activeStep === 'connectors' && (
          <ConnectorsStep onNext={() => markDone('connectors', 'invite')} />
        )}
        {activeStep === 'invite' && (
          <InviteStep onNext={() => markDone('invite', 'import')} />
        )}
        {activeStep === 'import' && (
          <ImportStep onNext={() => markDone('import', 'golive')} />
        )}
        {activeStep === 'golive' && (
          <GoLiveStep done={completed.size === STEPS.length - 1} onFinish={() => markDone('golive')} />
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>{completed.size} / {STEPS.length} steps complete</span>
        </div>
        <progress
          className="h-2 w-full overflow-hidden rounded-full bg-muted [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary"
          value={completed.size}
          max={STEPS.length}
        />
      </div>
    </div>
  )
}

/* ─── Step sub-components ─────────────────────────────────────────────────── */

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Welcome to Maestria</h2>
      <p className="text-sm text-muted-foreground">
        Maestria is your unified commerce intelligence platform for Shop Moi Ça. This wizard will
        walk you through connecting your sales channels, inviting your team, and importing your
        product catalogue so you can start making data-driven decisions from day one.
      </p>
      <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
        <li>Connect Shopify, Google Ads, and Zoho CRM</li>
        <li>Invite team members with role-based access</li>
        <li>Import your product catalogue via CSV</li>
        <li>Review your pilot metrics dashboard</li>
      </ul>
      <p className="text-xs text-muted-foreground">
        Estimated setup time: <strong>15–30 minutes</strong>
      </p>
      <div className="pt-2">
        <button
          type="button"
          onClick={onNext}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded hover:opacity-90"
        >
          Get Started →
        </button>
      </div>
    </div>
  )
}

function ConnectorsStep({ onNext }: { onNext: () => void }) {
  const connectors = [
    { id: 'shopify', name: 'Shopify', description: 'Sync orders, products, and revenue data.' },
    { id: 'google-ads', name: 'Google Ads', description: 'Track campaign spend and ROAS.' },
    { id: 'zoho', name: 'Zoho CRM', description: 'Align sales pipeline with commerce data.' },
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Connect Your Channels</h2>
      <p className="text-sm text-muted-foreground">
        Authorize each integration below. You can connect channels individually and return later to
        add more. Click <strong>Connect</strong> to be redirected to the authorization page.
      </p>
      <div className="space-y-3">
        {connectors.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between p-3 rounded border bg-background"
          >
            <div>
              <p className="text-sm font-medium">{c.name}</p>
              <p className="text-xs text-muted-foreground">{c.description}</p>
            </div>
            <a
              href={`/api/maestria/connectors/${c.id}`}
              className="text-xs px-3 py-1.5 rounded bg-muted hover:bg-muted/80 font-medium"
            >
              Connect
            </a>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Check connector health anytime at <strong>Settings → Connectors</strong>.
      </p>
      <div className="pt-2">
        <button
          type="button"
          onClick={onNext}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded hover:opacity-90"
        >
          Continue →
        </button>
      </div>
    </div>
  )
}

function InviteStep({ onNext }: { onNext: () => void }) {
  const roles = [
    { name: 'admin', description: 'Full access including user management and approvals.' },
    { name: 'manager', description: 'Access to margins, finance, and campaign data.' },
    { name: 'ops', description: 'Inventory, shipping, and supplier visibility.' },
    { name: 'client', description: 'Read-only client portal access.' },
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Invite Your Team</h2>
      <p className="text-sm text-muted-foreground">
        Use the <strong>Users</strong> section under Settings to send email invitations. Assign the
        appropriate role for each team member.
      </p>
      <div className="overflow-x-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <Th>Role</Th>
              <Th>Access Level</Th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.name} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{r.name}</td>
                <td className="px-3 py-2 text-muted-foreground text-xs">{r.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        API: <code className="bg-muted px-1 rounded">POST /api/maestria/users/invite</code>
      </p>
      <div className="pt-2">
        <button
          type="button"
          onClick={onNext}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded hover:opacity-90"
        >
          Continue →
        </button>
      </div>
    </div>
  )
}

function ImportStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Import Your Inventory</h2>
      <p className="text-sm text-muted-foreground">
        Upload a CSV file to bulk-import your product catalogue. The file must include the following
        columns:
      </p>
      <div className="overflow-x-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <Th>Column</Th>
              <Th>Required</Th>
              <Th>Description</Th>
            </tr>
          </thead>
          <tbody>
            {[
              { col: 'sku', req: 'Yes', desc: 'Unique product identifier' },
              { col: 'name', req: 'Yes', desc: 'Product display name' },
              { col: 'cost', req: 'Yes', desc: 'Unit cost (CAD)' },
              { col: 'price', req: 'Yes', desc: 'Selling price (CAD)' },
              { col: 'stock', req: 'Yes', desc: 'Current stock quantity' },
              { col: 'category', req: 'No', desc: 'Product category label' },
              { col: 'supplier', req: 'No', desc: 'Supplier name' },
            ].map((r) => (
              <tr key={r.col} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{r.col}</td>
                <td className="px-3 py-2 text-xs">{r.req}</td>
                <td className="px-3 py-2 text-muted-foreground text-xs">{r.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Upload endpoint: <code className="bg-muted px-1 rounded">POST /api/maestria/import/csv</code>
        {' '}(multipart/form-data, field name: <code className="bg-muted px-1 rounded">file</code>)
      </p>
      <div className="pt-2">
        <button
          type="button"
          onClick={onNext}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded hover:opacity-90"
        >
          Continue →
        </button>
      </div>
    </div>
  )
}

function GoLiveStep({ done, onFinish }: { done: boolean; onFinish: () => void }) {
  const checks = [
    'At least one connector authorized',
    'Admin user invited and activated',
    'Product catalogue imported',
    'Pricing rules configured',
    'Health check passing (/api/maestria/health)',
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Go Live</h2>
      <p className="text-sm text-muted-foreground">
        Before going live, confirm all items below are complete. Your Customer Success Manager will
        schedule a final review call.
      </p>
      <ul className="space-y-2">
        {checks.map((c) => (
          <li key={c} className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 text-green-600">✓</span>
            {c}
          </li>
        ))}
      </ul>
      <div className="rounded bg-muted p-3 text-xs text-muted-foreground space-y-1">
        <p><strong>Health endpoint:</strong> <code>/api/maestria/health</code></p>
        <p><strong>Readiness endpoint:</strong> <code>/api/maestria/readiness</code></p>
        <p><strong>Metrics:</strong> <code>/api/maestria/metrics</code></p>
        <p><strong>Pilot dashboard:</strong> <code>/internal/pilot-metrics</code></p>
      </div>
      {done ? (
        <div className="rounded bg-green-50 border border-green-200 p-3 text-sm text-green-800">
          🎉 Onboarding complete! Your Maestria workspace is ready.
        </div>
      ) : (
        <button
          type="button"
          onClick={onFinish}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded hover:opacity-90"
        >
          Mark Complete
        </button>
      )}
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left text-xs font-semibold">{children}</th>
}
