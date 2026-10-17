function databaseEndpoint(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('FINANCIAL_DATABASE_CONFIGURATION_INVALID')
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.username || !url.pathname.slice(1))
    throw new Error('FINANCIAL_DATABASE_CONFIGURATION_INVALID')
  const host = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    ? 'loopback'
    : url.hostname.toLowerCase()
  return {
    endpoint: `${host}:${url.port || '5432'}:${decodeURIComponent(url.pathname.slice(1))}`,
    role: decodeURIComponent(url.username),
  }
}

/** Financial callers never silently inherit an operational or authentication connection. */
export function financialConnectionString(env: NodeJS.ProcessEnv): string {
  const value = env.FINANCIAL_DATABASE_URL
  if (!value) throw new Error('FINANCIAL_DATABASE_URL_REQUIRED')
  const selected = databaseEndpoint(value)
  for (const key of [
    'DATABASE_URL',
    'SYSTEM_DATABASE_URL',
    'AUTH_DATABASE_URL',
    'AUTH_SYSTEM_DATABASE_URL',
  ]) {
    const operational = env[key]
    if (!operational) continue
    const other = databaseEndpoint(operational)
    if (selected.endpoint === other.endpoint)
      throw new Error('FINANCIAL_DATABASE_SCOPE_COLLAPSE')
    if (selected.role === other.role)
      throw new Error('FINANCIAL_DATABASE_ROLE_REUSE')
  }
  if (selected.role === 'postgres') throw new Error('FINANCIAL_DATABASE_OWNER_ROLE_FORBIDDEN')
  return value
}
