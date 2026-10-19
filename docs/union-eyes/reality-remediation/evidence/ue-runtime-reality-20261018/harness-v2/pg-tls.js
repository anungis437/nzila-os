// Verified-TLS PostgreSQL connection factory for the Phase 3A harnesses (supersedes the as-run
// `ssl: { rejectUnauthorized: false }` / NODE_TLS_REJECT_UNAUTHORIZED=0 used on 2026-10-18; see dossier section 13).
//
// Azure Database for PostgreSQL flexible server presents a dual-signed chain anchored at DigiCert Global Root G2
// and Microsoft RSA Root Certificate Authority 2017. DigiCert Global Root G2 is in Node's default trust store; if the
// Microsoft-anchored path is served, set UE_PG_CA_BUNDLE to a PEM file containing the official roots (public CA material:
// https://cacerts.digicert.com/DigiCertGlobalRootG2.crt and
// https://www.microsoft.com/pkiops/certs/Microsoft%20RSA%20Root%20Certificate%20Authority%202017.crt).
// Never trust intermediates or server certificates, and never disable verification.
const fs = require('node:fs');
const tls = require('node:tls');
const { Client } = require('pg');

function verifiedSsl(host) {
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    throw new Error('refusing: NODE_TLS_REJECT_UNAUTHORIZED=0 disables TLS verification');
  }
  if (!host) throw new Error('refusing: host is required for server-name verification');
  const extra = process.env.UE_PG_CA_BUNDLE ? fs.readFileSync(process.env.UE_PG_CA_BUNDLE, 'utf8') : null;
  return { rejectUnauthorized: true, servername: host, ...(extra ? { ca: [...tls.rootCertificates, extra] } : {}) };
}

// Builds a pg Client from discrete fields. The URL's query string (sslmode, etc.) is deliberately ignored so it
// cannot weaken or override the explicit verified-TLS configuration.
function verifiedClient(databaseUrl) {
  const u = new URL(databaseUrl);
  if (!u.hostname) throw new Error('refusing: database URL has no host');
  return new Client({
    host: u.hostname,
    port: u.port ? Number(u.port) : 5432,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.replace(/^\//, '')),
    ssl: verifiedSsl(u.hostname),
  });
}

module.exports = { verifiedSsl, verifiedClient };