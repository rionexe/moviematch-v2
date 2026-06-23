// deno-lint-ignore-file

const cardList = document.querySelector('.js-card-stack')

export class CardView {
  constructor(movieData, eventTarget) {
    this.movieData = movieData
    this.eventTarget = eventTarget
    this.animationDuration = 500
    this.basePath = document.body.dataset.basePath
    this.render()
  }

  render() {
    const node = document.createElement('div')
    this.node = node
    node.classList.add('card')
    node.addEventListener('pointerdown', this.handleSwipe)
    node.addEventListener('touchstart', e => e.preventDefault())
    node.addEventListener('rate', e =>
      this.rate(e.data, this.getAnimation(e.data ? 'right' : 'left'))
    )

    const { title, art, year, guid, summary, rating } = this.movieData
    node.dataset.guid = guid

    // Width-descriptor srcset so the browser fetches a poster sized to the
    // actual card (~650px+), not the old 300px density-descriptor default.
    const posterWidths = [400, 600, 800, 1000, 1300, 1600]
    const srcSet = posterWidths
      .map(w => `${this.basePath}${art}?w=${w} ${w}w`)
      .join(', ')
    const fallbackSrc = `${this.basePath}${art}?w=800`
    const thumbSrc = `${this.basePath}${art}?w=400`

    const ratingScore = rating != null ? Math.round(rating * 10) : null
    const ratingClass = ratingScore != null && ratingScore < 60 ? 'card-rating card-rating--mid' : 'card-rating'
    const ratingHtml = ratingScore != null
      ? `<span class="${ratingClass}"><span class="card-rating-dot"></span>${ratingScore}%</span>`
      : ''

    node.innerHTML = `
      <img class="poster" src="${fallbackSrc}" decode="async" srcset="${srcSet}" sizes="(max-width: 48em) 80vw, 53vh" alt="${title} poster" />
      <div class="card-detail">
        <div class="card-detail-top">
          <img class="poster poster--thumb" src="${thumbSrc}" decode="async" srcset="${srcSet}" sizes="200px" alt="" aria-hidden="true" />
          <div class="card-detail-meta">
            <p class="card-title">${title}${year ? ` <span class="card-year">(${year})</span>` : ''}</p>
            ${ratingHtml}
          </div>
        </div>
        ${summary ? `<p class="card-summary">${summary}</p>` : ''}
      </div>
    `

    cardList.appendChild(node)
  }

  async rate(wantsToWatch, animation) {
    this.eventTarget.dispatchEvent(new Event('newTopCard'))

    if (animation.playState !== 'finished') {
      if (animation.currentTime === this.animationDuration) {
        animation.finish()
      } else {
        animation.playbackRate = 3
        animation.play()
      }
      await animation.finished
    }

    this.eventTarget.dispatchEvent(
      new MessageEvent('response', {
        data: {
          guid: this.movieData.guid,
          wantsToWatch,
        },
      })
    )
    this.destroy()
  }

  handleSwipe = startEvent => {
    if (
      (startEvent.pointerType === 'mouse' && startEvent.button !== 0) ||
      startEvent.target instanceof HTMLButtonElement
    ) {
      return
    }

    startEvent.preventDefault()
    this.node.setPointerCapture(startEvent.pointerId)
    const maxX = window.innerWidth
    const summaryEl = startEvent.target.closest('.card-summary')

    let currentDirection
    let position = 0
    let moved = false
    let axis = null // 'x' = swipe, 'y' = scroll the description
    let lastY = startEvent.y
    this.animationFrameRequestId = requestAnimationFrame(() =>
      this.animationLoop()
    )

    const handleMove = e => {
      const delta = e.x - startEvent.x
      const deltaY = e.y - startEvent.y

      // Stay below threshold => still a potential tap, not a drag
      if (axis === null) {
        if (Math.abs(delta) < 10 && Math.abs(deltaY) < 10) {
          return
        }
        // Lock to the dominant axis on the first real movement
        axis = Math.abs(delta) > Math.abs(deltaY) ? 'x' : 'y'
      }
      moved = true

      // Vertical drag that began on the description scrolls it, no swipe
      if (axis === 'y') {
        if (summaryEl) {
          summaryEl.scrollTop -= e.y - lastY
          lastY = e.y
        }
        return
      }

      const direction = e.x < startEvent.x ? 'left' : 'right'

      position =
        direction === 'left'
          ? Math.abs(delta) / startEvent.x
          : delta / (maxX - startEvent.x)

      if (currentDirection != direction) {
        currentDirection = direction
        this.animation = this.getAnimation(direction)

        this.animation.pause()
      }

      this.currentTime =
        Math.max(0, Math.min(1, position)) * this.animationDuration
    }
    this.node.addEventListener('pointermove', handleMove, { passive: true })
    this.node.addEventListener(
      'lostpointercapture',
      async () => {
        this.node.removeEventListener('pointermove', handleMove)
        cancelAnimationFrame(this.animationFrameRequestId)

        // No meaningful drag => treat as a tap and toggle the detail view
        if (!moved) {
          this.node.classList.toggle('card--expanded')
          return
        }

        // A vertical scroll gesture shouldn't swipe or toggle
        if (axis === 'y') {
          return
        }

        if (this.animation) {
          if (position >= 0.5) {
            await this.rate(currentDirection === 'right', this.animation)
          } else {
            this.animation.reverse()
          }

          this.animation = null
          currentDirection = null
        }
      },
      { once: true }
    )
  }

  animationLoop() {
    if (this.animation) {
      this.animation.currentTime = this.currentTime
    }
    this.animationFrameRequestId = requestAnimationFrame(() =>
      this.animationLoop()
    )
  }

  getAnimation(direction) {
    return this.node.animate(
      {
        transform: [
          'translate(0, 0)',
          `translate(${direction === 'left' ? '-50vw' : '50vw'}, 0)`,
        ],
        opacity: ['1', '0.8', '0'],
      },
      {
        duration: this.animationDuration,
        easing: 'ease-in-out',
        fill: 'both',
      }
    )
  }

  destroy() {
    this.node.remove()
  }
}
