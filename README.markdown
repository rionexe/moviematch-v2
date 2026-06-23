# <img src="public/assets/logo.svg" height="40px" alt="MovieMatch" />

## What is this?

Have you ever spent longer deciding on a movie than it'd take to just watch a random one? This is an app that helps you and your friends pick something to watch from a [Plex](https://www.plex.tv) server.

> This is a customised fork of [LukeChannings/moviematch](https://github.com/LukeChannings/moviematch) with multi-user rooms, TV-show support, content-age filtering, an "Open in Plex" action, and a refreshed frosted-glass UI.

## How it works

One person **creates a room**: they pick which Plex libraries to draw from, optionally set a minimum and/or maximum content age, and get a short room code. Everyone else **joins** with that code and their name.

Each person gets the same shuffled deck of titles — movies _and_ TV shows are supported, with each series shown as a single card. Swipe right / tap 👍 for yes, swipe left / tap 👎 for no.

When two or more people 👍 the same title it appears in everyone's **Matches**, ordered by how many people wanted it. Tap a matched poster to flip it and see who voted, then hit **Open in Plex** to jump straight to it.

## Features

- **Rooms** — create a room with your own library and age filters, or join one with a 4-character code (joiners inherit the creator's filters; the create form generates the code for you).
- **Movies _and_ TV shows** — any movie- or show-type library can be included; each series is a single swipeable card.
- **Multi-user matches** — matched posters flip to reveal who voted, and matches are ranked by vote count.
- **Open in Plex** — every match links straight to the title in Plex, on desktop or mobile (movies and shows alike).
- **Content-age filtering** — minimum/maximum age dropdowns map Plex content ratings (MPAA, TV, and Common Sense ages) onto a single scale, with an option to include unrated titles.
- **Live room info** — see how many people are connected (tap to list them) and tap the room code to copy it.
- **Frosted-glass UI** — cards show poster, title, year, rating and synopsis, and expand on tap.

## Getting started

### With Docker

This fork is built from source. Build the image and run it:

```sh
docker build -t moviematch .

docker run -it \
  -e PLEX_URL=<Plex URL> \
  -e PLEX_TOKEN=<Your Token> \
  -e LIBRARY_FILTER=all \
  -p 8000:8000 \
  moviematch
```

> **Important:** `LIBRARY_FILTER` is a fail-safe allow-list and defaults to empty, which exposes **no** libraries. Set it to `all` (every movie/show library) or a comma-separated list of library names — otherwise rooms will have nothing to swipe on.

**Note**: there is also documentation for **docker-compose** [here](./docs/docker-compose.markdown) 👈

### With Deno

You don't need this if you're using Docker — the Docker image already bundles Deno. To run it directly on your machine instead:

- Install [Deno](https://deno.land/manual/getting_started/installation)
- Create a `.env` file (see [.env-template](./.env-template) for an example)
- Run `deno run --allow-net --allow-read --allow-env --unstable src/index.ts`

Open [localhost:8000](http://localhost:8000)

## Configuration

The following variables are supported via a `.env` file or environment variables.

| Name              | Description                                                                                                                                                                                  | Required | Default            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------ |
| PLEX_URL          | URL of your Plex server, e.g. `http://192.168.1.10:32400` or `https://plex.example.com:32400`. Use `http://` for a bare IP address — Deno rejects `https://` to a raw IP.                    | Yes      | —                  |
| PLEX_TOKEN        | Plex API token. [How to find yours](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/)                                                                | Yes      | —                  |
| LIBRARY_FILTER    | Fail-safe allow-list of libraries that can be picked when creating a room. `all` = every movie/show library; or a comma-separated list of library names (e.g. `Films,TV`). **Empty exposes no libraries.** | No       | `''` (no libraries) |
| COLLECTION_FILTER | Restrict cards to titles in these Plex collections, comma-separated (e.g. `Marvel`, or `Marvel,HBO`). Empty means no collection filtering.                                                   | No       | `''`               |
| LINK_TYPE         | How the **Open in Plex** button links. `app` uses the universal `app.plex.tv` link, which opens the Plex app or web player on any device (including mobile). `local` links directly to your `PLEX_URL` — only reachable on the same network. | No       | `app`              |
| ROOT_PATH         | The sub-path MovieMatch is served under, if any (without a trailing slash). Leave blank when served at the domain root.                                                                      | No       | `''`               |
| PORT              | The port the server listens on.                                                                                                                                                             | No       | `8000`             |
| MOVIE_BATCH_SIZE  | How many titles to fetch per batch. Unless you're running out of cards really quickly you should leave this alone.                                                                           | No       | `25`               |
| LOG_LEVEL         | How much the server should log. Supported: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`.                                                                                                 | No       | `INFO`             |

## FAQ

### Can a user get my Plex Token?

No. The client never talks directly to the Plex server, and any requests that need the token (e.g. querying movies, getting poster art) are made by the server.

Furthermore, only a subset of the Plex response is given to the client to minimise the chance of sensitive information leaking out.

### Can it do TV shows too?

Yes. Any movie or TV library you expose via `LIBRARY_FILTER` can be picked when creating a room, and each series shows up as a single card.

### Do you gather any data?

No. The server is entirely local to you and will work offline.

### Do you support languages other than English?

Yes. The server will use your browser's preferred language by default if it's supported. Otherwise it'll fall back to English.

The translations can be found [in the i18n folder](./i18n).

The file names follow [BCP47](https://tools.ietf.org/html/bcp47) naming. Feel free to submit a Pull Request if you'd like your language to be supported.

### Can I run MovieMatch behind a reverse proxy?

Yes, you can read some documentation [here](./docs/reverse-proxy.markdown)
