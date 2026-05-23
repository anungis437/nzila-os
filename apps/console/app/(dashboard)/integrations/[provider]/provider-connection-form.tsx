'use client'

import { useState, type FormEvent } from 'react'

interface SecretField {
  key: string
  label: string
  optional: boolean
}

interface Props {
  provider: string
  orgId: string
  secrets: string[]
}

function parseSecretField(raw: string): SecretField {
  // Source strings look like "apiKey", "botToken (optional)", "fromNumber".
  const optionalMatch = raw.match(/\(\s*optional\s*\)/i)
  const key = raw.replace(/\(.*?\)/g, '').trim()
  return {
    key,
    label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
    optional: Boolean(optionalMatch),
  }
}

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }

export function ProviderConnectionForm({ provider, orgId, secrets }: Props) {
  const fields = secrets.map(parseSecretField)
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, ''])),
  )
  const [state, setState] = useState<SubmitState>({ kind: 'idle' })

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState({ kind: 'submitting' })

    const submittedSecrets: Record<string, string> = {}
    for (const field of fields) {
      const v = values[field.key]?.trim() ?? ''
      if (v.length > 0) submittedSecrets[field.key] = v
      else if (!field.optional) {
        setState({ kind: 'error', message: `Missing required field: ${field.label}` })
        return
      }
    }

    try {
      const response = await fetch('/api/integrations/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({ orgId, provider, secrets: submittedSecrets }),
      })
      const json = (await response.json().catch(() => ({}))) as {
        ok?: boolean
        test?: { error?: string }
        error?: unknown
      }
      if (response.ok && json.ok) {
        setState({ kind: 'success', message: 'Connection saved and live probe succeeded.' })
        return
      }
      if (response.status === 422) {
        setState({
          kind: 'error',
          message: `Credentials stored, but provider rejected the probe: ${
            json.test?.error ?? 'unknown error'
          }`,
        })
        return
      }
      const errMsg =
        typeof json.error === 'string'
          ? json.error
          : `Request failed (${response.status})`
      setState({ kind: 'error', message: errMsg })
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map((field) => (
        <div key={field.key}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {field.label}{' '}
            {field.optional && (
              <span className="text-xs font-normal text-gray-400">(optional)</span>
            )}
          </label>
          <input
            type="password"
            autoComplete="off"
            value={values[field.key] ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder={field.optional ? 'leave blank to skip' : 'required'}
          />
        </div>
      ))}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={state.kind === 'submitting'}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state.kind === 'submitting' ? 'Connecting…' : 'Save & test connection'}
        </button>
        {state.kind === 'success' && (
          <span className="text-sm text-green-700">{state.message}</span>
        )}
        {state.kind === 'error' && (
          <span className="text-sm text-red-600">{state.message}</span>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Secrets are encrypted at rest (AES-256-GCM) via{' '}
        <code className="bg-gray-100 px-1 rounded">/api/integrations/connect</code> and a live
        probe is executed against the provider before the connection is saved.
      </p>
    </form>
  )
}
