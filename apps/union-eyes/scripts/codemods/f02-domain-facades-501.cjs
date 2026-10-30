// F02 codemod: routes whose path advertises one capability but whose handler is something else (a generic CRUD factory over an
// unrelated table, or a wrapper over another route's handlers behind a guard that always passes).
//
// The canonical state of an absent capability is HTTP 501. Each listed route keeps the role floor it already enforced and answers
// 501 for the methods it exported, so a caller is never given another table's rows, or another route's behaviour, as the result of
// the operation its path names. Idempotent: a file that already answers 501 is left alone. Prints every converted path.
const fs = require('fs')
const path = require('path')

const API = path.resolve(__dirname, '../../app/api')

// route -> what it actually was. The reason is written into the file and the ledger.
const FACADES = {
  'equity/monitoring': 'the generic CRUD factory over member_segments (special-category equity data is neither collected nor monitored here)',
  'equity/self-identify': 'the generic CRUD factory over member_segments (no self-identification is recorded)',
  'equity/snapshots': 'the generic CRUD factory over member_segments (no equity snapshot exists)',
  'support/metrics': 'the generic CRUD factory over in_app_notifications (notification rows, not support figures)',
  'support/sla': 'the generic CRUD factory over in_app_notifications (notification rows, not support service levels)',
  'support/tickets': 'the generic CRUD factory over in_app_notifications (notification rows, not tickets)',
  'support/tickets/[id]': 'the generic CRUD factory over in_app_notifications (notification rows, not a ticket)',
  'support/tickets/[id]/assign': 'the generic CRUD factory over in_app_notifications (nothing is assigned)',
  'support/tickets/[id]/comments': 'the generic CRUD factory over in_app_notifications (nothing is commented)',
  'organizing/assignments': 'the generic CRUD factory over organizing_campaigns (no assignment is made)',
  'organizing/assignments/[id]': 'the generic CRUD factory over organizing_campaigns (no assignment is made)',
  'organizing/card-check': 'the generic CRUD factory over organizing_campaigns (no card check is recorded)',
  'organizing/committee': 'the generic CRUD factory over organizing_campaigns (no organizing committee is recorded)',
  'organizing/forms/generate': 'the generic CRUD factory over organizing_campaigns (no form is generated)',
  'organizing/labour-board': 'the generic CRUD factory over organizing_campaigns (no labour board filing is made)',
  'organizing/nlrb-filings': 'the generic CRUD factory over organizing_campaigns (no filing is made)',
  'organizing/notes': 'the generic CRUD factory over organizing_campaigns (no note is stored)',
  'organizing/notes/[id]': 'the generic CRUD factory over organizing_campaigns (no note is stored)',
  'organizing/sequences': 'the generic CRUD factory over organizing_campaigns (no sequence exists)',
  'organizing/sequences/[id]': 'the generic CRUD factory over organizing_campaigns (no sequence exists)',
  'organizing/sequences/[id]/enroll': 'the generic CRUD factory over organizing_campaigns (nobody is enrolled)',
  'organizing/support-percentage': 'the generic CRUD factory over organizing_campaigns (no support percentage is computed)',
  'organizing/workplace-mapping': 'the generic CRUD factory over organizing_campaigns (no workplace is mapped)',
  'continuity/inheritance': 'the generic CRUD factory over pending_profiles, the pre-signup profile table (no succession record exists)',
  'onboarding/readiness': 'a wrapper over the onboarding root handlers behind a guard that always passes (no readiness is checked)',
  'onboarding/transfers': 'a wrapper over the onboarding events recorder behind a guard that always passes (nothing is transferred)',
  'reports/[id]/share': 'the generic CRUD factory over reports, which has no recipient or grant (nothing is shared and its DELETE removed the report)',
  'upload': 'a JSON insert of a media library row that receives no file',
  'enterprise/integrations': 'the generic CRUD factory over oauth_providers, a per-user table of provider account ids and tokens with no organization',
  'events/[id]/occurrences': 'a byte-for-byte copy of the event item route, so its path value was the event, not an occurrence',
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

function exportedMethods(text) {
  const found = new Set()
  for (const m of METHODS) {
    if (new RegExp(`export (?:const|async function|function) ${m}\\b`).test(text)) found.add(m)
  }
  const list = text.match(/export \{ ([A-Z, ]+) \};?/)
  if (list) list[1].split(',').map((s) => s.trim()).filter((s) => METHODS.includes(s)).forEach((m) => found.add(m))
  return METHODS.filter((m) => found.has(m))
}

const converted = []
const skipped = []
for (const [route, was] of Object.entries(FACADES)) {
  const file = path.join(API, ...route.split('/'), 'route.ts')
  if (!fs.existsSync(file)) {
    skipped.push(`${route}: absent`)
    continue
  }
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  if (/ApiError\.notImplemented/.test(text) && !/crudRoutes/.test(text)) {
    skipped.push(`${route}: already 501`)
    continue
  }
  const methods = exportedMethods(text)
  if (methods.length === 0) throw new Error(`no exported methods in ${route}`)
  const floor = (text.match(/(?:readRole|minRole): ['"]([a-z_]+)['"]/) || [])[1] || 'member'
  const tag = (text.match(/tags: \[['"]([^'"]+)['"]\]/) || [])[1] || 'Not implemented'
  const name = route.replace(/\[(\w+)\]/g, ':$1')
  const body = `/**
 * ${methods.join(' ')} /api/${name}
 *
 * Not implemented. This path advertises an operation of its own but was ${was}. It answered with that other behaviour as though
 * it were the operation, so it now answers HTTP 501 and changes and returns nothing.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: '${floor}' },
    openapi: {
      tags: ['${tag}'],
      summary: '/api/${name} (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/${name} is not implemented: it performed no operation of its own.');
  },
);

${methods.map((m) => `export const ${m} = handler;`).join('\n')}
`
  fs.writeFileSync(file, body)
  converted.push(`${route} [${methods.join(',')}] floor=${floor}`)
}
console.log(converted.join('\n'))
if (skipped.length) console.log('skipped:\n' + skipped.join('\n'))
console.log(`converted: ${converted.length}`)
