import { BrowserWindow, session, shell } from 'electron'

const YTM_ORIGIN = 'https://music.youtube.com'
const SIGN_IN_URL =
  'https://accounts.google.com/ServiceLogin?service=youtube&passive=true&continue=' +
  encodeURIComponent(YTM_ORIGIN + '/')

/**
 * Standard Desktop Chrome UA matching Chromium version without Electron or custom tokens.
 */
const CHROMIUM_MAJOR = (process.versions.chrome || '133').split('.')[0]
export const CHROME_UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR}.0.0.0 Safari/537.36`

/** webContents ids of the sign-in window and any popups it opens. */
const loginContents = new Set<number>()

/**
 * Configure request headers to appear as a standard desktop Chrome browser,
 * eliminating Electron tokens and maintaining browser integrity for BotGuard.
 */
export function setupAuthHeaders(): void {
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders }
    if (/^https:\/\/([^/]+\.)?(google|youtube|gstatic)\.com\//.test(details.url)) {
      headers['User-Agent'] = CHROME_UA
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
 * Opens Google's sign-in page in a dedicated window.
 * Clears any prior rejection storage and uses standard Chrome emulation.
 */
export async function signIn(parent: BrowserWindow): Promise<void> {
  // Clear any previous rejection cookies and cache from accounts.google.com
  try {
    await session.defaultSession.clearStorageData({
      origin: 'https://accounts.google.com',
      storages: ['cookies', 'localstorage', 'cachestorage']
    })
  } catch {
    /* ignore */
  }

  return new Promise((resolve) => {
    const win = new BrowserWindow({
      parent,
      modal: true,
      width: 540,
      height: 740,
      minWidth: 440,
      minHeight: 600,
      autoHideMenuBar: true,
      backgroundColor: '#121216',
      title: 'Sign in - Google Accounts',
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    const id = win.webContents.id
    loginContents.add(id)
    win.webContents.setUserAgent(CHROME_UA)

    win.webContents.on('did-create-window', (child) => {
      const childId = child.webContents.id
      loginContents.add(childId)
      child.webContents.setUserAgent(CHROME_UA)
      child.on('closed', () => loginContents.delete(childId))
    })

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

    win.on('closed', () => {
      loginContents.delete(id)
      resolve()
    })

    void win.loadURL(SIGN_IN_URL, { userAgent: CHROME_UA })
  })
}

/**
 * Import raw cookie string (e.g. copied from developer tools, extension JSON, or document.cookie)
 * to allow direct 1-click authentication without entering Google credentials.
 */
export async function importCookieString(rawCookie: string): Promise<boolean> {
  if (!rawCookie || typeof rawCookie !== 'string') return false
  const trimmed = rawCookie.trim()
  if (!trimmed) return false

  // 1. Check if JSON format (e.g., exported by Cookie-Editor / EditThisCookie)
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const list = JSON.parse(trimmed)
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item && item.name && item.value) {
            const domain = (item.domain || '.youtube.com').replace(/^\./, '')
            try {
              await session.defaultSession.cookies.set({
                url: `https://${domain}`,
                name: String(item.name),
                value: String(item.value),
                domain: `.${domain}`,
                path: item.path || '/',
                secure: item.secure ?? true,
                httpOnly: item.httpOnly ?? false,
                sameSite: 'no_restriction'
              })
              await session.defaultSession.cookies.set({
                url: YTM_ORIGIN,
                name: String(item.name),
                value: String(item.value),
                domain: '.youtube.com',
                path: '/',
                secure: true
              })
            } catch {
              /* ignore single cookie error */
            }
          }
        }
        await session.defaultSession.cookies.flushStore()
        return isSignedIn()
      }
    } catch {
      /* not valid JSON, proceed to standard parsing */
    }
  }

  // 2. Parse key=value pairs separated by semicolon or newlines or Netscape TSV lines
  const lines = trimmed.split(/[\r\n]+/)
  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine || trimmedLine.startsWith('#')) continue

    // Netscape format: domain \t flag \t path \t secure \t expiration \t name \t value
    if (trimmedLine.includes('\t')) {
      const parts = trimmedLine.split('\t')
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

    // Standard "cookie: name=value; name2=value2" or "name=value"
    const cleaned = trimmedLine.replace(/^cookie:\s*/i, '')
    const pairs = cleaned.split(';')
    for (const pair of pairs) {
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
          sameSite: 'no_restriction'
        })
        if (name.includes('SID') || name.startsWith('__Secure')) {
          await session.defaultSession.cookies.set({
            url: 'https://google.com',
            name,
            value,
            domain: '.google.com',
            path: '/',
            secure: true,
            sameSite: 'no_restriction'
          }).catch(() => undefined)
        }
      } catch {
        /* ignore */
      }
    }
  }

  await session.defaultSession.cookies.flushStore()
  return isSignedIn()
}

export async function signOut(): Promise<void> {
  await session.defaultSession.clearStorageData({ storages: ['cookies', 'localstorage', 'cachestorage'] })
}
