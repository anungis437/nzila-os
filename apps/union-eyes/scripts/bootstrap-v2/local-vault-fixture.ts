import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  constants,
  generateKeyPairSync,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
} from 'node:crypto'
import { writeFileSync, rmSync } from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import type { Server } from 'node:net'
import path from 'node:path'

const certificateProgram = `
import datetime, ipaddress, json
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "UE V2 owned synthetic vault")])
now = datetime.datetime.now(datetime.timezone.utc)
cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name)
    .public_key(key.public_key()).serial_number(x509.random_serial_number())
    .not_valid_before(now - datetime.timedelta(minutes=1))
    .not_valid_after(now + datetime.timedelta(hours=1))
    .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
    .add_extension(x509.SubjectAlternativeName([
        x509.DNSName("vault.ue-v2.localhost"),
        x509.IPAddress(ipaddress.ip_address("127.0.0.1"))]), critical=False)
    .sign(key, hashes.SHA256()))
print(json.dumps({"cert": cert.public_bytes(serialization.Encoding.PEM).decode(),
    "key": key.private_bytes(serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode()}))
`

async function listen(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  return address.port
}

async function close(server: http.Server | https.Server) {
  server.closeAllConnections()
  if (server.listening)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  assert.equal(server.listening, false)
}

/** Owned wire-protocol fixture, not an SDK/encryption replacement or production custody proof. */
export async function openLocalVaultFixture(statePath: string) {
  const certificate = JSON.parse(
    execFileSync('python', ['-I', '-c', certificateProgram], {
      encoding: 'utf8',
      timeout: 30000,
      maxBuffer: 16384,
    }),
  ) as { cert: string; key: string }
  const certificatePath = path.join(statePath, 'owned-vault-public-ca.pem')
  writeFileSync(certificatePath, certificate.cert)
  const identityHeader = randomBytes(32).toString('hex')
  const bearer = randomBytes(48).toString('base64url')
  const keys = [generateKeyPairSync('rsa', { modulusLength: 2048 })]
  const observations = {
    identityAccepted: 0,
    identityDenied: 0,
    challenges: 0,
    keysAccepted: 0,
    keysDenied: 0,
    wrapsAccepted: 0,
    unwrapsAccepted: 0,
    rotationsAccepted: 0,
  }
  let identityPort = 0
  let vaultPort = 0
  let revoked = false
  const identity = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    const accepted =
      !revoked &&
      request.method === 'GET' &&
      url.pathname === '/metadata/identity/oauth2/token' &&
      url.searchParams.get('resource') === 'https://ue-v2.localhost' &&
      url.searchParams.get('api-version') === '2019-08-01' &&
      request.headers['x-identity-header'] === identityHeader
    observations[accepted ? 'identityAccepted' : 'identityDenied']++
    response.writeHead(accepted ? 200 : 403, { 'Content-Type': 'application/json' })
    response.end(
      JSON.stringify(
        accepted
          ? {
              access_token: bearer,
              expires_on: String(Math.floor(Date.now() / 1000) + 3600),
              resource: 'https://ue-v2.localhost',
              token_type: 'Bearer',
            }
          : { error: 'Unauthorized synthetic identity' },
      ),
    )
  })
  const vault = https.createServer(certificate, async (request, response) => {
    const url = new URL(request.url ?? '/', 'https://vault.ue-v2.localhost')
    response.setHeader('Content-Type', 'application/json')
    if (!request.headers.authorization) {
      observations.challenges++
      response.writeHead(401, {
        'WWW-Authenticate': `Bearer authorization="https://127.0.0.1:${identityPort}/00000000-0000-0000-0000-000000000001", resource="https://ue-v2.localhost"`,
      })
      response.end(
        JSON.stringify({ error: { code: 'Unauthorized', message: 'Bearer token required' } }),
      )
      return
    }
    const authenticated =
      !revoked &&
      request.headers.authorization === `Bearer ${bearer}` &&
      url.searchParams.has('api-version')
    const match = url.pathname.match(
      /^\/keys\/pii-encryption-key\/(?:owned-synthetic-v(\d+)(?:\/(wrapkey|unwrapkey))?|create)?\/?$/,
    )
    const operation = match?.[2]
    const rotating = request.method === 'POST' && url.pathname.endsWith('/create')
    const accepted =
      authenticated &&
      Boolean(match) &&
      (request.method === 'GET' || (request.method === 'POST' && (operation || rotating)))
    observations[accepted ? 'keysAccepted' : 'keysDenied']++
    if (!accepted) {
      response.writeHead(403)
      response.end(
        JSON.stringify({
          error: { code: 'Forbidden', message: 'Synthetic vault authority denied' },
        }),
      )
      return
    }
    try {
      let version = match?.[1] ? Number(match[1]) : keys.length
      let payload: { alg?: string; value?: string; kty?: string } = {}
      if (request.method === 'POST') {
        let body = ''
        for await (const part of request) body += part.toString()
        payload = JSON.parse(body)
      }
      if (rotating) {
        assert.equal(payload.kty, 'RSA')
        keys.push(generateKeyPairSync('rsa', { modulusLength: 2048 }))
        version = keys.length
        observations.rotationsAccepted++
      }
      const key = keys[version - 1]
      assert.ok(key, 'Unknown synthetic vault key version')
      const kid = `https://vault.ue-v2.localhost:${vaultPort}/keys/pii-encryption-key/owned-synthetic-v${version}`
      if (operation) {
        assert.equal(payload.alg, 'RSA-OAEP-256')
        assert.equal(typeof payload.value, 'string')
        const value = Buffer.from(payload.value!, 'base64url')
        const options = { padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }
        const result =
          operation === 'wrapkey'
            ? publicEncrypt({ ...options, key: key.publicKey }, value)
            : privateDecrypt({ ...options, key: key.privateKey }, value)
        observations[operation === 'wrapkey' ? 'wrapsAccepted' : 'unwrapsAccepted']++
        response.writeHead(200)
        response.end(JSON.stringify({ kid, value: result.toString('base64url') }))
        return
      }
      const jwk = key.publicKey.export({ format: 'jwk' })
      response.writeHead(200)
      response.end(
        JSON.stringify({
          key: {
            kid,
            kty: 'RSA',
            n: jwk.n,
            e: jwk.e,
            key_ops: ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey'],
          },
          attributes: { enabled: true, created: Math.floor(Date.now() / 1000) },
        }),
      )
    } catch {
      response.writeHead(400)
      response.end(
        JSON.stringify({
          error: { code: 'BadParameter', message: 'Invalid synthetic vault operation' },
        }),
      )
    }
  })
  try {
    identityPort = await listen(identity)
    vaultPort = await listen(vault)
  } catch (error) {
    await close(identity)
    await close(vault)
    rmSync(certificatePath, { force: true })
    throw error
  }
  return {
    observations,
    secrets: [identityHeader, bearer, certificate.key],
    environment: {
      AZURE_KEY_VAULT_URL: `https://vault.ue-v2.localhost:${vaultPort}`,
      IDENTITY_ENDPOINT: `http://127.0.0.1:${identityPort}/metadata/identity/oauth2/token`,
      IDENTITY_HEADER: identityHeader,
      NODE_EXTRA_CA_CERTS: certificatePath,
      UE_V2_LOCAL_VAULT_ALIAS: '1',
    },
    ports: [identityPort, vaultPort],
    revoke() {
      revoked = true
    },
    async dispose() {
      await close(identity)
      await close(vault)
      rmSync(certificatePath, { force: true })
      return { ownedIdentityExited: !identity.listening, ownedVaultExited: !vault.listening }
    },
  }
}
