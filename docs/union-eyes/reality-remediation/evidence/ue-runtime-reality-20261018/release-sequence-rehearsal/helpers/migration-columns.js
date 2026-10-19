// Lists the column names a Django migration adds/alters (name="..." operands), for collision checks. Credential-free.
const s = require('fs').readFileSync(process.argv[2], 'utf8');
console.log([...new Set([...s.matchAll(/name="([a-z_]+)"/g)].map((m) => m[1]))].join(','));