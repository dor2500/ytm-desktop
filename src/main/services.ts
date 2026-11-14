import { BrowserView, BrowserWindow } from 'electron'
import type { MusicService, ServiceBounds } from '@shared/types'
import { CHROME_UA } from './auth'

let currentService: MusicService = 'ytm'
let externalView: BrowserView | null = null
let mainWindow: BrowserWindow | null = null
let currentBounds: ServiceBounds = { x: 245, y: 62, width: 800, height: 700 }

const SERVICE_URLS: Record<MusicService, string> = {
  ytm: '',
  spotify: 'https://open.spotify.com',
  soundcloud: 'https://soundcloud.com/discover'
}

export function initServices(win: BrowserWindow): void {
  mainWindow = win
}

export function getService(): MusicService {
  return currentService
}

export function updateBounds(bounds: ServiceBounds): void {
  currentBounds = bounds
  if (externalView && mainWindow && currentService !== 'ytm') {
    externalView.setBounds(bounds)
  }
}

export async function setService(service: MusicService, bounds?: ServiceBounds): Promise<void> {
  if (bounds) currentBounds = bounds
  currentService = service

  if (!mainWindow || mainWindow.isDestroyed()) return

  if (service === 'ytm') {
    if (externalView) {
      mainWindow.setBrowserView(null)
    }
    mainWindow.webContents.send('service:changed', 'ytm')
    return
  }

  // Create BrowserView if not yet created
  if (!externalView) {
    externalView = new BrowserView({
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    externalView.webContents.setUserAgent(CHROME_UA)
    externalView.setAutoResize({ width: true, height: true })

    // Inject custom CSS to blend Spotify/SoundCloud into dark acrylic theme
    externalView.webContents.on('did-finish-load', () => {
      externalView?.webContents.insertCSS(`
        /* Remove upgrade banners and harmonize with dark theme */
        [data-testid="upgrade-button"],
        .Root__top-bar header button[aria-label="Upgrade to Premium"],
        .banner, .ad-banner, .teaser { display: none !important; }
        ::-webkit-scrollbar { width: 8px !important; }
        ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15) !important; border-radius: 999px !important; }
      `)
    })
  }

  mainWindow.setBrowserView(externalView)
  externalView.setBounds(currentBounds)

  const targetUrl = SERVICE_URLS[service]
  if (targetUrl) {
    const currentUrl = externalView.webContents.getURL()
    if (!currentUrl.startsWith(targetUrl)) {
      await externalView.webContents.loadURL(targetUrl, { userAgent: CHROME_UA })
    }
  }

  mainWindow.webContents.send('service:changed', service)
}

export function destroyServices(): void {
  if (externalView && !externalView.webContents.isDestroyed()) {
    // detach
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setBrowserView(null)
    }
  }
  externalView = null
  mainWindow = null
}
