#!/usr/bin/env node
/**
 * #1038: resolve a production release identity without allowing a manual
 * dispatch ref to become a filesystem path or a fictitious signed tag.
 * This is metadata only; it does NOT grant production release authority.
 */
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

function deny(reason) { throw new Error('PRODUCTION_RELEASE_REF_DENIED: ' + reason) }
const canonicalRunId = value => typeof value === 'string' &&
  /^[1-9][0-9]*$/.test(value) && Number.isSafeInteger(Number(value))

export function resolveProductionReleaseRef({ ref, eventName, runId, sha, repository }) {
  if (!canonicalRunId(runId) || !/^[0-9a-f]{40}$/.test(sha ?? '') ||
      typeof repository !== 'string' ||
      !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    deny('untrusted run, source or repository identity')
  }
  const tag = /^refs\/tags\/(v[0-9]+\.[0-9]+\.[0-9]+)$/.exec(ref ?? '')
  if (eventName === 'push' && tag) {
    return Object.freeze({
      releaseRef: tag[1],
      version: tag[1].slice(1),
      trigger: 'push',
      changelogUrl: `https://github.com/${repository}/releases/tag/${tag[1]}`,
    })
  }
  if (eventName === 'workflow_dispatch' && ref === 'refs/heads/main') {
    return Object.freeze({
      releaseRef: `dispatch-${runId}`,
      version: `0.0.0-dispatch.${runId}`,
      trigger: 'workflow_dispatch',
      changelogUrl: `https://github.com/${repository}/actions/runs/${runId}`,
    })
  }
  deny('only canonical release tags or manual dispatch from main are eligible')
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const [ref, eventName, runId, sha, repository] = process.argv.slice(2)
    console.log(JSON.stringify(resolveProductionReleaseRef({ref,eventName,runId,sha,repository})))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
