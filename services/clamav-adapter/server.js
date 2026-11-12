'use strict';

// Union Eyes — ClamAV HTTP scanning adapter.
//
// Minimal HTTP wrapper (POST /scan, GET /health) around a clamd daemon
// reachable over TCP, speaking clamd's native INSTREAM protocol. No
// third-party dependencies: only Node's built-in http/net modules.

const http = require('node:http');
const net = require('node:net');

const CLAMD_HOST = process.env.CLAMD_HOST || '127.0.0.1';
const CLAMD_PORT = Number(process.env.CLAMD_PORT || 3310);
const HTTP_PORT = Number(process.env.PORT || 8080);
// Matches clamd's own configured per-file limit (see clamd.conf StreamMaxLength / the
// "File size limit set to 104857600 bytes" line clamd logs at startup).
const MAX_BODY_BYTES = Number(process.env.MAX_SCAN_BYTES || 100 * 1024 * 1024);
const CLAMD_CHUNK_BYTES = 1024 * 1024;
const CLAMD_SCAN_TIMEOUT_MS = Number(process.env.CLAMD_SCAN_TIMEOUT_MS || 30000);
const CLAMD_PING_TIMEOUT_MS = Number(process.env.CLAMD_PING_TIMEOUT_MS || 3000);

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function scanBufferWithClamd(buffer) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: CLAMD_HOST, port: CLAMD_PORT });
    const responseChunks = [];
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(new Error('clamd_timeout'));
    }, CLAMD_SCAN_TIMEOUT_MS);

    socket.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });

    socket.on('connect', () => {
      socket.write('zINSTREAM\0');
      let offset = 0;
      while (offset < buffer.length) {
        const end = Math.min(offset + CLAMD_CHUNK_BYTES, buffer.length);
        const chunk = buffer.subarray(offset, end);
        const sizeHeader = Buffer.alloc(4);
        sizeHeader.writeUInt32BE(chunk.length, 0);
        socket.write(sizeHeader);
        socket.write(chunk);
        offset = end;
      }
      const zeroHeader = Buffer.alloc(4);
      zeroHeader.writeUInt32BE(0, 0);
      socket.write(zeroHeader);
    });

    socket.on('data', (data) => {
      responseChunks.push(data);
    });

    socket.on('end', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(Buffer.concat(responseChunks).toString('utf8'));
    });
  });
}

function parseClamdResponse(raw) {
  // clamd terminates its INSTREAM reply with a trailing NUL byte; strip it before matching.
  const text = raw.replace(/\0+$/, '').trim();
  if (/\bOK$/.test(text)) {
    return { status: 'clean' };
  }
  const found = text.match(/^stream:\s*(.+)\s+FOUND$/);
  if (found) {
    return { status: 'infected', signature: found[1] };
  }
  const error = text.match(/^stream:\s*(.+)\s+ERROR$/);
  if (error) {
    return { status: 'unavailable', reason: error[1] };
  }
  return { status: 'unavailable', reason: `unrecognized_clamd_response: ${text}` };
}

function pingClamd() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: CLAMD_HOST, port: CLAMD_PORT });
    let done = false;

    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(false);
    }, CLAMD_PING_TIMEOUT_MS);

    socket.on('error', () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(false);
    });

    socket.on('connect', () => {
      socket.write('zPING\0');
    });

    socket.on('data', (data) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket.end();
      resolve(data.toString('utf8').includes('PONG'));
    });
  });
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const startedAt = Date.now();

  if (req.method === 'GET' && (req.url === '/health' || req.url === '/')) {
    pingClamd().then((healthy) => {
      sendJson(res, healthy ? 200 : 503, { status: healthy ? 'ok' : 'unavailable', clamd: healthy });
      log('GET', req.url, healthy ? 200 : 503, `${Date.now() - startedAt}ms`);
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/scan') {
    const chunks = [];
    let total = 0;
    let aborted = false;

    req.on('data', (chunk) => {
      if (aborted) return;
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        aborted = true;
        sendJson(res, 413, { status: 'unavailable', engine: 'clamav', reason: 'payload_too_large' });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (aborted) return;
      const buffer = Buffer.concat(chunks);
      scanBufferWithClamd(buffer)
        .then((raw) => {
          const parsed = parseClamdResponse(raw);
          sendJson(res, 200, { engine: 'clamav', ...parsed });
          log('POST /scan', parsed.status, `${buffer.length}B`, `${Date.now() - startedAt}ms`);
        })
        .catch((err) => {
          sendJson(res, 200, { status: 'unavailable', engine: 'clamav', reason: `clamd_error: ${err.message}` });
          log('POST /scan', 'error', err.message, `${Date.now() - startedAt}ms`);
        });
    });

    req.on('error', (err) => {
      log('POST /scan request error', err.message);
    });
    return;
  }

  sendJson(res, 404, { error: 'not_found' });
});

server.listen(HTTP_PORT, () => {
  log(`clamav-http-adapter listening on :${HTTP_PORT}, clamd at ${CLAMD_HOST}:${CLAMD_PORT}`);
});

process.on('SIGTERM', () => {
  log('SIGTERM received, closing HTTP server');
  server.close(() => process.exit(0));
});
