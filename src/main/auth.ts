import { BrowserWindow, session, shell } from 'electron'

const YTM_ORIGIN = 'https://music.youtube.com'
const SIGN_IN_URL =
  'https://accounts.google.com/ServiceLogin?service=youtube&continue=' +
  encodeURIComponent(YTM_ORIGIN + '/')

export const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/**
 * Configure session headers to strip Electron markers and emulate desktop Chrome,
 * preventing Google from showing "This browser or app may not be secure".
 */
export function setupAuthHeaders(): void {
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders }
    if (
      details.url.includes('google.com') ||
      details.url.includes('youtube.com') ||
      details.url.includes('gstatic.com')
    ) {
      headers['User-Agent'] = CHROME_UA
      headers['sec-ch-ua'] = '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"'
      headers['sec-ch-ua-mobile'] = '?0'
      headers['sec-ch-ua-platform'] = '"Windows"'
    }
    callback({ cancel: false, requestHeaders: headers })
  })
}

/** Cookie header for music.youtube.com, taken from the app's own session. */
export async function cookieHeader(): Promise<string> {
  const cookies = await session.defaultSession.cookies.get({ url: YTM_ORIGIN })
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ')
}

export async function isSignedIn(): Promise<boolean> {
  const cookies = await session.defaultSession.cookies.get({ url: YTM_ORIGIN })
  const hasAuthCookie = cookies.some(
    (c) =>
      c.name === 'SAPISID' ||
      c.name === '__Secure-3PAPISID' ||
      c.name === 'SID' ||
      c.name === 'SSID' ||
      c.name === '__Secure-1PAPISID'
  )
  return hasAuthCookie
}

/**
 * Opens Google's sign-in page in a dedicated window with Chrome emulation.
 * Allows necessary Google authentication popups (e.g. 2FA, passkeys, account picker).
 */
export function signIn(parent: BrowserWindow): Promise<void> {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      parent,
      modal: true,
      width: 540,
      height: 740,
      minWidth: 440,
      minHeight: 600,
      autoHideMenuBar: true,
      backgroundColor: '#ffffff',
      title: 'Sign in with Google - YouTube Music',
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    win.webContents.setUserAgent(CHROME_UA)

    const check = async (url: string): Promise<void> => {
      if (url.startsWith(YTM_ORIGIN) && (await isSignedIn()) && !win.isDestroyed()) {
        win.close()
      }
    }

    win.webContents.on('did-navigate', (_e, url) => void check(url))
    win.webContents.on('did-navigate-in-page', (_e, url) => void check(url))

    // Allow Google auth popups (2FA challenge, SMS, account selector, passkeys)
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (
        url.includes('accounts.google.com') ||
        url.includes('google.com') ||
        url.includes('youtube.com')
      ) {
        return { action: 'allow' }
      }
      void shell.openExternal(url)
      return { action: 'deny' }
    })

    win.on('closed', () => resolve())
    void win.loadURL(SIGN_IN_URL, { userAgent: CHROME_UA })
  })
}

/**
 * Import raw cookie string (e.g. copied from developer tools or browser extension)
 * to allow direct 1-click authentication without entering Google credentials.
 */
export async function importCookieString(rawCookie: string): Promise<boolean> {
  if (!rawCookie || typeof rawCookie !== 'string') return false

  // Parse key=value pairs separated by semicolon or newlines
  const pairs = rawCookie
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)

  for (const pair of pairs) {
    // If it's a Netscape cookie format line: domain \t flag \t path \t secure \t expiration \t name \t value
    if (pair.includes('\t')) {
      const parts = pair.split('\t')
      if (parts.length >= 7) {
        const name = parts[5].trim()
        const value = parts[6].trim()
        if (name) {
          try {
            await session.defaultSession.cookies.set({
              url: YTM_ORIGIN,
              name,
              value,
              domain: '.youtube.com',
              path: '/',
              secure: true
            })
          } catch {
            /* ignore single cookie error */
          }
        }
      }
      continue
    }

    const idx = pair.indexOf('=')
    if (idx === -1) continue
    const name = pair.slice(0, idx).trim()
    const value = pair.slice(idx + 1).trim()
    if (!name) continue

    try {
      await session.defaultSession.cookies.set({
        url: YTM_ORIGIN,
        name,
        value,
        domain: '.youtube.com',
        path: '/',
        secure: true,
        httpOnly: name.startsWith('__Secure') || name === 'SAPISID' || name === 'SSID'
      })
    } catch {
      try {
        await session.defaultSession.cookies.set({
          url: YTM_ORIGIN,
          name,
          value
        })
      } catch {
        /* ignore */
      }
    }
  }

  return isSignedIn()
}

export async function signOut(): Promise<void> {
  await session.defaultSession.clearStorageData({ storages: ['cookies'] })
}
