// Minimal HTTP facade over clamd's INSTREAM protocol, matching the contract of
// apps/union-eyes/lib/security/clamav.ts: POST /scan (raw body) -> JSON { status, signature? }.
import http from 'node:http'
import net from 'node:net'

const CLAMD_HOST = process.env.CLAMD_HOST ?? '127.0.0.1'
const CLAMD_PORT = Number(process.env.CLAMD_PORT ?? 3310)
const MAX_BYTES = Number(process.env.MAX_SCAN_BYTES ?? 26214400)
const CHUNK = 64 * 1024

function clamd(command, body) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: CLAMD_HOST, port: CLAMD_PORT })
    const chunks = []
    socket.setTimeout(60000, () => socket.destroy(new Error('clamd_timeout')))
    socket.on('error', reject)
    socket.on('data', (data) => chunks.push(data))
    socket.on('close', () => resolve(Buffer.concat(chunks).toString('utf8').replace(/\0/g, '').trim()))
    socket.on('connect', () => {
      socket.write(command)
      if (body) {
        for (let offset = 0; offset < body.length; offset += CHUNK) {
          const part = body.subarray(offset, offset + CHUNK)
          const header = Buffer.alloc(4)
          header.writeUInt32BE(part.length)
          socket.write(header)
          socket.write(part)
        }
        socket.write(Buffer.alloc(4))
      }
    })
  })
}

function send(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(payload))
}

http
  .createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        const pong = await clamd('zPING\0')
        return send(res, pong === 'PONG' ? 200 : 503, { status: pong === 'PONG' ? 'ok' : 'unavailable' })
      }
      if (req.method !== 'POST' || req.url !== '/scan') return send(res, 404, { status: 'unavailable', reason: 'not_found' })
      const parts = []
      let size = 0
      for await (const part of req) {
        size += part.length
        if (size > MAX_BYTES) return send(res, 413, { status: 'unavailable', reason: 'payload_too_large' })
        parts.push(part)
      }
      const reply = await clamd('zINSTREAM\0', Buffer.concat(parts))
      if (/ OK$/.test(reply)) return send(res, 200, { status: 'clean' })
      const found = /: (.+) FOUND$/.exec(reply)
      if (found) return send(res, 200, { status: 'infected', signature: found[1] })
      return send(res, 200, { status: 'unavailable', reason: 'unrecognized_clamd_reply' })
    } catch (error) {
      return send(res, 200, { status: 'unavailable', reason: error instanceof Error ? error.message : 'scanner_error' })
    }
  })
  .listen(Number(process.env.PORT ?? 8080), '0.0.0.0')
