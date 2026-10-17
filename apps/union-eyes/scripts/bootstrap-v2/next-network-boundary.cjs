'use strict'

/* eslint-disable @typescript-eslint/no-require-imports -- Node's preload executes before ESM initialization. */
// Applied to the acceptance child process and every inherited Node worker.
// Configuration sanitization alone cannot contain hard-coded SDK endpoints.
const net = require('node:net')
const dns = require('node:dns')
const dgram = require('node:dgram')
const { createHash } = require('node:crypto')
const { readFileSync } = require('node:fs')
const { syncBuiltinESMExports } = require('node:module')
const ports = new Set(
  (process.env.UE_V2_LOCAL_PORTS || '')
    .split(',')
    .map(Number)
    .filter((port) => Number.isInteger(port) && port > 0 && port <= 65535),
)
const hosts = new Set(['127.0.0.1', '::1', 'localhost'])
// Fixed synthetic DNS preserves Key Vault's challenge-domain and TLS-hostname checks.
const vaultAlias = 'vault.ue-v2.localhost'
if (process.env.UE_V2_LOCAL_VAULT_ALIAS === '1') hosts.add(vaultAlias)
if (process.env.UE_V2_NETWORK_AUDIT === '1')
  process.stderr.write(
    `UE_V2_BOUNDARY_LOADED:${JSON.stringify({
      pid: process.pid,
      sourceDigest: createHash('sha256').update(readFileSync(__filename)).digest('hex'),
      ownedPorts: [...ports],
    })}\n`,
  )
const observe = (transport, host, port, allowed) => {
  if (process.env.UE_V2_NETWORK_AUDIT !== '1') return
  process.stderr.write(
    `UE_V2_NETWORK_AUDIT:${JSON.stringify({
      pid: process.pid,
      transport,
      targetDigest: createHash('sha256').update(String(host)).digest('hex'),
      targetClass: hosts.has(host) ? 'LOOPBACK' : 'NON_LOOPBACK',
      port: port !== null && Number.isInteger(Number(port)) ? Number(port) : null,
      allowed,
    })}\n`,
  )
}
const denied = () => {
  const error = new Error('UE_V2_EXTERNAL_NETWORK_DENIED')
  error.code = 'UE_V2_EXTERNAL_NETWORK_DENIED'
  throw error
}
const connect = net.Socket.prototype.connect
net.Socket.prototype.connect = function (...args) {
  // Node's own net.connect forwards its normalized [options, callback] tuple.
  const normalized = Array.isArray(args[0]) ? args[0] : args
  const first = normalized[0]
  if (typeof first === 'object' && first !== null) {
    if (first.path) {
      observe('PIPE', first.path, null, false)
      denied()
    } else if (!hosts.has(first.host || 'localhost') || !ports.has(Number(first.port))) {
      observe('TCP', first.host || 'localhost', first.port, false)
      denied()
    } else {
      observe('TCP', first.host || 'localhost', first.port, true)
    }
  } else if (
    !ports.has(Number(first)) ||
    (typeof normalized[1] === 'string' && !hosts.has(normalized[1]))
  ) {
    observe('TCP', normalized[1] || 'localhost', first, false)
    denied()
  } else {
    observe('TCP', typeof normalized[1] === 'string' ? normalized[1] : 'localhost', first, true)
  }
  return connect.apply(this, args)
}
const lookup = dns.lookup
dns.lookup = function (hostname, ...args) {
  observe('DNS_LOOKUP', hostname, null, hosts.has(hostname))
  if (!hosts.has(hostname)) denied()
  if (hostname === vaultAlias) {
    const callback = args.at(-1)
    const options = typeof args[0] === 'object' ? args[0] : {}
    process.nextTick(() =>
      options.all
        ? callback(null, [{ address: '127.0.0.1', family: 4 }])
        : callback(null, '127.0.0.1', 4),
    )
    return
  }
  return lookup.call(this, hostname, ...args)
}
const lookupPromise = dns.promises.lookup
dns.promises.lookup = function (hostname, ...args) {
  observe('DNS_LOOKUP', hostname, null, hosts.has(hostname))
  if (!hosts.has(hostname)) denied()
  if (hostname === vaultAlias)
    return Promise.resolve(
      args[0]?.all ? [{ address: '127.0.0.1', family: 4 }] : { address: '127.0.0.1', family: 4 },
    )
  return lookupPromise.call(this, hostname, ...args)
}
// Owned fixtures use literal loopback addresses, never an external DNS authority.
for (const target of [dns, dns.promises, dns.Resolver.prototype, dns.promises.Resolver.prototype]) {
  for (const key of Object.getOwnPropertyNames(target)) {
    if (/^(resolve|reverse|lookupService)/.test(key) && typeof target[key] === 'function')
      target[key] = function (...args) {
        observe('DNS_RESOLVE', args[0], null, false)
        denied()
      }
  }
}
dgram.Socket.prototype.send = function () {
  observe('UDP', 'UNSPECIFIED', null, false)
  denied()
}
syncBuiltinESMExports()
