import { expect } from 'vitest'

// The native project owns external-resource-read.postgres.test.ts and fails closed
// without an owned clone. The heavy project excludes that file, so the ordinary
// fast command neither runs nor counts it. This hook remains for an explicit heavy
// invocation that supplies UE_NATIVE_TEMPLATE_URL, and it keeps that connection
// environment out of the other SQL-engine tests in the same worker.
const file = expect.getState().testPath?.replaceAll('\\', '/')
if (file?.endsWith('/db/__tests__/external-resource-read.postgres.test.ts'))
  await import('./native-test-database-isolation')
