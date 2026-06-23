// deno-lint-ignore-file

// Plex wordmark, unified to a single colour via fill="currentColor" (the source
// logo's yellow chevron would vanish on a Plex-yellow button, so the button text
// colour drives the whole mark). Sits in place of the word "Plex" on the button.
// The viewBox is cropped to the wordmark's baseline (y≈370 of the original 460.9)
// so the SVG box's bottom edge IS the baseline; the descender draws below it via
// overflow:visible. With `align-items: baseline` the browser then sits the mark
// on the text baseline for ANY font — a fixed nudge only matched the desktop
// font and drifted on mobile system fonts (SF / Roboto).
const PLEX_LOGO_SVG = `<svg class="plex-logo" viewBox="0 0 1000 370" fill="currentColor" aria-hidden="true" focusable="false"><path d="m 164.18919,82.43243 c -39.86487,0 -65.540543,11.48648 -87.162163,38.51351 V 91.21621 H 0 v 366.21621 c 0,0 1.3513514,0.67567 5.4054053,1.35135 5.4054057,1.35135 33.7837827,7.43243 54.7297287,-10.13514 18.243244,-15.54054 22.297295,-33.78378 22.297295,-54.05405 v -52.7027 c 22.297301,23.64864 47.297301,33.78378 82.432431,33.78378 75.67567,0 133.78378,-61.48648 133.78378,-143.24323 0,-88.51352 -56.08108,-150 -134.45945,-150 z m -14.86487,223.64864 c -42.56756,0 -76.351351,-35.13513 -76.351351,-77.7027 0,-41.89189 39.864871,-75.67567 76.351351,-75.67567 43.24324,0 76.35135,33.1081 76.35135,76.35135 0,43.24324 -33.78378,77.02702 -76.35135,77.02702 z"/><path d="m 408.1081,223.64864 c 0,31.75676 3.37838,70.27027 34.45946,112.16216 0.67567,0.67567 2.02702,2.7027 2.02702,2.7027 -12.83783,21.62162 -28.37837,36.48648 -49.32432,36.48648 -16.21622,0 -32.43243,-8.78378 -45.94595,-23.64864 -14.18918,-16.21622 -20.94594,-37.16216 -20.94594,-59.45946 V 0 h 79.05405 z"/><polygon points="117.9,33.9 104.1,13.5 118.3,13.5 132,33.9 118.3,54.2 104.1,54.2 " transform="scale(6.7567568)"/><polygon points="135.7,31.6 148,13.5 133.8,13.5 128.7,21 " transform="scale(6.7567568)"/><path d="m 869.59458,316.2162 c 0,0 16.2162,22.2973 16.2162,22.2973 15.54058,24.32432 35.8108,36.48648 59.45949,36.48648 25,-0.67567 42.56752,-22.29729 49.3243,-30.4054 0,0 -12.16218,-10.81081 -27.7027,-29.05405 -20.94598,-24.32432 -48.64868,-68.91892 -49.3243,-70.94594 z"/><path d="m 632.43242,287.16215 c -16.21622,14.86486 -27.02703,22.97297 -49.32432,22.97297 -39.86487,0 -62.83784,-28.37837 -66.21622,-59.45945 h 211.4865 c 1.35131,-4.05406 2.027,-9.45946 2.027,-18.24324 0,-85.81082 -62.83783,-150 -145.27026,-150 -78.37837,0 -142.56756,65.54054 -142.56756,147.29729 0,81.08108 64.18919,145.27026 144.59459,145.27026 56.08108,0 104.72973,-31.75675 131.08105,-87.83783 z M 585.8108,147.29729 c 35.13513,0 61.48648,22.97297 67.56756,53.37838 H 519.59458 c 6.75676,-31.75676 31.75676,-53.37838 66.21622,-53.37838 z"/></svg>`

const escapeHtml = value =>
  String(value).replace(
    /[&<>"']/g,
    c =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[c])
  )

// Open a match in Plex. Tries the native app first (the plex:// scheme), then
// falls back to the web player. Needs the Plex machine id, fetched on load into
// body.dataset.serverId; without it we just open the web link.
const openInPlex = link => {
  const webUrl = link.href // the /movie route → 302s to the app.plex.tv player
  const serverId = document.body.dataset.serverId
  const key = (link.dataset.key || '').replace(/\/children\/?$/, '')
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

  if (!serverId || !key) {
    if (isMobile) window.location.href = webUrl
    else window.open(webUrl, '_blank', 'noopener')
    return
  }

  const metadataType = link.dataset.type === 'show' ? 2 : 1
  const nativeUrl = `plex://preplay/?metadataKey=${encodeURIComponent(
    key
  )}&metadataType=${metadataType}&server=${serverId}`

  if (isMobile) {
    // Attempt the app; if it takes over, the tab is backgrounded and we cancel
    // the fallback. Otherwise drop to the web player in place after a moment.
    let opened = false
    const onHide = () => {
      if (document.hidden) opened = true
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', () => (opened = true), { once: true })
    setTimeout(() => {
      document.removeEventListener('visibilitychange', onHide)
      if (!opened && !document.hidden) window.location.href = webUrl
    }, 1500)
    window.location.href = nativeUrl
  } else {
    // Desktop: open the web player in a new tab (reliable, no pop-up blocker
    // issues since it's in the click gesture) and also nudge the native desktop
    // app via a hidden iframe in case it's installed.
    window.open(webUrl, '_blank', 'noopener')
    const frame = document.createElement('iframe')
    frame.style.display = 'none'
    frame.src = nativeUrl
    document.body.appendChild(frame)
    setTimeout(() => frame.remove(), 2000)
  }
}

export class MatchesView {
  constructor(matches = []) {
    this.matches = matches
    this.node = document.querySelector('.js-matches-section')
    this.matchesCountEl = this.node.querySelector('.js-matches-count')
    this.matchesListEl = this.node.querySelector('.js-matches-list')

    // Tapping a matched poster flips it to reveal who wants to watch it
    this.matchesListEl.addEventListener('click', e => {
      // "Open in Plex" — try the native app, then web; don't flip the card
      const plexLink = e.target.closest('.match-plex-link')
      if (plexLink) {
        e.preventDefault()
        openInPlex(plexLink)
        return
      }
      const card = e.target.closest('.match-card')
      if (card) card.classList.toggle('match-card--flipped')
    })

    this.render()
  }

  add(match) {
    const existingIndex = this.matches.findIndex(
      _ => _.movie.guid === match.movie.guid
    )

    if (existingIndex !== -1) {
      this.matches.splice(existingIndex, 1)
    }

    this.matchesCountEl.animate(
      {
        transform: ['scale(1)', 'scale(1.5)', 'scale(1)'],
      },
      {
        duration: 300,
        easing: 'ease-in-out',
        fill: 'both',
      }
    )

    this.matches.push(match)
    this.render()
  }

  formatList = users => {
    if (users.length < 3) return users.join(' and ')

    const items = [...users]
    const last = items.splice(-1)
    return `${items.join(', ')}, ${
      document.body.dataset.i18nListConjunction
    } ${last}`
  }

  render() {
    this.matchesCountEl.dataset.count = this.matches.length

    this.matches.sort((a, b) => b.users.length - a.users.length)

    const basePath = document.body.dataset.basePath

    this.matchesListEl.innerHTML = this.matches
      .map(({ users, movie }) => {
        const title = escapeHtml(movie.title)
        const year = movie.year ? ` (${escapeHtml(movie.year)})` : ''
        const plexHref = `${basePath}/movie${escapeHtml(
          movie.key
        )}?type=${escapeHtml(movie.type)}`
        return `
      <li>
        <div class="card match-card" data-guid="${escapeHtml(movie.guid)}">
          <img class="poster" src="${basePath}${movie.art}" alt="${title} poster" />
          <div class="match-detail">
            <p class="match-detail-title">${title}${year}</p>
            <p class="match-detail-label">Voted for by:</p>
            <ul class="match-detail-names">
              ${users.map(u => `<li>${escapeHtml(u)}</li>`).join('')}
            </ul>
            <a class="match-plex-link" href="${plexHref}" target="_blank" rel="noopener" data-key="${escapeHtml(
              movie.key
            )}" data-type="${escapeHtml(
          movie.type
        )}" aria-label="Open in Plex"><span>Open in</span>${PLEX_LOGO_SVG}</a>
          </div>
        </div>
      </li>
    `
      })
      .join('\n')
  }
}
