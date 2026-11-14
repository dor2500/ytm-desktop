import { useState, type JSX } from 'react'
import { api, auth } from './app'
import { Icon } from './icons'

export function AuthModal({ onClose }: { onClose: () => void }): JSX.Element {
  const [tab, setTab] = useState<'google' | 'cookie'>('google')
  const [cookieText, setCookieText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleGoogleSignIn = async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      await api.auth.signIn()
      const state = await api.auth.state()
      if (state.signedIn) {
        setSuccess(true)
        setTimeout(() => onClose(), 800)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleCookieImport = async (): Promise<void> => {
    if (!cookieText.trim()) {
      setError('Please paste your cookie string.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const state = await api.auth.importCookies(cookieText.trim())
      if (state.signedIn) {
        setSuccess(true)
        setTimeout(() => onClose(), 800)
      } else {
        setError('Could not verify login with provided cookies. Ensure they contain SAPISID or SID.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div className="modal-title-wrap">
            <span className="brand-dot" />
            <h2 className="modal-title">Connect Account</h2>
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
            <Icon name="google" size={16} /> Google Sign-in
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
              <h3>Successfully Connected!</h3>
              <p>Your library, playlists, and recommendations are now synced.</p>
            </div>
          ) : tab === 'google' ? (
            <div className="auth-pane">
              <p className="auth-desc">
                Sign in directly via Google to access your private playlists, liked songs, albums, and personalized recommendations.
              </p>
              <div className="auth-feature-pills">
                <span className="feature-pill">
                  <Icon name="shieldCheck" size={14} /> Official Google OAuth
                </span>
                <span className="feature-pill">
                  <Icon name="shield" size={14} /> Zero credentials stored
                </span>
              </div>
              <button
                className="btn btn-google btn-lg"
                onClick={() => void handleGoogleSignIn()}
                disabled={loading}
              >
                <Icon name="google" size={20} />
                {loading ? 'Waiting for sign-in...' : 'Sign in with Google'}
              </button>
              <div className="auth-hint">
                A secure Google login popup will open. Once completed, this window closes automatically.
              </div>
            </div>
          ) : (
            <div className="auth-pane">
              <p className="auth-desc">
                Already signed in on your regular browser (Chrome, Edge, Firefox)? Paste your cookie header to connect instantly without entering your password.
              </p>
              <div className="cookie-steps">
                <ol>
                  <li>Open <code>music.youtube.com</code> in your browser</li>
                  <li>Press <code>F12</code> &rarr; Network tab &rarr; Click any request &rarr; Copy <code>Cookie</code> header</li>
                  <li>Paste below and click Import</li>
                </ol>
              </div>
              <textarea
                className="cookie-input"
                rows={4}
                placeholder="Paste Cookie: SAPISID=...; __Secure-3PAPISID=...; or full header..."
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
