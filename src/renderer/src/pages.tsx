import type { JSX } from 'react'
import type { Collection, Item } from '@shared/types'
import { api, auth, go, useData, type Route } from './app'
import { Art, Card, ShelfRow, SignInPrompt, Status, TrackList } from './components'
import { Icon } from './icons'
import { playQueue, player } from './player'

function greeting(): string {
  const h = new Date().getHours()
  return h < 5 ? 'Late night vibes' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

const MOODS = ['Relax', 'Workout', 'Focus', 'Energize', 'Commute', 'Party', 'Acoustic', 'Chill']

function Home(): JSX.Element {
  const { data, loading, error } = useData('home', api.music.home)
  const userName = auth.use((s) => s.name)
  const firstName = userName ? userName.split(' ')[0] : ''

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">
          {greeting()}
          {firstName ? <span className="greeting-name">, {firstName}</span> : ''}
        </h1>
        <div className="mood-chips">
          {MOODS.map((m) => (
            <button
              key={m}
              className="mood-chip"
              onClick={() => go({ page: 'search', q: `${m} music` })}
            >
              {m}
            </button>
          ))}
        </div>
      </header>
      <Status loading={loading} error={error} empty={data && !data.length ? 'Nothing to show yet.' : undefined} />
      {data?.map((shelf, i) => (
        <ShelfRow key={`${shelf.title}:${i}`} shelf={shelf} />
      ))}
    </div>
  )
}

function Search({ q }: { q: string }): JSX.Element {
  const { data, loading, error } = useData(`search:${q}`, () => api.music.search(q))
  const shelves = data?.shelves ?? []
  return (
    <div className="page">
      <h1 className="page-title">
        <span className="muted">Results for</span> <span dir="auto" className="search-query-highlight">"{q}"</span>
      </h1>
      <Status loading={loading} error={error} empty={data && !shelves.length ? 'No results found.' : undefined} />
      {shelves.map((shelf) =>
        shelf.items.every((i) => i.kind === 'song' || i.kind === 'video') ? (
          <section className="shelf" key={shelf.title}>
            <header className="shelf-head">
              <h2>{shelf.title}</h2>
            </header>
            <TrackList tracks={shelf.items.slice(0, 10)} />
          </section>
        ) : (
          <ShelfRow key={shelf.title} shelf={shelf} />
        )
      )}
    </div>
  )
}

const LIKED: Item = { kind: 'playlist', id: 'LM', title: 'Liked music', subtitle: 'Auto playlist', thumb: '' }

function Library(): JSX.Element {
  const signedIn = auth.use((s) => s.signedIn)
  const { data, loading, error } = useData('library', () =>
    signedIn ? api.music.library() : Promise.resolve([] as Item[])
  )
  if (!signedIn) {
    return (
      <div className="page">
        <h1 className="page-title">Your Library</h1>
        <SignInPrompt>
          Connect your Google Account to access your library, personal playlists, liked tracks, and subscribed artists.
        </SignInPrompt>
      </div>
    )
  }
  const items = data ?? []
  const hasLiked = items.some((i) => /^(VL)?LM$/.test(i.id))
  return (
    <div className="page">
      <h1 className="page-title">Your Library</h1>
      <Status loading={loading} error={error} />
      {data && (
        <div className="grid">
          {!hasLiked && <Card item={LIKED} />}
          {items.map((item, i) => (
            <Card key={`${item.kind}:${item.id}:${i}`} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function CollectionPage({ kind, id }: { kind: Collection['kind']; id: string }): JSX.Element {
  const { data, loading, error } = useData(`${kind}:${id}`, () => api.music[kind](id))
  const shuffle = (): void => {
    if (!data?.tracks.length) return
    player.set({ shuffle: true })
    playQueue(data.tracks, Math.floor(Math.random() * data.tracks.length))
  }
  return (
    <div className="page">
      <Status loading={loading} error={error} />
      {data && (
        <>
          <header className={`hero hero-${kind}`}>
            <Art src={data.thumb} round={kind === 'artist'} className="hero-art" />
            <div className="hero-text">
              <div className="eyebrow">{kind}</div>
              <h1 dir="auto">{data.title || (id === 'LM' ? 'Liked music' : '')}</h1>
              {data.subtitle && <div className="hero-sub" dir="auto">{data.subtitle}</div>}
              {data.description && <p className="hero-desc" dir="auto">{data.description}</p>}
              {data.tracks.length > 0 && (
                <div className="hero-actions">
                  <button className="btn btn-accent btn-play-hero" onClick={() => playQueue(data.tracks, 0)}>
                    <Icon name="play" size={20} /> Play
                  </button>
                  <button className="btn btn-secondary" onClick={shuffle}>
                    <Icon name="shuffle" size={18} /> Shuffle
                  </button>
                </div>
              )}
            </div>
          </header>
          {data.tracks.length > 0 && (
            <section className="shelf">
              {kind === 'artist' && (
                <header className="shelf-head">
                  <h2>Top songs</h2>
                </header>
              )}
              <TrackList tracks={data.tracks} numbered={kind === 'album'} />
            </section>
          )}
          {data.shelves.map((shelf, i) => (
            <ShelfRow key={`${shelf.title}:${i}`} shelf={shelf} />
          ))}
          {!data.tracks.length && !data.shelves.length && <Status empty="This collection is empty." />}
        </>
      )}
    </div>
  )
}

export function Page({ route }: { route: Route }): JSX.Element {
  switch (route.page) {
    case 'home':
      return <Home />
    case 'library':
      return <Library />
    case 'search':
      return <Search q={route.q} />
    case 'collection':
      return <CollectionPage kind={route.kind} id={route.id} />
  }
}
