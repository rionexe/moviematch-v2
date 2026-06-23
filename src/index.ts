import { serve } from 'https://deno.land/std@0.79.0/http/server.ts'
import * as log from 'https://deno.land/std@0.79.0/log/mod.ts'
import { getServerId, proxyPoster, getAllowedLibraries } from './api/plex.ts'
import { PLEX_URL, PORT, LINK_TYPE } from './config.ts'
import { handleLogin } from './session.ts'
import { serveFile } from './util/staticFileServer.ts'
import { WebSocketServer } from './util/websocketServer.ts'

const server = serve({ port: Number(PORT) })

const wss = new WebSocketServer({
  onConnection: handleLogin,
  onError: err => log.error(err),
})

if (Deno.build.os !== 'windows') {
  Deno.signal(Deno.Signal.SIGINT).then(() => {
    log.info('Shutting down')
    server.close()
    Deno.exit(0)
  })
}

log.info(`Listening on port ${PORT}`)

for await (const req of server) {
  try {
    if (req.url === '/ws') {
      wss.connect(req)
    } else if (req.url.startsWith('/movie/')) {
      const serverId = await getServerId()
      const [rawKey] = req.url.replace('/movie', '').split('?')
      // A show's key arrives as .../children (its season listing); the details
      // deep-link resolves from the base metadata key, so drop that suffix.
      const key = rawKey.replace(/\/children\/?$/, '')

      // This route is the *web* fallback (and the no-JavaScript target). The
      // client attempts the native plex:// app first and only follows this when
      // the app doesn't take over. LINK_TYPE=local forces the on-network URL.
      const location =
        LINK_TYPE === 'local'
          ? `${PLEX_URL}/web/index.html#!/server/${serverId}/details?key=${encodeURIComponent(
              key
            )}`
          : `https://app.plex.tv/desktop/#!/server/${serverId}/details?key=${encodeURIComponent(
              key
            )}`

      await req.respond({
        status: 302,
        headers: new Headers({
          Location: location,
        }),
      })
    } else if (req.url.startsWith('/poster/')) {
      const [, key] =
        req.url.match(/\/poster\/([0-9]+\/(art|thumb)\/[0-9]+)/) ?? []

      if (!key) {
        await req.respond({ status: 404 })
      } else {
        await proxyPoster(req, key)
      }
    } else if (req.url.replace(/\?.*$/, '').endsWith('/api/libraries')) {
      // Allow-listed libraries for the Create Room picker to populate
      try {
        const libraries = await getAllowedLibraries()
        await req.respond({
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          body: JSON.stringify({ libraries }),
        })
      } catch (err) {
        log.error(`Failed to load libraries: ${err.message}`)
        await req.respond({
          status: 500,
          headers: new Headers({ 'content-type': 'application/json' }),
          body: JSON.stringify({ libraries: [] }),
        })
      }
    } else if (req.url.replace(/\?.*$/, '').endsWith('/api/server')) {
      // The Plex machine identifier, so the client can build native plex://
      // deep links (it's already exposed in the /movie redirect, not a secret).
      try {
        const serverId = await getServerId()
        await req.respond({
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          body: JSON.stringify({ serverId }),
        })
      } catch (err) {
        log.error(`Failed to load server id: ${err.message}`)
        await req.respond({
          status: 500,
          headers: new Headers({ 'content-type': 'application/json' }),
          body: JSON.stringify({ serverId: null }),
        })
      }
    } else {
      serveFile(req, '/public')
    }
  } catch (err) {
    log.error(`Error handling request: ${err.message}`)
  }
}
