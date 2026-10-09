import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'

export function createHealthServer() {
  return createServer((request, response) => {
    if (request.method !== 'GET') {
      response.writeHead(405, { allow: 'GET' })
      response.end()
      return
    }

    const path = request.url?.split('?', 1)[0]
    if (path !== '/health/readiness' && path !== '/health/liveness') {
      response.writeHead(404)
      response.end()
      return
    }

    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
    })
    response.end(JSON.stringify({ status: 'ok' }))
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3000)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535')
  }

  const server = createHealthServer()
  server.on('error', error => {
    console.error('Synthetic health server failed to start', error)
    process.exitCode = 1
    server.close()
  })
  server.listen(port, '0.0.0.0', () => {
    console.log(`Synthetic health server listening on port ${port}`)
  })
}
