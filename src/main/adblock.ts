import { session, BrowserWindow } from 'electron'

let enabled = true
let blockedCount = 0
let mainWindow: BrowserWindow | null = null

const AD_URL_PATTERNS = [
  '*://*.doubleclick.net/*',
  '*://*.googleadservices.com/*',
  '*://*.googlesyndication.com/*',
  '*://pagead2.googlesyndication.com/*',
  '*://*.youtube.com/pagead/*',
  '*://*.youtube.com/api/stats/ads*',
  '*://*.youtube.com/ptracking*',
  '*://*.youtube.com/ad_companion*',
  '*://*.youtube.com/get_midroll_info*',
  '*://music.youtube.com/youtubei/v1/att/get*',
  '*://*.youtube.com/youtubei/v1/player/ad_break*',
  '*://*.moatads.com/*',
  '*://*.scorecardresearch.com/*'
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
