import * as log from 'https://deno.land/std@0.79.0/log/mod.ts'
import { assert } from 'https://deno.land/std@0.79.0/_util/assert.ts'
import {
  getAllowedLibraries,
  loadLibraryMovies,
  mapRatingToAge,
} from './api/plex.ts'
import { MOVIE_BATCH_SIZE } from './config.ts'
import { WebSocket } from './util/websocketServer.ts'

interface Response {
  guid: string
  wantsToWatch: boolean
}

interface User {
  // Unique within a room. Equals `name`, or `name#NN` when the display name is
  // already taken — the suffix is internal and never shown in the GUI.
  id: string
  name: string
  responses: Response[]
}

// Picks a random unused two-digit suffix so multiple people can share a name.
const makeUserId = (name: string, sameNameUsers: User[]): string => {
  if (sameNameUsers.length === 0) return name

  const used = new Set(
    sameNameUsers.map(u => u.id.split('#')[1]).filter(Boolean)
  )
  for (let attempt = 0; attempt < 200; attempt++) {
    const suffix = String(10 + Math.floor(Math.random() * 90))
    if (!used.has(suffix)) return `${name}#${suffix}`
  }
  return `${name}#${Date.now() % 100}`
}

interface MediaItem {
  guid: string
  title: string
  summary: string
  year: string
  art: string
  director?: string
  rating: string
  key: string
  type: 'movie' | 'artist' | 'photo' | 'show'
}

interface Filters {
  libraries: string[]
  minAge: number | null
  maxAge: number | null
  includeUnrated: boolean
}

interface WebSocketLoginMessage {
  type: 'login'
  payload: {
    name: string
    roomCode: string
    mode?: 'create' | 'join'
    filters?: Filters
  }
}

interface WebSocketMatchMessage {
  type: 'match'
  payload: {
    movie: MediaItem
    users: string[]
  }
}

// Server -> client: the display names currently connected to the room.
interface WebSocketOccupancyMessage {
  type: 'occupancy'
  payload: {
    names: string[]
  }
}

interface WebSocketLoginResponseMessage {
  type: 'loginResponse'
  payload:
    | { success: false; reason?: string }
    | {
        success: true
        matches: Array<WebSocketMatchMessage['payload']>
        movies: MediaItem[]
      }
}

interface WebSocketResponseMessage {
  type: 'response'
  payload: Response
}

interface WebSocketNextBatchMessage {
  type: 'nextBatch'
}

type WebSocketMessage =
  | WebSocketLoginMessage
  | WebSocketResponseMessage
  | WebSocketNextBatchMessage

class Session {
  users: Map<User, WebSocket | null> = new Map()
  roomCode: string
  filters: Filters | null = null
  moviePool: MediaItem[] = []
  poolIndex = 0
  createdAt = Date.now()
  movieList: MediaItem[] = []
  likedMovies: Map<MediaItem, User[]> = new Map()

  hasLiveConnection() {
    return [...this.users.values()].some(ws => ws && !ws.isClosed)
  }

  constructor(roomCode: string) {
    this.roomCode = roomCode
  }

  // Builds the room's filtered, shuffled deck from the chosen libraries.
  // Library choices are re-validated against the server-side allow-list.
  async buildPool(filters: Filters) {
    const allowed = await getAllowedLibraries()
    const libraries = filters.libraries.filter(lib => allowed.includes(lib))
    this.filters = { ...filters, libraries }

    const lists = await Promise.all(
      libraries.map(title => loadLibraryMovies(title))
    )

    const seen = new Set<string>()
    const pool: MediaItem[] = []

    for (const plexMovie of lists.flat()) {
      if (seen.has(plexMovie.guid)) continue

      const age = mapRatingToAge(plexMovie.contentRating)
      const noAgeLimit = filters.minAge === null && filters.maxAge === null
      // No limits set → everything passes (unrated included). Otherwise apply
      // the floor/ceiling, and let unrated titles through only when opted in.
      const withinRating = noAgeLimit
        ? true
        : age === null
        ? filters.includeUnrated
        : (filters.minAge === null || age >= filters.minAge) &&
          (filters.maxAge === null || age <= filters.maxAge)

      if (!withinRating) continue

      seen.add(plexMovie.guid)
      pool.push({
        title: plexMovie.title,
        art: `/poster/${plexMovie.thumb.replace('/library/metadata/', '')}`,
        guid: plexMovie.guid,
        key: plexMovie.key,
        summary: plexMovie.summary,
        year: plexMovie.year,
        director: (plexMovie.Director ?? [{ tag: undefined }])[0].tag,
        rating: plexMovie.rating,
        type: plexMovie.type,
      })
    }

    // Fisher-Yates shuffle so every room gets its own order
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }

    this.moviePool = pool
    this.poolIndex = 0
    log.info(
      `Room ${this.roomCode}: ${pool.length} movies from [${libraries.join(
        ', '
      )}], minAge ${filters.minAge ?? 'none'}, maxAge ${
        filters.maxAge ?? 'none'
      }, unrated ${filters.includeUnrated ? 'included' : 'excluded'}`
    )
  }

  add = (user: User, ws: WebSocket) => {
    this.users.set(user, ws)

    ws.addListener('message', msg => this.handleMessage(user, msg))
    ws.addListener('close', () => this.remove(user, ws))

    this.broadcastOccupancy()
  }

  remove = (user: User, ws: WebSocket) => {
    log.debug(`User ${user?.name} was removed`)
    ws.removeAllListeners()
    this.users.set(user, null)

    if (!this.hasLiveConnection()) {
      this.destroy()
    } else {
      this.broadcastOccupancy()
    }
  }

  // Display names of everyone currently connected (excludes the hidden #NN id).
  occupantNames() {
    return [...this.users.entries()]
      .filter(([, ws]) => ws && !ws.isClosed)
      .map(([user]) => user.name)
  }

  broadcastOccupancy() {
    const message: WebSocketOccupancyMessage = {
      type: 'occupancy',
      payload: { names: this.occupantNames() },
    }
    const json = JSON.stringify(message)
    for (const ws of this.users.values()) {
      if (ws && !ws.isClosed) {
        ws.send(json)
      }
    }
  }

  handleMessage = async (user: User, msg: string) => {
    try {
      const decodedMessage: WebSocketMessage = JSON.parse(msg)
      switch (decodedMessage.type) {
        case 'nextBatch': {
          log.debug(`${user.name} asked for the next batch of movies`)
          await this.sendNextBatch()
          break
        }
        case 'response': {
          const { guid, wantsToWatch } = decodedMessage.payload
          assert(
            typeof guid === 'string' && typeof wantsToWatch === 'boolean',
            'Response message was empty'
          )
          const alreadyResponded = !!user.responses.find(
            _ => _.guid === decodedMessage.payload.guid
          )
          if (alreadyResponded) {
            log.warning(
              `User ${user.name} tried to respond to ${decodedMessage.payload.guid} twice!`
            )
            return
          } else {
            log.debug(
              `${user.name} ${
                wantsToWatch ? 'wants to watch' : 'does not want to watch'
              } ${decodedMessage.payload.guid}`
            )
          }
          user.responses.push(decodedMessage.payload)
          if (wantsToWatch) {
            const movie = this.movieList.find(_ => _.guid === guid)
            if (!movie) {
              log.error(
                `${user.name} tried to rate a movie that doesn't exist: ${guid}`
              )
              break
            }
            if (this.likedMovies.has(movie)) {
              const users = this.likedMovies.get(movie)!
              this.likedMovies.set(movie, [...users, user])
              this.handleMatch(movie, [...users, user])
            } else {
              this.likedMovies.set(movie, [user])
            }
          }
          break
        }
      }
    } catch (err) {
      log.error(err, JSON.stringify(msg))
    }
  }

  sendNextBatch() {
    const batch = this.moviePool.slice(
      this.poolIndex,
      this.poolIndex + Number(MOVIE_BATCH_SIZE)
    )
    this.poolIndex += batch.length
    this.movieList.push(...batch)

    // An empty batch signals the client that the deck is exhausted.
    for (const [user, ws] of this.users.entries()) {
      if (ws && !ws.isClosed) {
        const respondedGuids = new Set(user.responses.map(r => r.guid))
        ws.send(
          JSON.stringify({
            type: 'batch',
            payload: batch.filter(movie => !respondedGuids.has(movie.guid)),
          })
        )
      }
    }
  }

  handleMatch(movie: MediaItem, users: User[]) {
    for (const ws of this.users.values()) {
      const match: WebSocketMatchMessage = {
        type: 'match',
        payload: {
          movie,
          users: users.map(_ => _.name),
        },
      }

      if (ws && !ws.isClosed) {
        ws.send(JSON.stringify(match))
      }
    }
  }

  getExistingMatches(user: User) {
    return [...this.likedMovies.entries()]
      .filter(([, users]) => users.includes(user) && users.length > 1)
      .map(([movie, users]) => ({ movie, users: users.map(_ => _.name) }))
  }

  destroy() {
    log.info(`Session ${this.roomCode} has no users and has been removed.`)
    activeSessions.delete(this.roomCode)
  }
}

const activeSessions: Map<string, Session> = new Map()

// Safety net: sweep rooms with no live connections every few minutes, in case
// a WebSocket dropped without firing 'close'. A grace period keeps a room that
// is still being created (no users added yet) from being swept prematurely.
const ROOM_SWEEP_INTERVAL_MS = 5 * 60 * 1000

setInterval(() => {
  for (const [roomCode, session] of activeSessions.entries()) {
    const age = Date.now() - session.createdAt
    if (age > ROOM_SWEEP_INTERVAL_MS && !session.hasLiveConnection()) {
      log.info(`Sweeping idle room ${roomCode} — no live connections`)
      activeSessions.delete(roomCode)
    }
  }
}, ROOM_SWEEP_INTERVAL_MS)

export const getSession = (roomCode: string, ws: WebSocket): Session => {
  if (activeSessions.has(roomCode)) {
    return activeSessions.get(roomCode)!
  }

  const session = new Session(roomCode)

  activeSessions.set(roomCode, session)

  log.debug(
    `New session created. Active session ids are: ${[
      ...activeSessions.keys(),
    ].join(', ')}`
  )

  return session
}

export const handleLogin = (ws: WebSocket): Promise<User> => {
  return new Promise(resolve => {
    const fail = (reason: string) => {
      const response: WebSocketLoginResponseMessage = {
        type: 'loginResponse',
        payload: { success: false, reason },
      }
      ws.send(JSON.stringify(response))
    }

    const handler = async (msg: string) => {
      const data: WebSocketMessage = JSON.parse(msg)
      if (data.type !== 'login') return

      const { name, roomCode, mode = 'join', filters } = data.payload
      log.info(`Got a ${mode} login: ${name} / ${roomCode}`)

      const existing = activeSessions.get(roomCode)

      // Join only works on an already-created room
      if (mode === 'join' && (!existing || !existing.filters)) {
        return fail('not-found')
      }

      // Create only works on a fresh room code
      if (mode === 'create' && existing && existing.filters) {
        return fail('exists')
      }

      const session = getSession(roomCode, ws)

      // Multiple people may share a display name. Reconnect to a disconnected
      // user of the same name if there is one; otherwise create a new user with
      // a unique (hidden) id so two live "Rion"s can coexist.
      const sameNameUsers = [...session.users.keys()].filter(
        ({ name: userName }) => userName === name
      )
      const reconnectable = sameNameUsers.find(u => {
        const userWs = session.users.get(u)
        return !userWs || userWs.isClosed
      })

      // The room creator builds the filtered deck
      if (mode === 'create') {
        try {
          await session.buildPool(
            filters ?? {
              libraries: [],
              minAge: null,
              maxAge: null,
              includeUnrated: false,
            }
          )
        } catch (err) {
          log.error(err)
          return fail('error')
        }
      }

      const user: User = reconnectable ?? {
        id: makeUserId(name, sameNameUsers),
        name,
        responses: [],
      }

      log.debug(
        `${reconnectable ? 'Reconnecting' : 'New'} user ${user.id} ${
          mode === 'create' ? 'created' : 'joined'
        } room ${roomCode}`
      )

      ws.removeListener('message', handler)
      session.add(user, ws)

      // Only send already-dealt movies this user hasn't responded to yet
      const respondedGuids = new Set(user.responses.map(r => r.guid))
      const response: WebSocketLoginResponseMessage = {
        type: 'loginResponse',
        payload: {
          success: true,
          matches: session.getExistingMatches(user),
          movies: session.movieList.filter(
            movie => !respondedGuids.has(movie.guid)
          ),
        },
      }
      ws.send(JSON.stringify(response))

      return resolve(user)
    }
    ws.addListener('message', handler)
  })
}
