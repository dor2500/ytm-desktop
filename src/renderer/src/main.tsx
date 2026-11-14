import { StrictMode, useEffect, useRef, type JSX } from 'react'
import { createRoot } from 'react-dom/client'
import { authModalStore, closeAuthModal, nav, routeKey } from './app'
import { AuthModal } from './AuthModal'
import { Page } from './pages'
import { currentOf, next, player, previous, toggle } from './player'
import { isTyping, NowPlaying, PlayerBar, Sidebar, TopBar } from './shell'
import './styles.css'

/** Tint the app with the average colour of the current artwork. */
function useAmbient(src: string | undefined): void {
  useEffect(() => {
    const root = document.documentElement
    if (!src) {
      root.style.removeProperty('--ambient')
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = c.height = 12
        const ctx = c.getContext('2d')!
        ctx.drawImage(img, 0, 0, 12, 12)
        const d = ctx.getImageData(0, 0, 12, 12).data
        let r = 0, g = 0, b = 0, w = 0
        for (let i = 0; i < d.length; i += 4) {
          // Weight saturated pixels so grey borders don't wash the tint out.
          const sat = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) + 8
          r += d[i] * sat; g += d[i + 1] * sat; b += d[i + 2] * sat; w += sat
        }
        root.style.setProperty('--ambient', `${Math.round(r / w)} ${Math.round(g / w)} ${Math.round(b / w)}`)
      } catch {
        root.style.removeProperty('--ambient')
      }
    }
    img.onerror = () => root.style.removeProperty('--ambient')
    img.src = src
  }, [src])
}

function App(): JSX.Element {
  const route = nav.use((s) => s.stack[s.pos])
  const thumb = player.use((s) => currentOf(s)?.thumb)
  const notice = player.use((s) => s.notice)
  const authModalOpen = authModalStore.use((s) => s.open)
  const main = useRef<HTMLElement>(null)
  useAmbient(thumb)

  useEffect(() => {
    main.current?.scrollTo({ top: 0 })
  }, [route])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (isTyping(e) || e.ctrlKey || e.altKey || e.metaKey) return
      if (e.code === 'Space') {
        e.preventDefault()
        toggle()
      } else if (e.shiftKey && e.key === 'N') next()
      else if (e.shiftKey && e.key === 'P') previous()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app">
      <Sidebar />
      <div className="center">
        <TopBar />
        <main className="main" ref={main}>
          <Page key={routeKey(route)} route={route} />
        </main>
      </div>
      <NowPlaying />
      <PlayerBar />
      {notice && <div className="toast" role="status">{notice}</div>}
      {authModalOpen && <AuthModal onClose={closeAuthModal} />}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
