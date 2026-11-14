import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react'
import type { Item, Shelf } from '@shared/types'
import { api, auth, cleanError, formatTime, go, invalidate, openAuthModal, openCollection, useData } from './app'
import { Icon } from './icons'
import { currentOf, enqueue, notify, playItem, playNext, playQueue, player } from './player'

export function Art({ src, round, className = '' }: { src: string; round?: boolean; className?: string }): JSX.Element {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  return (
    <div className={`art ${round ? 'art-round' : ''} ${className}`}>
      {src && !failed && <img src={src} alt="" loading="lazy" draggable={false} onError={() => setFailed(true)} />}
    </div>
  )
}

export function Status({ loading, error, empty }: { loading?: boolean; error?: string; empty?: string }): JSX.Element | null {
  if (loading) return <div className="status"><span className="spinner" />Loading</div>
  if (error) return <div className="status status-error">Couldn’t load this. {error}</div>
  if (empty) return <div className="status">{empty}</div>
  return null
}

const isTrack = (i: Item): boolean => i.kind === 'song' || i.kind === 'video'

export function open(item: Item, siblings?: Item[]): void {
  if (!isTrack(item)) return openCollection(item)
  const tracks = siblings?.filter(isTrack)
  // A lone song starts a radio; a song inside a track list plays that list.
  if (tracks && tracks.length > 1 && tracks.length === siblings?.length) playQueue(tracks, tracks.indexOf(item))
  else playItem(item)
}

export function Card({ item, siblings }: { item: Item; siblings?: Item[] }): JSX.Element {
  const track = isTrack(item)
  return (
    <button className="card" onClick={() => open(item, siblings)} title={item.title}>
      <div className="card-art">
        <Art src={item.thumb} round={item.kind === 'artist'} />
        {track && (
          <span className="card-play">
            <Icon name="play" size={22} />
          </span>
        )}
      </div>
      <div className="card-title" dir="auto">{item.title}</div>
      <div className="card-sub" dir="auto">{item.subtitle}</div>
    </button>
  )
}

export function ShelfRow({ shelf }: { shelf: Shelf }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const scroll = (dir: number): void => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' })
  return (
    <section className="shelf">
      <header className="shelf-head">
        <h2 dir="auto">{shelf.title}</h2>
        <div className="shelf-nav">
          <button className="icon-btn" onClick={() => scroll(-1)} aria-label="Scroll left"><Icon name="back" size={18} /></button>
          <button className="icon-btn" onClick={() => scroll(1)} aria-label="Scroll right"><Icon name="forward" size={18} /></button>
        </div>
      </header>
      <div className="shelf-row" ref={ref}>
        {shelf.items.map((item, i) => (
          <Card key={`${item.kind}:${item.id}:${i}`} item={item} siblings={shelf.items} />
        ))}
      </div>
    </section>
  )
}

function Menu({ item, close }: { item: Item; close: () => void }): JSX.Element {
  const signedIn = auth.use((s) => s.signedIn)
  const lib = useData('library', () => (signedIn ? api.music.library() : Promise.resolve([] as Item[])))
  const playlists = (lib.data ?? []).filter((i) => i.kind === 'playlist' && !/^VL(LM|SE|RD)/.test(i.id))
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [close])

  const add = async (playlist: Item): Promise<void> => {
    close()
    try {
      await api.music.addToPlaylist(playlist.id, item.id)
      invalidate(`playlist:${playlist.id}`)
      notify(`Added to ${playlist.title}`)
    } catch (err) {
      notify(`Couldn’t add to playlist. ${cleanError(err)}`)
    }
  }
  const act = (fn: () => void) => () => {
    close()
    fn()
  }
  const artist = item.artists?.find((a) => a.id)

  return (
    <div className="menu" ref={ref} role="menu">
      <button role="menuitem" onClick={act(() => playNext(item))}>Play next</button>
      <button role="menuitem" onClick={act(() => enqueue(item))}>Add to queue</button>
      {artist && <button role="menuitem" onClick={act(() => go({ page: 'collection', kind: 'artist', id: artist.id! }))}>Go to artist</button>}
      {item.album?.id && <button role="menuitem" onClick={act(() => go({ page: 'collection', kind: 'album', id: item.album!.id! }))}>Go to album</button>}
      {signedIn && playlists.length > 0 && (
        <>
          <div className="menu-label">Add to playlist</div>
          <div className="menu-scroll">
            {playlists.map((p) => (
              <button key={p.id} role="menuitem" dir="auto" onClick={() => void add(p)}>{p.title}</button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function TrackList({ tracks, numbered, compact }: { tracks: Item[]; numbered?: boolean; compact?: boolean }): JSX.Element {
  const currentId = player.use((s) => currentOf(s)?.id)
  const playing = player.use((s) => s.playing)
  const [menuFor, setMenuFor] = useState<number | null>(null)
  return (
    <div className={`tracks ${compact ? 'tracks-compact' : ''}`}>
      {tracks.map((t, i) => {
        const active = t.id === currentId
        return (
          <div
            key={`${t.id}:${i}`}
            className={`track ${active ? 'is-active' : ''}`}
            onDoubleClick={() => playQueue(tracks, i)}
          >
            <button className="track-lead" onClick={() => playQueue(tracks, i)} aria-label={`Play ${t.title}`}>
              {numbered ? <span className="track-num">{active && playing ? <Eq /> : i + 1}</span> : <Art src={t.thumb} />}
              <span className="track-play"><Icon name="play" size={16} /></span>
            </button>
            <div className="track-main">
              <div className="track-title" dir="auto">{t.title}</div>
              <div className="track-sub" dir="auto">{t.subtitle}</div>
            </div>
            <div className="track-time">{t.duration ? formatTime(t.duration) : ''}</div>
            <div className="track-more">
              <button className="icon-btn" onClick={() => setMenuFor(menuFor === i ? null : i)} aria-label="More actions">
                <Icon name="more" size={18} />
              </button>
              {menuFor === i && <Menu item={t} close={() => setMenuFor(null)} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function Eq(): JSX.Element {
  return (
    <span className="eq" aria-label="Playing">
      <i /><i /><i />
    </span>
  )
}

export function SignInPrompt({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="prompt">
      <div className="prompt-icon">
        <Icon name="google" size={28} />
      </div>
      <p>{children}</p>
      <div className="prompt-actions">
        <button className="btn btn-google" onClick={openAuthModal}>
          <Icon name="google" size={18} /> Sign in with Google
        </button>
      </div>
    </div>
  )
}
