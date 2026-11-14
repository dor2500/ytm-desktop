import { ipcRenderer } from 'electron'
import type { EngineState } from '@shared/types'

// Runs inside the hidden music.youtube.com window. It drives the page's own
// <video> element and reports its state; it also provides active ad skipping.

let video: HTMLVideoElement | null = null
let volume = 80
let muted = false
let lastSent = 0
let wasAdShowing = false

const videoId = (): string => new URLSearchParams(location.search).get('v') ?? ''

// YouTube marks the player element while an advert occupies the video element.
const adShowing = (): boolean =>
  !!document.querySelector(
    '#movie_player.ad-showing, .html5-video-player.ad-showing, .ad-interrupting, .video-ads'
  )

// Fast in-player ad skipper
function skipAdIfShowing(): void {
  if (adShowing()) {
    if (!wasAdShowing) {
      wasAdShowing = true
      ipcRenderer.send('engine:adBlocked')
    }

    if (video) {
      video.muted = true
      if (Number.isFinite(video.duration) && video.duration > 0) {
        video.currentTime = video.duration - 0.05
      }
      video.playbackRate = 16
    }

    // Attempt to click all known YouTube skip buttons
    const skipSelectors = [
      '.ytp-ad-skip-button',
      '.ytp-ad-skip-button-modern',
      '.ytp-skip-ad-button',
      '.ytp-ad-skip-button-slot button',
      '.ytp-ad-overlay-close-button'
    ]
    for (const sel of skipSelectors) {
      const btn = document.querySelector<HTMLElement>(sel)
      if (btn) {
        btn.click()
        break
      }
    }

    // Call movie_player API if accessible
    const moviePlayer = document.getElementById('movie_player') as Record<string, unknown> | null
    if (moviePlayer && typeof moviePlayer.skipAd === 'function') {
      try {
        moviePlayer.skipAd()
      } catch {
        /* ignore */
      }
    }
  } else if (wasAdShowing) {
    wasAdShowing = false
    if (video) {
      video.playbackRate = 1
      applyVolume()
    }
  }

  // Dismiss promotional / mealbar / confirm popups
  const promoButtons = document.querySelectorAll<HTMLElement>(
    'ytmusic-mealbar-promo-renderer #dismiss-button, tp-yt-paper-dialog #dismiss-button, ytmusic-you-there-renderer #confirm-button'
  )
  promoButtons.forEach((btn) => btn.click())
}

// True once the track itself (not an advert) has produced playback.
let contentStarted = false

function report(ended = false): void {
  if (!video) return
  if (adShowing()) contentStarted = false
  else if (!video.paused && video.currentTime > 0.5) contentStarted = true
  const state: EngineState = {
    videoId: videoId(),
    playing: !video.paused && !video.ended,
    buffering: !video.paused && video.readyState < 3,
    position: video.currentTime || 0,
    duration: Number.isFinite(video.duration) ? video.duration : 0,
    ended,
    ad: adShowing()
  }
  lastSent = Date.now()
  ipcRenderer.send('engine:state', state)
}

function applyVolume(): void {
  if (!video) return
  if (adShowing()) {
    video.muted = true
    return
  }
  const target = volume / 100
  if (Math.abs(video.volume - target) > 0.005) video.volume = target
  if (video.muted !== muted) video.muted = muted
}

function bind(el: HTMLVideoElement): void {
  video = el
  applyVolume()
  for (const type of ['play', 'pause', 'playing', 'waiting', 'seeked', 'durationchange', 'loadeddata']) {
    el.addEventListener(type, () => {
      skipAdIfShowing()
      report()
    })
  }
  el.addEventListener('timeupdate', () => {
    skipAdIfShowing()
    if (Date.now() - lastSent > 400) report()
  })
  el.addEventListener('loadstart', () => (contentStarted = false))
  el.addEventListener('ended', () => {
    const trackEnded = contentStarted && !adShowing()
    contentStarted = false
    report(trackEnded)
  })
  // The page restores its own saved volume on every track; keep ours.
  el.addEventListener('volumechange', applyVolume)
  report()
}

function claimMediaKeys(): void {
  // Hardware media keys must move through the app's queue, not the page's.
  try {
    navigator.mediaSession.setActionHandler('nexttrack', () => ipcRenderer.send('engine:media', 'next'))
    navigator.mediaSession.setActionHandler('previoustrack', () => ipcRenderer.send('engine:media', 'previous'))
  } catch {
    /* not supported for this action */
  }
}

// Active scanning loop for new video elements, ads, and media keys
setInterval(() => {
  const el = document.querySelector('video')
  if (el && el !== video) bind(el)
  skipAdIfShowing()
  claimMediaKeys()
}, 150)

ipcRenderer.on('engine:cmd', (_e, cmd: { name: string; value?: number | boolean }) => {
  if (cmd.name === 'volume') volume = Number(cmd.value)
  if (cmd.name === 'muted') muted = !!cmd.value
  if (!video) return
  switch (cmd.name) {
    case 'play':
      void video.play().catch(() => undefined)
      break
    case 'pause':
      video.pause()
      break
    case 'seek':
      video.currentTime = Number(cmd.value)
      break
    case 'volume':
    case 'muted':
      applyVolume()
      break
  }
})

void ipcRenderer.invoke('engine:prefs').then((p: { volume: number; muted: boolean }) => {
  volume = p.volume
  muted = p.muted
  applyVolume()
})
