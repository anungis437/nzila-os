import { vi } from 'vitest'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  const path = await import('node:path')
  const { restoreW4PInputs } = await import('./w4p-historical-inputs')
  const replacements = await restoreW4PInputs((file) => actual.readFileSync(file, 'utf8'))
  return {
    ...actual,
    readFileSync(
      file: import('node:fs').PathOrFileDescriptor,
      options?: Parameters<typeof actual.readFileSync>[1],
    ) {
      const bytes = typeof file === 'string' ? replacements.get(path.resolve(file)) : undefined
      if (bytes !== undefined) {
        const encoding = typeof options === 'string' ? options : options?.encoding
        return encoding ? bytes : Buffer.from(bytes)
      }
      return actual.readFileSync(file, options)
    },
  }
})
