const fs = require('fs')
function edit(p, pairs) {
  let s = fs.readFileSync(p, 'utf8')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error('missing in ' + p + ': ' + a.slice(0, 80))
    s = s.split(a).join(b)
  }
  fs.writeFileSync(p, s)
}
edit('lib/external-calendar-sync/token-crypto.ts', [
  [
    "function getTokenEncryptionKey(): Buffer {",
    "// Plaintext is a test convenience only. A provider token is never written without a key, and a stored value with no encryption\n// prefix is read only for the test runner or during an explicitly flagged migration of legacy rows.\nconst plaintextAllowedForWrite = () => process.env.NODE_ENV === 'test'\nconst legacyPlaintextReadable = () => process.env.NODE_ENV === 'test' || process.env.CALENDAR_TOKEN_ALLOW_LEGACY_PLAINTEXT === 'true'\n\nfunction getTokenEncryptionKey(): Buffer {",
  ],
  [
    "    if (process.env.NODE_ENV === 'production') {\n      throw new Error('Missing CALENDAR_TOKEN_ENCRYPTION_KEY (or FALLBACK_ENCRYPTION_KEY) in production')\n    }\n\n    return Buffer.alloc(0)",
    "    if (!plaintextAllowedForWrite()) {\n      throw new Error('Missing CALENDAR_TOKEN_ENCRYPTION_KEY (or FALLBACK_ENCRYPTION_KEY)')\n    }\n\n    return Buffer.alloc(0)",
  ],
  [
    "  if (!token.startsWith(ENCRYPTED_PREFIX)) {\n    return token\n  }",
    "  if (!token.startsWith(ENCRYPTED_PREFIX)) {\n    if (!legacyPlaintextReadable()) {\n      throw new Error('Calendar token is stored unencrypted and must be re-authorized')\n    }\n    return token\n  }",
  ],
])
