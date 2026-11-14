import { createServer, type Server } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, sep } from 'node:path'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2'
}

/**
 * Serves the built renderer over loopback HTTP so the UI has a real http
 * origin (module scripts, CSP 'self' and localStorage all behave as on the
 * dev server). A fixed port keeps that origin stable across runs.
 */
export function serveRenderer(root: string, preferredPort = 38917): Promise<string> {
  const server: Server = createServer((req, res) => {
    const pathname = decodeURIComponent((req.url ?? '/').split('?')[0])
    let file = normalize(join(root, pathname))
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403).end()
      return
    }
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html')
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache'
    })
    createReadStream(file).pipe(res)
  })

  return new Promise((resolve, reject) => {
    const listen = (port: number): void => {
      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && port !== 0) listen(0)
        else reject(err)
      })
      server.listen(port, '127.0.0.1', () => {
        const addr = server.address()
        resolve(`http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : port}`)
      })
    }
    listen(preferredPort)
  })
}
