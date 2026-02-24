/**
 * Dispatch a GitHub Actions workflow_dispatch event.
 *
 * Requires GITHUB_TOKEN env var with actions:write scope
 * on the target repository.
 */

import { createLogger } from '@nzila/os-core'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? ''
const REPO_OWNER = process.env.GITHUB_REPO_OWNER ?? 'anungis437'
const REPO_NAME = process.env.GITHUB_REPO_NAME ?? 'nzila-automation'
const WORKFLOW_ID = 'nzila-playbook-runner.yml'

const logger = createLogger('dispatch')

export interface DispatchInput {
  playbook: string
  correlation_id: string
  dry_run: boolean
  args_json: string
}

export async function dispatchWorkflow(input: DispatchInput): Promise<boolean> {
  if (!GITHUB_TOKEN) {
    logger.error('[dispatch] GITHUB_TOKEN is not set — skipping dispatch')
    return false
  }

  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_ID}/dispatches`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      ref: 'main',
      inputs: {
        playbook: input.playbook,
        correlation_id: input.correlation_id,
        dry_run: String(input.dry_run),
        args_json: input.args_json,
      },
    }),
  })

  if (res.status === 204) {
    logger.info(`[dispatch] Workflow dispatched for ${input.correlation_id}`)
    return true
  }

  const body = await res.text()
  logger.error(`[dispatch] Failed (${res.status}): ${body}`)
  return false
}
