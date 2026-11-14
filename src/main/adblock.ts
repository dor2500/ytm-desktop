import { session, BrowserWindow } from 'electron'

let enabled = true
let blockedCount = 0
let mainWindow: BrowserWindow | null = null

const AD_URL_PATTERNS = [
  // General & Google Ads
  '*://*.doubleclick.net/*',
  '*://*.googleadservices.com/*',
  '*://*.googlesyndication.com/*',
  '*://pagead2.googlesyndication.com/*',
  '*://*.moatads.com/*',
  '*://*.scorecardresearch.com/*',

  // YouTube Music Ads
  '*://*.youtube.com/pagead/*',
  '*://*.youtube.com/api/stats/ads*',
  '*://*.youtube.com/ptracking*',
  '*://*.youtube.com/ad_companion*',
  '*://*.youtube.com/get_midroll_info*',
  '*://music.youtube.com/youtubei/v1/att/get*',
  '*://*.youtube.com/youtubei/v1/player/ad_break*',

  // Spotify Ads
  '*://*.spotify.com/ad/*',
  '*://spclient.wg.spotify.com/ads/*',
  '*://spclient.wg.spotify.com/ad-logic/*',
  '*://*.audio-ak-spotify-com.akamaized.net/*',
  '*://heads-ak-spotify-com.akamaized.net/*',

  // SoundCloud Ads
  '*://*.sndcdn.com/promoted/*',
  '*://api-v2.soundcloud.com/promoted-tracks*',
  '*://api-v2.soundcloud.com/commercial-tracks*'
]

export function initAdBlocker(win: BrowserWindow): void {
  mainWindow = win

  session.defaultSession.webRequest.onBeforeRequest(
    { urls: AD_URL_PATTERNS },
    (details, callback) => {
      if (!enabled) {
        callback({ cancel: false })
        return
      }

      blockedCount++
      broadcastStats()
      callback({ cancel: true })
    }
  )
}

export function broadcastStats(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('adblock:stats', getStats())
  }
}

export function incrementBlocked(): void {
  blockedCount++
  broadcastStats()
}

export function toggleAdBlock(): boolean {
  enabled = !enabled
  broadcastStats()
  return enabled
}

export function isAdBlockEnabled(): boolean {
  return enabled
}

export function getStats(): { enabled: boolean; blockedCount: number } {
  return { enabled, blockedCount }
}
