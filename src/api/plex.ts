import { ServerRequest } from 'https://deno.land/std@0.79.0/http/server.ts'
import { assert } from 'https://deno.land/std@0.79.0/_util/assert.ts'
import * as log from 'https://deno.land/std@0.79.0/log/mod.ts'
import {
  LIBRARY_FILTER,
  COLLECTION_FILTER,
  PLEX_TOKEN,
  PLEX_URL,
} from '../config.ts'
import {
  PlexDirectory,
  PlexMediaContainer,
  PlexMediaProviders,
  PlexVideo,
} from './plex.types.ts'

assert(typeof PLEX_URL === 'string', 'A PLEX_URL is required')
assert(typeof PLEX_TOKEN === 'string', 'A PLEX_TOKEN is required')
assert(
  !PLEX_TOKEN.startsWith('claim-'),
  'Your PLEX_TOKEN does not look right. Please see: https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/'
)

// thrown when the plex token is invalid
class PlexTokenError extends Error {}

// The library structure is stable for the life of the process, so cache it.
// getAllowedLibraries() and every loadLibraryMovies() call need it, and a room
// build would otherwise re-fetch it from Plex several times. A rejected fetch
// clears the cache so a transient error can be retried on the next call.
let sectionsCache: Promise<PlexMediaContainer<PlexDirectory>> | undefined

export const getSections = (): Promise<PlexMediaContainer<PlexDirectory>> => {
  if (sectionsCache) return sectionsCache

  const promise = (async () => {
    log.debug(`getSections: ${PLEX_URL}/library/sections`)

    const req = await fetch(
      `${PLEX_URL}/library/sections?X-Plex-Token=${PLEX_TOKEN}`,
      { headers: { accept: 'application/json' } }
    )

    if (req.ok) {
      return await req.json()
    } else if (req.status === 401) {
      throw new PlexTokenError(`Authentication error: ${req.url}`)
    } else {
      throw new Error(await req.text())
    }
  })()

  // Drop the cache on failure so a transient error can be retried, but only if
  // a newer call hasn't already replaced it.
  promise.catch(() => {
    if (sectionsCache === promise) sectionsCache = undefined
  })

  sectionsCache = promise
  return promise
}

// LIBRARY_FILTER is a fail-safe allow-list:
//   ''      -> no libraries are exposed (returns no media)
//   'all'   -> every non-hidden movie- or show-type library
//   'A,B,C' -> only those titles (that actually exist)
export const getAllowedLibraries = async (): Promise<string[]> => {
  const sections = await getSections()

  // Movie and TV-show libraries are both swipeable (a show is one card).
  const libraryNames = sections.MediaContainer.Directory.filter(
    ({ hidden, type }) =>
      hidden !== 1 && (type === 'movie' || type === 'show')
  ).map(_ => _.title)

  const filter = LIBRARY_FILTER.trim()

  if (filter === '') {
    log.warning(
      'LIBRARY_FILTER is empty — no libraries are exposed. Set it to "all" or a comma-separated list of library names.'
    )
    return []
  }

  if (filter.toLowerCase() === 'all') {
    return libraryNames
  }

  return filter
    .split(',')
    .map(_ => _.trim())
    .filter(title => libraryNames.includes(title))
}

// Loads (and caches) the movies for a single allowed library by title.
const libraryCache = new Map<string, Promise<PlexVideo['Metadata']>>()

export const loadLibraryMovies = (
  title: string
): Promise<PlexVideo['Metadata']> => {
  const cached = libraryCache.get(title)
  if (cached) return cached

  const promise = (async () => {
    const sections = await getSections()
    const allowed = await getAllowedLibraries()

    assert(allowed.includes(title), `${title} is not an allowed library`)

    const section = sections.MediaContainer.Directory.find(
      ({ title: sectionTitle, hidden }) =>
        hidden !== 1 && sectionTitle === title
    )

    assert(section, `Couldn't find the ${title} library in Plex`)

    const req = await fetch(
      `${PLEX_URL}/library/sections/${section!.key}/all?X-Plex-Token=${PLEX_TOKEN}`,
      { headers: { accept: 'application/json' } }
    )

    if (!req.ok) {
      if (req.status === 401) {
        throw new PlexTokenError(`Authentication error: ${req.url}`)
      }
      throw new Error(`${req.url} returned ${req.status}: ${await req.text()}`)
    }

    const libraryData: PlexMediaContainer<PlexVideo> = await req.json()
    let metadata = libraryData.MediaContainer.Metadata ?? []

    if (COLLECTION_FILTER !== '') {
      const collectionFilter = COLLECTION_FILTER.split(',')
      metadata = metadata.filter(item =>
        item.Collection?.find(collection =>
          collectionFilter.find(
            filter => filter.toLowerCase() === collection.tag.toLowerCase()
          )
        )
      )
    }

    log.debug(`Loaded ${metadata.length} movies from the ${title} library`)
    return metadata
  })()

  libraryCache.set(title, promise)
  return promise
}

// --- Content rating -> age mapping ------------------------------------------
// The contentRating field holds Common Sense ages plus MPAA/TV stragglers.
// Map them all onto one age scale so a single "maximum age" can filter.
const RATING_AGE: Record<string, number> = {
  G: 6,
  PG: 10,
  'PG-13': 13,
  R: 17,
  'NC-17': 18,
  'TV-Y': 2,
  'TV-Y7': 7,
  'TV-G': 6,
  'TV-PG': 10,
  'TV-14': 14,
  'TV-MA': 17,
}

const UNRATED = new Set(['', 'NONE', 'NOT RATED', 'NR', 'UNRATED', 'UR'])

// Returns the age a contentRating maps to, or null when it's unrated/unknown.
export const mapRatingToAge = (contentRating?: string): number | null => {
  if (!contentRating) return null

  let value = contentRating.trim()
  // strip a country prefix ("us/PG-13") and a leading "Rated "
  if (value.includes('/')) value = value.split('/').pop()!.trim()
  value = value.replace(/^rated\s+/i, '').trim()

  if (UNRATED.has(value.toUpperCase())) return null

  // Common Sense numeric age, e.g. "10" or "13+"
  const numeric = value.match(/^(\d{1,2})\s*\+?$/)
  if (numeric) return Number(numeric[1])

  const age = RATING_AGE[value.toUpperCase()]
  return age !== undefined ? age : null
}

export const getServerId = (() => {
  let serverId: string

  return async () => {
    if (serverId) return serverId

    const req = await fetch(
      `${PLEX_URL}/media/providers?X-Plex-Token=${PLEX_TOKEN}`,
      {
        headers: { accept: 'application/json' },
      }
    )

    if (!req.ok) {
      if (req.status === 401) {
        throw new PlexTokenError(`Authentication error: ${req.url}`)
      } else {
        throw new Error(
          `${req.url} returned ${req.status}: ${await req.text()}`
        )
      }
    }

    const providers: PlexMediaProviders = await req.json()
    serverId = providers.MediaContainer.machineIdentifier
    return serverId
  }
})()

export const proxyPoster = async (req: ServerRequest, key: string) => {
  const [, search] = req.url.split('?')
  const searchParams = new URLSearchParams(search)

  const width = searchParams.has('w') ? Number(searchParams.get('w')) : 500

  if (Number.isNaN(width)) {
    return req.respond({ status: 404 })
  }

  const height = width * 1.5

  const posterUrl = encodeURIComponent(`/library/metadata/${key}`)
  const url = `${PLEX_URL}/photo/:/transcode?X-Plex-Token=${PLEX_TOKEN}&width=${width}&height=${height}&minSize=1&upscale=1&url=${posterUrl}`
  try {
    const posterReq = await fetch(url)

    if (!posterReq.ok) {
      if (posterReq.status === 401) {
        throw new PlexTokenError(`Authentication error: ${posterReq.url}`)
      } else {
        throw new Error(
          `${posterReq.url} returned ${
            posterReq.status
          }: ${await posterReq.text()}`
        )
      }
    }

    await req.respond({
      status: 200,
      body: new Uint8Array(await posterReq.arrayBuffer()),
      headers: new Headers({ 'content-type': 'image/jpeg' }),
    })
  } catch (err) {
    log.error(`Failed to load ${url}. ${err}`)
  }
}
