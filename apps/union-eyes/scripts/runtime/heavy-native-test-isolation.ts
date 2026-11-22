import { expect } from 'vitest'

// This heavy-project file needs the same pristine combined template and four
// restricted LOGIN credentials as its dedicated native-project execution.
// Keep its connection environment out of ordinary SQL-engine/unit tests.
const file = expect.getState().testPath?.replaceAll('\\', '/')
if (file?.endsWith('/db/__tests__/external-resource-read.postgres.test.ts'))
  await import('./native-test-database-isolation')
