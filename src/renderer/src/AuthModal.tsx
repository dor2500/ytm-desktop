import { useState, type JSX } from 'react'
import { api } from './app'
import { Icon } from './icons'

export function AuthModal({ onClose }: { onClose: () => void }): JSX.Element {
  const [tab, setTab] = useState<'google' | 'cookie'>('google')
  const [cookieText, setCookieText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [copyNotice, setCopyNotice] = useState(false)

  const handleGoogleSignIn = async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      await api.auth.signIn()
      const state = await api.auth.state()
      if (state.signedIn) {
        setSuccess(true)
        setTimeout(() => onClose(), 800)
      } else {
        setError('Sign-in window closed. If Google blocked sign-in, try the 1-click Browser Cookie tab.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleCookieImport = async (textToImport?: string): Promise<void> => {
    const raw = (textToImport !== undefined ? textToImport : cookieText).trim()
    if (!raw) {
      setError('Please paste your cookie string.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const state = await api.auth.importCookies(raw)
      if (state.signedIn) {
        setSuccess(true)
        setTimeout(() => onClose(), 800)
      } else {
        setError('Could not verify login with provided cookies. Ensure they contain SAPISID, SID, or full cookie header.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const handlePasteClipboard = async (): Promise<void> => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setCookieText(text)
        await handleCookieImport(text)
      } else {
        setError('Clipboard is empty.')
      }
    } catch {
      setError('Could not access clipboard. Please paste manually into the box below.')
    }
  }

  const handleCopyHelper = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText('copy(document.cookie)')
      setCopyNotice(true)
      setTimeout(() => setCopyNotice(false), 2500)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div className="modal-title-wrap">
            <span className="brand-dot" />
            <h2 className="modal-title">Connect Google Account</h2>
          </div>
          <button className="icon-btn modal-close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </header>

        <div className="modal-tabs">
          <button
            className={`modal-tab ${tab === 'google' ? 'is-active' : ''}`}
            onClick={() => {
              setTab('google')
              setError('')
            }}
          >
            <Icon name="google" size={16} /> Direct Sign-in
          </button>
          <button
            className={`modal-tab ${tab === 'cookie' ? 'is-active' : ''}`}
            onClick={() => {
              setTab('cookie')
              setError('')
            }}
          >
            <Icon name="cookie" size={16} /> Browser Cookie Import
          </button>
        </div>

        <div className="modal-body">
          {success ? (
            <div className="auth-success">
              <span className="success-icon">
                <Icon name="check" size={28} />
              </span>
              <h3>Successfully Connected! / החיבור בוצע בהצלחה!</h3>
              <p>Your library, playlists, and recommendations are now synced.</p>
            </div>
          ) : tab === 'google' ? (
            <div className="auth-pane">
              <p className="auth-desc">
                Sign in directly via Google to access your private playlists, liked songs, albums, and personalized recommendations.
              </p>
              <div className="auth-feature-pills">
                <span className="feature-pill">
                  <Icon name="shieldCheck" size={14} /> Official Google Auth
                </span>
                <span className="feature-pill">
                  <Icon name="shield" size={14} /> Anti-BotGuard Bypass
                </span>
                <span className="feature-pill">
                  <Icon name="ytm" size={14} /> Full Library Sync
                </span>
              </div>
              <button
                className="btn btn-google btn-lg"
                onClick={() => void handleGoogleSignIn()}
                disabled={loading}
              >
                <Icon name="google" size={20} />
                {loading ? 'Signing in...' : 'Sign in with Google'}
              </button>
              <div className="auth-hint">
                A secure sign-in window will open. If Google displays <em>"This browser or app may not be secure"</em>, simply switch to the <strong>Browser Cookie Import</strong> tab above for an instant 1-click connection.
              </div>
            </div>
          ) : (
            <div className="auth-pane">
              <p className="auth-desc">
                Already signed into YouTube Music in your Chrome, Edge, or Brave browser? Connect instantly using your active session with zero password prompt.
              </p>

              <div className="cookie-steps">
                <ol>
                  <li>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ marginInlineEnd: 8, padding: '4px 10px' }}
                      onClick={() => void api.auth.openExternal('https://music.youtube.com')}
                    >
                      <Icon name="external" size={14} /> Open music.youtube.com
                    </button>
                    Open YouTube Music in your browser.
                  </li>
                  <li>
                    In your browser, press <code>F12</code> &rarr; Console &rarr; type{' '}
                    <code
                      style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}
                      onClick={() => void handleCopyHelper()}
                      title="Click to copy command"
                    >
                      copy(document.cookie)
                    </code>{' '}
                    and hit Enter {copyNotice ? <span style={{ color: 'var(--c-accent)' }}>(Copied!)</span> : ''}
                  </li>
                  <li>Click below to paste and connect!</li>
                </ol>
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => void handlePasteClipboard()}
                  disabled={loading}
                >
                  <Icon name="check" size={16} />
                  Paste from Clipboard & Connect
                </button>
              </div>

              <textarea
                className="cookie-input"
                rows={3}
                placeholder="Or paste cookie string / JSON directly here (SAPISID=...; SID=...)..."
                value={cookieText}
                onChange={(e) => setCookieText(e.target.value)}
                disabled={loading}
              />

              <button
                className="btn btn-accent btn-lg"
                onClick={() => void handleCookieImport()}
                disabled={loading || !cookieText.trim()}
              >
                <Icon name="check" size={18} />
                {loading ? 'Verifying Session...' : 'Import & Connect'}
              </button>
            </div>
          )}

          {error && <div className="auth-error-banner">{error}</div>}
        </div>
      </div>
    </div>
  )
}
