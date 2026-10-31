const fs = require('fs')
const f = 'lib/api/crud-governance.ts'
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const swap = (a, b) => { if (!s.includes(a)) throw new Error(`missing ${a.slice(0, 70)}`); s = s.replace(a, b) }
swap("  'documents', 'integration_api_keys',\n  'external_accounts', 'security_events', 'poll_votes', 'wcb_claims', 'member_employment', 'pending_profiles',", "  'documents',\n  'security_events', 'poll_votes', 'member_employment', 'pending_profiles',")
fs.writeFileSync(f, s)
console.log('ok')
