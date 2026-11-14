import { BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import type { EngineState } from '@shared/types'
import { incrementBlocked } from './adblock'

/**
 * Playback engine: a hidden window running music.youtube.com's own player in
 * the app's session. Rights holders block most music from the embeddable
 * IFrame player (error 150), so the official web player is the only one that
 * plays the whole catalogue. Adverts and Premium behave exactly as on the site.
 */

const HOST = 'music.youtube.com'

let win: BrowserWindow | null = null
let desired = ''
const prefs = { volume: 80, muted: false }

type Listener = (state: EngineState) => void
let emit: Listener = () => undefined
let onMedia: (key: string) => void = () => undefined

function ensure(): BrowserWindow {
  if (win && !win.isDestroyed()) return win
  win = new BrowserWindow({
    show: false,
    width: 960,
    height: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/engine.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      // A hidden window is throttled by default, which stalls playback events.
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required'
    }
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('did-navigate', (_e, url) => {
    if (url === 'about:blank') return
    // A consent or sign-in interstitial means the player page never loaded.
    if (new URL(url).hostname !== HOST && desired) {
      emit({ videoId: desired, playing: false, buffering: false, position: 0, duration: 0, ended: false, ad: false, blocked: true })
    }
  })
  win.on('closed', () => (win = null))
  return win
}

export function init(listener: Listener, media: (key: string) => void): void {
  emit = listener
  onMedia = media
  ipcMain.on('engine:state', (e, state: EngineState) => {
    // Ignore anything the page plays on its own initiative (its autoplay queue).
    if (e.sender === win?.webContents && state.videoId === desired) emit(state)
  })
  ipcMain.on('engine:media', (e, key: string) => {
    if (e.sender === win?.webContents) onMedia(key)
  })
  ipcMain.on('engine:adBlocked', () => {
    incrementBlocked()
  })
  ipcMain.handle('engine:prefs', () => prefs)
}

export function load(videoId: string): void {
  if (!/^[\w-]{6,20}$/.test(videoId)) return
  desired = videoId
  void ensure().loadURL(`https://${HOST}/watch?v=${videoId}`)
}

export function stop(): void {
  desired = ''
  if (win && !win.isDestroyed()) void win.loadURL('about:blank')
}

export function command(name: 'play' | 'pause' | 'seek' | 'volume' | 'muted', value?: number | boolean): void {
  if (name === 'volume') prefs.volume = Number(value)
  if (name === 'muted') prefs.muted = !!value
  if (win && !win.isDestroyed()) win.webContents.send('engine:cmd', { name, value })
}

/** Session cookies changed; drop the page so the next track loads as the new account. */
export function reset(): void {
  stop()
}

export function destroy(): void {
  if (win && !win.isDestroyed()) win.destroy()
  win = null
}
