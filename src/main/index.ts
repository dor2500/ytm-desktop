import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import type { AuthState } from '@shared/types'
import * as auth from './auth'
import * as yt from './yt'
import * as engine from './engine'
import * as adblock from './adblock'
import { serveRenderer } from './server'

// Use real Chrome User-Agent to avoid Google's "This browser or app may not be secure" block
const USER_AGENT = auth.CHROME_UA
app.userAgentFallback = USER_AGENT
yt.configure(USER_AGENT)

let mainWindow: BrowserWindow | null = null

async function authState(): Promise<AuthState> {
  const signedIn = await auth.isSignedIn()
  if (!signedIn) return { signedIn: false }
  const profile = await yt.getAccountProfile()
  return { signedIn: true, name: profile.name, photo: profile.photo }
}

async function broadcastAuth(): Promise<AuthState> {
  yt.reset()
  engine.reset()
  const state = await authState()
  mainWindow?.webContents.send('auth:changed', state)
  return state
}

function registerIpc(): void {
  ipcMain.handle('auth:state', () => authState())
  ipcMain.handle('auth:signIn', async () => {
    if (mainWindow) await auth.signIn(mainWindow)
    return broadcastAuth()
  })
  ipcMain.handle('auth:signOut', async () => {
    await auth.signOut()
    return broadcastAuth()
  })
  ipcMain.handle('auth:importCookies', async (_e, rawCookie: string) => {
    await auth.importCookieString(String(rawCookie))
    return broadcastAuth()
  })

  // AdBlocker IPC
  ipcMain.handle('adblock:stats', () => adblock.getStats())
  ipcMain.handle('adblock:toggle', () => adblock.toggleAdBlock())

  engine.init(
    (state) => mainWindow?.webContents.send('player:state', state),
    (key) => mainWindow?.webContents.send('player:mediaKey', key)
  )
  ipcMain.handle('player:load', (_e, id: string) => engine.load(String(id)))
  ipcMain.handle('player:stop', () => engine.stop())
  ipcMain.handle('player:play', () => engine.command('play'))
  ipcMain.handle('player:pause', () => engine.command('pause'))
  ipcMain.handle('player:seek', (_e, s: number) => engine.command('seek', Math.max(0, Number(s) || 0)))
  ipcMain.handle('player:volume', (_e, v: number) => engine.command('volume', Math.min(100, Math.max(0, Number(v) || 0))))
  ipcMain.handle('player:muted', (_e, m: boolean) => engine.command('muted', !!m))

  ipcMain.handle('music:home', () => yt.home())
  ipcMain.handle('music:search', (_e, q: string) => yt.search(String(q)))
  ipcMain.handle('music:suggest', (_e, q: string) => yt.suggest(String(q)))
  ipcMain.handle('music:library', () => yt.library())
  ipcMain.handle('music:playlist', (_e, id: string) => yt.playlist(String(id)))
  ipcMain.handle('music:album', (_e, id: string) => yt.album(String(id)))
  ipcMain.handle('music:artist', (_e, id: string) => yt.artist(String(id)))
  ipcMain.handle('music:upNext', (_e, id: string) => yt.upNext(String(id)))
  ipcMain.handle('music:lyrics', (_e, id: string) => yt.lyrics(String(id)))
  ipcMain.handle('music:like', (_e, id: string, liked: boolean) => yt.like(String(id), !!liked))
  ipcMain.handle('music:addToPlaylist', (_e, pl: string, id: string) => yt.addToPlaylist(String(pl), String(id)))
  ipcMain.handle('music:createPlaylist', (_e, title: string, ids: string[]) =>
    yt.createPlaylist(String(title), Array.isArray(ids) ? ids.map(String) : [])
  )
}

async function createWindow(): Promise<void> {
  const url =
    process.env['ELECTRON_RENDERER_URL'] ?? (await serveRenderer(join(__dirname, '../renderer')))

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1040,
    minHeight: 640,
    show: false,
    backgroundColor: '#08090d',
    title: 'Aria Music',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: '#b9bcc6', height: 44 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Initialize ad blocker for this session and window
  adblock.initAdBlocker(mainWindow)

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
    // The hidden engine window would otherwise keep the app (and the music) alive.
    engine.destroy()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https:\/\//i.test(target)) void shell.openExternal(target)
    return { action: 'deny' }
  })
  const appOrigin = new URL(url).origin
  mainWindow.webContents.on('will-navigate', (e, target) => {
    if (new URL(target).origin !== appOrigin) e.preventDefault()
  })

  await mainWindow.loadURL(url)
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })
  app.whenReady().then(() => {
    auth.setupAuthHeaders()
    registerIpc()
    void createWindow()
  })
  app.on('window-all-closed', () => app.quit())
}
