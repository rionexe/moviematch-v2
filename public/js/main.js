// deno-lint-ignore-file

import { MovieMatchAPI } from './MovieMatchAPI.js'
import { CardView } from './CardView.js'
import { MatchesView } from './MatchesView.js'

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

const generateRoomCode = () => {
  const charMap = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 4 })
    .map(() => charMap[Math.floor(Math.random() * charMap.length)])
    .join('')
}

// "Occupancy - N" counter + the tap-to-reveal list of who's in the room
const setupOccupancy = api => {
  const countEl = document.querySelector('.js-occupancy-count')
  const listEl = document.querySelector('.js-occupancy-list')
  const toggle = document.querySelector('.js-occupancy-toggle')

  const render = names => {
    countEl.textContent = names.length
    listEl.innerHTML = names.map(n => `<li>${escapeHtml(n)}</li>`).join('')
  }

  // Seed from whatever arrived during the login handshake, then keep updating
  render(api.occupancy ?? [])
  api.addEventListener('occupancy', e => render(e.data.names))

  toggle.addEventListener('click', () => {
    listEl.hidden = !listEl.hidden
  })
}

// Copy text, with a fallback for non-secure (http) contexts where the modern
// Clipboard API is unavailable — which is the case on a LAN http deployment.
const copyToClipboard = async text => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch (_err) {
    // fall through to the legacy path
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch (_err) {
    return false
  }
}

// The dumbbell is designed in a 200x56 "design box" (a nicely rounded bulb) and
// then squashed to the bar's real height on screen via the SVG viewBox, so the
// bulbs keep that rounded look instead of becoming thin pixel-accurate slivers.
// Drawing the whole thing as one path means there's no seam to misalign.
const DUMBBELL_H = 56 // design-box height
const DUMBBELL_BULB = 200 // design-box bulb width

const dumbbellPath = w => {
  const r = 28 // cap radius (design units)
  // Connecting bar is 5 design units thick (≈3px on screen), centred on the
  // 56u box — kept slim so the bulbs read as the focal caps and the bar as a
  // quiet connector rather than competing with them.
  const bt = 25.5 // bar top
  const bb = 30.5 // bar bottom
  const bodyEnd = 158 // where the flat body ends and the neck begins
  const neck = 200 // where the neck meets the bar
  const ctrl = 182 // neck curve control point
  return [
    `M ${r},0`,
    `L ${bodyEnd},0`,
    `C ${ctrl},0 ${ctrl},${bt} ${neck},${bt}`,
    `L ${w - neck},${bt}`,
    `C ${w - ctrl},${bt} ${w - ctrl},0 ${w - bodyEnd},0`,
    `L ${w - r},0`,
    `A ${r} ${r} 0 0 1 ${w - r},${DUMBBELL_H}`,
    `L ${w - bodyEnd},${DUMBBELL_H}`,
    `C ${w - ctrl},${DUMBBELL_H} ${w - ctrl},${bb} ${w - neck},${bb}`,
    `L ${neck},${bb}`,
    `C ${ctrl},${bb} ${ctrl},${DUMBBELL_H} ${bodyEnd},${DUMBBELL_H}`,
    `L ${r},${DUMBBELL_H}`,
    `A ${r} ${r} 0 0 1 ${r},0`,
    `Z`,
  ].join(' ')
}

// Renders the dumbbell SVG (re-drawn on resize), wires room-code copy on tap
const setupRoomBar = roomCode => {
  const bar = document.querySelector('.js-room-bar')
  const svg = bar.querySelector('.room-bar-svg')
  const path = bar.querySelector('.js-room-bar-path')
  const text = document.querySelector('.js-room-code-text')
  const button = document.querySelector('.js-room-code')

  text.textContent = roomCode
  button.addEventListener('click', async () => {
    const ok = await copyToClipboard(roomCode)
    text.textContent = ok ? 'Copied!' : roomCode
    if (ok) {
      setTimeout(() => {
        text.textContent = roomCode
      }, 1200)
    }
  })

  const render = () => {
    const containerPx = Math.round(bar.clientWidth)
    if (!containerPx) return
    // --bulb-w is the on-screen bulb width; scale the design box to hit it, and
    // the viewBox height (DUMBBELL_H) gets squashed to the bar's CSS height.
    const bulbPx = parseFloat(getComputedStyle(bar).getPropertyValue('--bulb-w')) || 176
    const xScale = bulbPx / DUMBBELL_BULB
    const w = containerPx / xScale
    svg.setAttribute('viewBox', `0 0 ${w} ${DUMBBELL_H}`)
    path.setAttribute('d', dumbbellPath(w))
  }

  render()
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(render).observe(bar)
  } else {
    window.addEventListener('resize', render)
  }
}

const main = async () => {
  const CARD_STACK_SIZE = 4

  let api = new MovieMatchAPI()

  const { matches } = await login(api)

  setupOccupancy(api)

  let matchesView = new MatchesView(matches)
  let topCardEl

  api.addEventListener('match', e => matchesView.add(e.data))

  const rateControls = document.querySelector('.rate-controls')

  rateControls.addEventListener('click', e => {
    let wantsToWatch
    if (e.target.classList.contains('rate-thumbs-down')) {
      wantsToWatch = false
    } else if (e.target.classList.contains('rate-thumbs-up')) {
      wantsToWatch = true
    } else {
      return
    }

    if (topCardEl) {
      topCardEl.dispatchEvent(new MessageEvent('rate', { data: wantsToWatch }))
    }
  })

  document.addEventListener('keydown', e => {
    const wantsToWatch =
      e.key === 'ArrowLeft' ? false : e.key === 'ArrowRight' ? true : null
    if (wantsToWatch === null) {
      return
    }
    if (topCardEl) {
      topCardEl.dispatchEvent(new MessageEvent('rate', { data: wantsToWatch }))
    }
  })

  const cardStackEventTarget = new EventTarget()

  cardStackEventTarget.addEventListener('newTopCard', () => {
    topCardEl = topCardEl.nextSibling

    if (!topCardEl) {
      const cardStackEl = document.querySelector('.js-card-stack')

      if (cardStackEl) {
        cardStackEl.style.setProperty(
          '--empty-text',
          `var(--i18n-exhausted-cards)`
        )
      }

      rateControls.setAttribute('disabled', '')
    }
  })

  for await (let [movie, i] of api) {
    if (i > CARD_STACK_SIZE) {
      const response = await new Promise(resolve => {
        cardStackEventTarget.addEventListener(
          'response',
          e => {
            resolve(e.data)
          },
          {
            once: true,
          }
        )
      })
      api.respond(response)
    } else if (i === CARD_STACK_SIZE) {
      topCardEl = document.querySelector('.js-card-stack > :first-child')
    }

    new CardView(movie, cardStackEventTarget)
  }
}

export const login = async api => {
  const loginSection = document.querySelector('.login-section')
  const loginForm = document.querySelector('.js-login-form')
  const modeToggle = document.querySelector('.js-mode-toggle')
  const submitButton = document.querySelector('.js-submit')
  const errorEl = document.querySelector('.js-login-error')

  const showError = msg => {
    errorEl.textContent = msg
    errorEl.hidden = false
  }
  const clearError = () => {
    errorEl.hidden = true
  }

  const savedUser = localStorage.getItem('user')
  const savedRoomCode = localStorage.getItem('roomCode')
  if (savedUser) loginForm.elements.name.value = savedUser
  if (savedRoomCode) loginForm.elements.roomCode.value = savedRoomCode

  loginForm.elements.roomCode.addEventListener('input', e => {
    e.target.value = e.target.value.toUpperCase()
  })

  // Create / Join mode toggle
  modeToggle.addEventListener('click', e => {
    const option = e.target.closest('.mode-option')
    if (!option) return
    const mode = option.dataset.mode
    loginForm.dataset.mode = mode
    modeToggle
      .querySelectorAll('.mode-option')
      .forEach(o => o.classList.toggle('is-active', o === option))
    submitButton.textContent = mode === 'create' ? 'Create' : 'Join'
    clearError()
  })

  // Populate the age dropdowns (grey hints show MPAA/TV mappings)
  const ageHints = {
    6: 'G',
    10: 'PG · TV-PG',
    13: 'PG-13',
    14: 'TV-14',
    17: 'R',
    18: 'NC-17',
  }
  const fillAgeOptions = (select, ascending) => {
    const ages = []
    for (let age = 3; age <= 18; age++) ages.push(age)
    if (!ascending) ages.reverse()
    for (const age of ages) {
      const option = document.createElement('option')
      option.value = String(age)
      option.textContent = ageHints[age]
        ? `${age}  ·  ${ageHints[age]}`
        : String(age)
      select.appendChild(option)
    }
  }
  // Minimum counts up (3 → 18), maximum counts down (18 → 3) so each reads
  // naturally from its "No limit" end.
  fillAgeOptions(document.querySelector('.js-min-age'), true)
  fillAgeOptions(document.querySelector('.js-max-age'), false)

  // Fetch the Plex machine id so matches can build native plex:// deep links.
  // Non-blocking: if it fails, "Open in Plex" just uses the web link.
  ;(async () => {
    try {
      const basePath = document.body.dataset.basePath ?? ''
      const { serverId } = await (await fetch(`${basePath}/api/server`)).json()
      if (serverId) document.body.dataset.serverId = serverId
    } catch (_err) {
      /* ignore — web fallback still works */
    }
  })()

  // Populate the allowed libraries from the server
  const libraryList = document.querySelector('.js-library-list')
  try {
    const basePath = document.body.dataset.basePath ?? ''
    const res = await fetch(`${basePath}/api/libraries`)
    const { libraries } = await res.json()
    libraryList.innerHTML = ''
    if (!libraries.length) {
      libraryList.innerHTML =
        '<p class="field-hint">No libraries available — check the LIBRARY_FILTER setting.</p>'
    } else {
      // Default to just the first library selected, not all of them
      libraries.forEach((lib, index) => {
        const row = document.createElement('label')
        row.className = 'checkbox-row'
        const input = document.createElement('input')
        input.type = 'checkbox'
        input.className = 'js-library'
        input.value = lib
        input.checked = index === 0
        const span = document.createElement('span')
        span.textContent = lib
        row.append(input, span)
        libraryList.appendChild(row)
      })
    }
  } catch (err) {
    libraryList.innerHTML =
      "<p class=\"field-hint\">Couldn't load libraries.</p>"
  }

  return new Promise(resolve => {
    const handleSubmit = async e => {
      e.preventDefault()
      clearError()

      const formData = new FormData(loginForm)
      const name = (formData.get('name') || '').trim()
      const mode = loginForm.dataset.mode || 'create'

      if (!name) {
        showError('Please enter a name.')
        return
      }

      // Create auto-generates a room code; Join uses the entered one
      const roomCode =
        mode === 'create'
          ? generateRoomCode()
          : (formData.get('roomCode') || '').toUpperCase()

      if (mode === 'join' && !roomCode) {
        showError('Enter a room code to join.')
        return
      }

      let filters
      if (mode === 'create') {
        const libraries = [
          ...loginForm.querySelectorAll('.js-library:checked'),
        ].map(input => input.value)

        if (libraries.length === 0) {
          showError('Pick at least one library.')
          return
        }

        const minAgeValue = formData.get('minAge')
        const maxAgeValue = formData.get('maxAge')
        const minAge = minAgeValue === '' ? null : Number(minAgeValue)
        const maxAge = maxAgeValue === '' ? null : Number(maxAgeValue)

        if (minAge !== null && maxAge !== null && minAge > maxAge) {
          showError("Minimum age can't be higher than maximum age.")
          return
        }

        filters = {
          libraries,
          minAge,
          maxAge,
          includeUnrated: formData.get('includeUnrated') === 'on',
        }
      }

      try {
        const data = await api.login(name, roomCode, { mode, filters })
        loginForm.removeEventListener('submit', handleSubmit)

        await loginSection.animate(
          { opacity: ['1', '0'] },
          { duration: 250, easing: 'ease-in-out', fill: 'both' }
        ).finished

        loginSection.hidden = true
        localStorage.setItem('user', name)
        localStorage.setItem('roomCode', roomCode)

        setupRoomBar(roomCode)

        document.body.scrollIntoView()

        await Promise.all(
          [
            ...document.querySelectorAll('.rate-section, .matches-section'),
          ].map(node => {
            node.hidden = false
            return node.animate(
              { opacity: ['0', '1'] },
              { duration: 250, easing: 'ease-in-out', fill: 'both' }
            ).finished
          })
        )

        resolve({ ...data, user: name })
      } catch (err) {
        showError(err.message)
      }
    }

    loginForm.addEventListener('submit', handleSubmit)
  })
}

main().catch(err => console.error(err))
