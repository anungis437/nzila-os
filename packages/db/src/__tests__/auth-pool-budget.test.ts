import { afterEach, expect, it, vi } from 'vitest'

async function fixture() {
  vi.resetModules()
  vi.stubEnv('AUTH_DATABASE_URL', 'postgres://auth-gateway@example.invalid/auth')
  vi.stubEnv('AUTH_SYSTEM_DATABASE_URL', 'postgres://auth-system-gateway@example.invalid/auth')
  const clients: Array<{ end: ReturnType<typeof vi.fn> }> = []
  const postgres = vi.fn(() => {
    const client = { end: vi.fn(async () => {}) }
    clients.push(client)
    return client
  })
  const principal = { gateway: true, other_gateway: false, rolsuper: false, rolbypassrls: false, rolcreatedb: false, rolcreaterole: false, rolinherit: false, rolcanlogin: true, owns_auth: false }
  const tx = { execute: vi.fn(async () => [principal]) }
  vi.doMock('postgres', () => ({ default: postgres }))
  vi.doMock('drizzle-orm/postgres-js', () => ({ drizzle: () => ({ transaction: async (callback: (value: typeof tx) => unknown) => callback(tx) }) }))
  const module = await import('../auth-client')
  return { module, postgres, clients }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
  vi.doUnmock('postgres')
  vi.doUnmock('drizzle-orm/postgres-js')
})

it('uses independently bounded dedicated gateway pools and closes both without changing identity authority', async () => {
  vi.stubEnv('AUTH_DB_POOL_MAX', '1')
  vi.stubEnv('AUTH_SYSTEM_DB_POOL_MAX', '2')
  const { module, postgres, clients } = await fixture()
  const result = await Promise.all([
    ...Array.from({ length: 12 }, () => module.executeAuthContext({ phase: 'identity', userId: 'owned-user' }, async () => 'identity')),
    module.executeAuthContext({ phase: 'cleanup', actorUserId: 'owned-operator', reason: 'bounded test' }, async () => 'cleanup'),
  ])
  expect(result).toHaveLength(13)
  expect(postgres).toHaveBeenCalledTimes(2)
  expect(postgres).toHaveBeenCalledWith('postgres://auth-gateway@example.invalid/auth', { max: 1, idle_timeout: 30, prepare: false })
  expect(postgres).toHaveBeenCalledWith('postgres://auth-system-gateway@example.invalid/auth', { max: 2, idle_timeout: 30, prepare: false })
  await module.closeAuthClients()
  expect(clients.every(client => client.end.mock.calls.length === 1)).toBe(true)
})

it('preserves the existing five-connection default for deployments without a pool override', async () => {
  vi.stubEnv('AUTH_DB_POOL_MAX', undefined)
  const { module, postgres } = await fixture()
  await module.executeAuthContext({ phase: 'identity', userId: 'owned-user' }, async () => undefined)
  expect(postgres).toHaveBeenCalledWith(expect.any(String), { max: 5, idle_timeout: 30, prepare: false })
  await module.closeAuthClients()
})

it.each(['0', '-1', '1.5', 'NaN', '', 'bad'])('refuses invalid cap %j before opening a connection or executing a callback', async value => {
  vi.stubEnv('AUTH_DB_POOL_MAX', value)
  const { module, postgres } = await fixture()
  const callback = vi.fn()
  await expect(module.executeAuthContext({ phase: 'identity', userId: 'owned-user' }, callback)).rejects.toThrow('AUTH_DB_POOL_MAX must be a positive integer')
  expect(postgres).not.toHaveBeenCalled()
  expect(callback).not.toHaveBeenCalled()
})
