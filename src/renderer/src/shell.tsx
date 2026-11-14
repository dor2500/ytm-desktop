import { useEffect, useRef, useState, type CSSProperties, type JSX } from 'react'
import type { Item } from '@shared/types'
import {
  adblockStore,
  api,
  auth,
  formatTime,
  go,
  nav,
  openAuthModal,
  setAccent,
  step,
  themeStore,
  useData,
  type AccentColor
} from './app'
import { Art, Eq } from './components'
import { Icon } from './icons'
import {
  currentOf,
  cycleRepeat,
  jump,
  next,
  player,
  previous,
  seek,
  setVolume,
  toggle,
  toggleLike,
  toggleMute,
  toggleShuffle
} from './player'

export function Sidebar(): JSX.Element {
  const route = nav.use((s) => s.stack[s.pos])
  const { signedIn, ready, name, photo } = {
    signedIn: auth.use((s) => s.signedIn),
    ready: auth.use((s) => s.ready),
    name: auth.use((s) => s.name),
    photo: auth.use((s) => s.photo)
  }
  const adblock = adblockStore.use((s) => s)
  const lib = useData('library', () => (signedIn ? api.music.library() : Promise.resolve([] as Item[])))
  const playlists = (lib.data ?? []).filter((i) => i.kind === 'playlist')
  const activeId = route.page === 'collection' ? route.id : ''

  return (
    <aside className="sidebar">
      <div className="brand drag">
        <span className="brand-mark">
          <span className="brand-pulse" />
        </span>
        <span className="brand-text">Aria</span>
        <span className="brand-badge">PRO</span>
      </div>

      <nav className="side-nav">
        <button
          className={route.page === 'home' ? 'is-active' : ''}
          onClick={() => go({ page: 'home' })}
        >
          <Icon name="home" size={19} />
          <span>Home</span>
        </button>
        <button
          className={route.page === 'library' ? 'is-active' : ''}
          onClick={() => go({ page: 'library' })}
        >
          <Icon name="library" size={19} />
          <span>Library</span>
        </button>
        <button
          className={activeId === 'LM' ? 'is-active' : ''}
          onClick={() => (signedIn ? go({ page: 'collection', kind: 'playlist', id: 'LM' }) : openAuthModal())}
        >
          <Icon name="heartFilled" size={19} />
          <span>Liked music</span>
        </button>
      </nav>

      <div className="side-label-row">
        <span className="side-label">Playlists</span>
      </div>

      <div className="side-lists">
        {!signedIn && (
          <div className="side-auth-card" onClick={openAuthModal}>
            <Icon name="google" size={16} />
            <div className="side-auth-text">
              <strong>Sign in with Google</strong>
              <span>Sync playlists & favorites</span>
            </div>
          </div>
        )}
        {playlists.map((p) => (
          <button
            key={p.id}
            className={`side-list ${activeId === p.id ? 'is-active' : ''}`}
            onClick={() => go({ page: 'collection', kind: 'playlist', id: p.id })}
            title={p.title}
          >
            <Art src={p.thumb} />
            <span dir="auto">{p.title}</span>
          </button>
        ))}
      </div>

      <div className="side-widget-wrap">
        <div
          className={`adblock-card ${adblock.enabled ? 'is-on' : 'is-off'}`}
          onClick={() => void api.adblock.toggle()}
          title="Click to toggle Ad Blocker"
        >
          <div className="adblock-head">
            <div className="adblock-status-icon">
              <Icon name={adblock.enabled ? 'shieldCheck' : 'shield'} size={16} />
            </div>
            <div className="adblock-title-col">
              <span className="adblock-title">Built-in Ad Blocker</span>
              <span className="adblock-sub">
                {adblock.enabled ? `${adblock.blockedCount} ads blocked` : 'Protection disabled'}
              </span>
            </div>
            <span className={`adblock-pill ${adblock.enabled ? 'is-active' : ''}`}>
              {adblock.enabled ? 'ACTIVE' : 'OFF'}
            </span>
          </div>
        </div>
      </div>

      <div className="side-foot">
        {ready &&
          (signedIn ? (
            <div className="side-user-bar">
              {photo ? (
                <img src={photo} alt="" className="user-avatar-img" />
              ) : (
                <div className="user-avatar-placeholder">{(name || 'G')[0].toUpperCase()}</div>
              )}
              <div className="user-meta">
                <span className="user-name" title={name || 'Google Account'}>
                  {name || 'Google Account'}
                </span>
                <span className="user-label">
                  <Icon name="google" size={10} /> Connected
                </span>
              </div>
              <button
                className="icon-btn user-signout"
                onClick={() => void api.auth.signOut()}
                title="Sign out"
              >
                <Icon name="user" size={16} />
              </button>
            </div>
          ) : (
            <button className="btn btn-google btn-full" onClick={openAuthModal}>
              <Icon name="google" size={18} /> Sign in
            </button>
          ))}
      </div>
    </aside>
  )
}

const ACCENT_OPTIONS: { id: AccentColor; label: string; color: string }[] = [
  { id: 'emerald', label: 'Emerald Neon', color: '#10b981' },
  { id: 'lime', label: 'Electric Lime', color: '#c8f560' },
  { id: 'violet', label: 'Neon Violet', color: '#a855f7' },
  { id: 'cyan', label: 'Cyber Cyan', color: '#06b6d4' },
  { id: 'rose', label: 'Sunset Rose', color: '#f43f5e' },
  { id: 'amber', label: 'Solar Amber', color: '#f59e0b' }
]

export function TopBar(): JSX.Element {
  const { stack, pos } = { stack: nav.use((s) => s.stack), pos: nav.use((s) => s.pos) }
  const route = stack[pos]
  const adblock = adblockStore.use((s) => s)
  const activeAccent = themeStore.use((s) => s.accent)
  const signedIn = auth.use((s) => s.signedIn)
  const userName = auth.use((s) => s.name)
  const userPhoto = auth.use((s) => s.photo)

  const [value, setValue] = useState(route.page === 'search' ? route.q : '')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const paletteRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (route.page === 'search') setValue(route.q)
  }, [route])

  useEffect(() => {
    const q = value.trim()
    if (!q || !open) return setSuggestions([])
    let live = true
    const timer = setTimeout(() => {
      api.music.suggest(q).then(
        (list) => live && setSuggestions(list),
        () => live && setSuggestions([])
      )
    }, 160)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [value, open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey && e.key.toLowerCase() === 'k') || (e.key === '/' && !isTyping(e))) {
        e.preventDefault()
        input.current?.focus()
        input.current?.select()
      }
    }
    const onDown = (e: MouseEvent): void => {
      if (!paletteRef.current?.contains(e.target as Node)) {
        setPaletteOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [])

  const submit = (q: string): void => {
    const query = q.trim()
    if (!query) return
    setValue(query)
    setOpen(false)
    input.current?.blur()
    go({ page: 'search', q: query })
  }

  return (
    <header className="topbar drag">
      <div className="history no-drag">
        <button
          className="icon-btn history-btn"
          disabled={pos === 0}
          onClick={() => step(-1)}
          aria-label="Back"
        >
          <Icon name="back" size={18} />
        </button>
        <button
          className="icon-btn history-btn"
          disabled={pos >= stack.length - 1}
          onClick={() => step(1)}
          aria-label="Forward"
        >
          <Icon name="forward" size={18} />
        </button>
      </div>

      <form
        className="search no-drag"
        onSubmit={(e) => {
          e.preventDefault()
          submit(value)
        }}
      >
        <Icon name="search" size={18} className="search-icon" />
        <input
          ref={input}
          value={value}
          dir="auto"
          placeholder="Search songs, albums, artists..."
          onChange={(e) => {
            setValue(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 140)}
        />
        {value ? (
          <button
            type="button"
            className="search-clear"
            onClick={() => {
              setValue('')
              input.current?.focus()
            }}
          >
            <Icon name="close" size={14} />
          </button>
        ) : (
          <kbd className="search-kbd">Ctrl K</kbd>
        )}
        {open && suggestions.length > 0 && (
          <div className="suggest">
            {suggestions.map((s) => (
              <button
                type="button"
                key={s}
                dir="auto"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => submit(s)}
              >
                <Icon name="search" size={15} /> {s}
              </button>
            ))}
          </div>
        )}
      </form>

      <div className="topbar-actions no-drag">
        {/* Ad Blocker Top Indicator */}
        <button
          className={`adblock-top-btn ${adblock.enabled ? 'is-active' : ''}`}
          onClick={() => void api.adblock.toggle()}
          title={`Ad Blocker: ${adblock.enabled ? 'Active (' + adblock.blockedCount + ' blocked)' : 'Off'}`}
        >
          <Icon name={adblock.enabled ? 'shieldCheck' : 'shield'} size={16} />
          <span className="adblock-top-text">
            {adblock.enabled ? `${adblock.blockedCount} Blocked` : 'Shield Off'}
          </span>
        </button>

        {/* Accent Color Theme Dropdown */}
        <div className="palette-wrap" ref={paletteRef}>
          <button
            className="icon-btn palette-btn"
            onClick={() => setPaletteOpen(!paletteOpen)}
            title="Change Theme Accent"
          >
            <Icon name="palette" size={18} />
          </button>
          {paletteOpen && (
            <div className="palette-menu">
              <div className="palette-title">Theme Accent</div>
              <div className="palette-grid">
                {ACCENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    className={`palette-swatch ${activeAccent === opt.id ? 'is-active' : ''}`}
                    style={{ backgroundColor: opt.color }}
                    onClick={() => {
                      setAccent(opt.id)
                      setPaletteOpen(false)
                    }}
                    title={opt.label}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Account Chip */}
        {signedIn ? (
          <div className="user-top-chip" title={userName || 'Connected Account'}>
            {userPhoto ? (
              <img src={userPhoto} alt="" className="user-top-img" />
            ) : (
              <div className="user-top-initial">{(userName || 'G')[0].toUpperCase()}</div>
            )}
          </div>
        ) : (
          <button className="btn btn-google-sm" onClick={openAuthModal}>
            <Icon name="google" size={15} /> Sign in
          </button>
        )}
      </div>
    </header>
  )
}

export const isTyping = (e: KeyboardEvent): boolean => {
  const el = e.target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}

function Range({
  value,
  max,
  onChange,
  label
}: {
  value: number
  max: number
  onChange: (v: number) => void
  label: string
}): JSX.Element {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <input
      className="range"
      type="range"
      aria-label={label}
      min={0}
      max={max || 1}
      step="any"
      value={Math.min(value, max || 1)}
      style={{ '--fill': `${pct}%` } as CSSProperties}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}

export function PlayerBar(): JSX.Element {
  const item = player.use(currentOf)
  const playing = player.use((s) => s.playing)
  const buffering = player.use((s) => s.buffering)
  const position = player.use((s) => s.position)
  const duration = player.use((s) => s.duration)
  const volume = player.use((s) => s.volume)
  const muted = player.use((s) => s.muted)
  const shuffle = player.use((s) => s.shuffle)
  const repeat = player.use((s) => s.repeat)
  const liked = player.use((s) => (item ? !!s.liked[item.id] : false))
  const [scrub, setScrub] = useState<number | null>(null)

  return (
    <footer className="playerbar">
      <div className="pb-track">
        {item ? (
          <>
            <Art src={item.thumb} className="pb-art" />
            <div className="pb-meta">
              <div className="pb-title" dir="auto" title={item.title}>
                {item.title}
              </div>
              <div className="pb-sub" dir="auto" title={item.subtitle}>
                {item.subtitle}
              </div>
            </div>
            <button
              className={`icon-btn heart-btn ${liked ? 'is-on' : ''}`}
              onClick={() => void toggleLike(item)}
              aria-label={liked ? 'Unlike' : 'Like'}
            >
              <Icon name={liked ? 'heartFilled' : 'heart'} size={18} />
            </button>
            <div className="pb-ad-free-badge" title="Protected by built-in ad blocker">
              <Icon name="shieldCheck" size={13} />
              <span>Ad-Free</span>
            </div>
          </>
        ) : (
          <div className="pb-idle">
            <span className="brand-dot" /> Choose music to begin
          </div>
        )}
      </div>

      <div className="pb-center">
        <div className="pb-controls">
          <button
            className={`icon-btn ${shuffle ? 'is-on' : ''}`}
            onClick={toggleShuffle}
            aria-label="Shuffle"
            aria-pressed={shuffle}
          >
            <Icon name="shuffle" size={17} />
          </button>
          <button
            className="icon-btn"
            onClick={previous}
            disabled={!item}
            aria-label="Previous"
          >
            <Icon name="prev" size={19} />
          </button>
          <button
            className={`play-btn ${buffering ? 'is-buffering' : ''}`}
            onClick={toggle}
            disabled={!item}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            <Icon name={playing ? 'pause' : 'play'} size={22} />
          </button>
          <button
            className="icon-btn"
            onClick={() => next()}
            disabled={!item}
            aria-label="Next"
          >
            <Icon name="next" size={19} />
          </button>
          <button
            className={`icon-btn ${repeat !== 'off' ? 'is-on' : ''}`}
            onClick={cycleRepeat}
            aria-label={`Repeat: ${repeat}`}
          >
            <Icon name="repeat" size={17} />
            {repeat === 'one' && <span className="badge">1</span>}
          </button>
        </div>
        <div className="pb-seek">
          <span className="pb-time">{formatTime(scrub ?? position)}</span>
          <div
            className="pb-seek-track"
            onPointerUp={() => {
              if (scrub !== null) seek(scrub)
              setScrub(null)
            }}
          >
            <Range label="Seek" value={scrub ?? position} max={duration} onChange={setScrub} />
          </div>
          <span className="pb-time">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="pb-right">
        <button className="icon-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
          <Icon name={muted || volume === 0 ? 'mute' : 'volume'} size={18} />
        </button>
        <div className="pb-volume">
          <Range label="Volume" value={muted ? 0 : volume} max={100} onChange={setVolume} />
        </div>
      </div>
    </footer>
  )
}

function Lyrics({ id }: { id: string }): JSX.Element {
  const { data, loading } = useData(`lyrics:${id}`, () => api.music.lyrics(id))
  if (loading) return <div className="np-empty">Loading lyrics...</div>
  if (!data) return <div className="np-empty">No lyrics found for this track.</div>
  return <pre className="lyrics" dir="auto">{data}</pre>
}

export function NowPlaying(): JSX.Element {
  const item = player.use(currentOf)
  const ad = player.use((s) => s.ad)
  const queue = player.use((s) => s.queue)
  const index = player.use((s) => s.index)
  const playing = player.use((s) => s.playing)
  const [tab, setTab] = useState<'queue' | 'lyrics'>('queue')
  const activeRow = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeRow.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [index])

  return (
    <aside className="nowplaying">
      <div className="np-drag drag" />
      <div className={`np-cover ${item ? '' : 'is-idle'}`}>
        <Art src={item?.thumb ?? ''} />
      </div>
      <div className="np-meta">
        <div className="np-title" dir="auto">
          {item?.title ?? 'Nothing playing'}
        </div>
        <div className="np-sub" dir="auto">
          {ad ? 'Advertisement blocked' : item?.subtitle ?? 'Pick a track to start playing'}
        </div>
      </div>
      <div className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'queue'}
          className={tab === 'queue' ? 'is-active' : ''}
          onClick={() => setTab('queue')}
        >
          Up next
        </button>
        <button
          role="tab"
          aria-selected={tab === 'lyrics'}
          className={tab === 'lyrics' ? 'is-active' : ''}
          onClick={() => setTab('lyrics')}
        >
          Lyrics
        </button>
      </div>
      <div className="np-body">
        {tab === 'lyrics' ? (
          item ? <Lyrics id={item.id} /> : <div className="np-empty">Play a song to view lyrics.</div>
        ) : queue.length ? (
          queue.map((q, i) => (
            <button
              key={`${q.id}:${i}`}
              ref={i === index ? activeRow : undefined}
              className={`q-row ${i === index ? 'is-active' : ''} ${i < index ? 'is-past' : ''}`}
              onClick={() => jump(i)}
            >
              <Art src={q.thumb} />
              <span className="q-text">
                <span className="q-title" dir="auto">
                  {q.title}
                </span>
                <span className="q-sub" dir="auto">
                  {q.subtitle}
                </span>
              </span>
              {i === index && playing ? (
                <Eq />
              ) : (
                <span className="q-time">{q.duration ? formatTime(q.duration) : ''}</span>
              )}
            </button>
          ))
        ) : (
          <div className="np-empty">The queue is empty.</div>
        )}
      </div>
    </aside>
  )
}
