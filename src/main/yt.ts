import { Innertube } from 'youtubei.js'
import type { Collection, Item, ItemKind, Ref, SearchResult, Shelf } from '@shared/types'
import { cookieHeader } from './auth'

/* eslint-disable @typescript-eslint/no-explicit-any */
// InnerTube responses are loosely shaped and vary by surface, so the
// normalisers below read them defensively and emit the strict shared DTOs.

let client: Promise<Innertube> | null = null
let userAgent = ''

export function configure(ua: string): void {
  userAgent = ua
}

/** Drop the cached client so the next call picks up new cookies. */
export function reset(): void {
  client = null
}

function yt(): Promise<Innertube> {
  if (!client) {
    client = (async () => {
      const cookie = await cookieHeader()
      return Innertube.create({
        cookie: cookie || undefined,
        // The parser keys off English strings ("Song", "views"), so pin the language.
        lang: 'en',
        user_agent: userAgent || undefined,
        // Streams are played by the IFrame player; no need to fetch/decipher player JS.
        retrieve_player: false
      })
    })()
    client.catch(() => (client = null))
  }
  return client
}

const text = (t: any): string => (t == null ? '' : typeof t === 'string' ? t : String(t.toString?.() ?? ''))

function thumbOf(source: any): string {
  const list: any[] = Array.isArray(source) ? source : (source?.contents ?? [])
  if (!list.length) return ''
  const best = list.reduce((a, b) => ((b?.width ?? 0) > (a?.width ?? 0) ? b : a))
  const url: string = best?.url ?? ''
  // Google-hosted art carries its size in the URL suffix; ask for a sharper one.
  return url.replace(/=w\d+-h\d+(-[^=]*)?$/, '=w544-h544-l90-rj')
}

const refs = (list: any[] | undefined): Ref[] | undefined =>
  list?.length ? list.map((a) => ({ name: a.name, id: a.channel_id })) : undefined

function fromListItem(n: any): Item | null {
  const type: string | undefined = n.item_type
  // The second column is the line YouTube Music itself shows under the title.
  // The typed fields are not always populated (album rows, mixed search), so
  // it is the fallback for display text.
  const secondary = text(n.flex_columns?.[1]?.title)
  if (type === 'song' || type === 'video' || type === 'non_music_track') {
    if (!n.id) return null
    const artists = refs(n.artists?.length ? n.artists : n.authors)
    const album: Ref | undefined = n.album ? { name: n.album.name, id: n.album.id } : undefined
    return {
      kind: type === 'video' ? 'video' : 'song',
      id: n.id,
      title: n.title ?? '',
      subtitle:
        [artists?.map((a) => a.name).join(', '), album?.name].filter(Boolean).join(' • ') || secondary,
      thumb: thumbOf(n.thumbnails),
      duration: n.duration?.seconds,
      artists,
      album
    }
  }
  const map: Record<string, ItemKind> = {
    album: 'album',
    playlist: 'playlist',
    artist: 'artist',
    library_artist: 'artist'
  }
  const kind = type ? map[type] : undefined
  if (!kind || !n.id) return null
  return {
    kind,
    id: n.id,
    title: n.title ?? n.name ?? '',
    subtitle: secondary || text(n.subtitle) || n.author?.name || '',
    thumb: thumbOf(n.thumbnails)
  }
}

function fromTwoRow(n: any): Item | null {
  const payload = n.endpoint?.payload ?? {}
  const base = { title: text(n.title), subtitle: text(n.subtitle), thumb: thumbOf(n.thumbnail) }
  switch (n.item_type) {
    case 'album':
    case 'playlist':
    case 'artist':
      return n.id ? { kind: n.item_type, id: n.id, ...base, artists: refs(n.artists) } : null
    case 'song':
    case 'video':
      return payload.videoId
        ? { kind: n.item_type, id: payload.videoId, playlistId: payload.playlistId, ...base }
        : null
    case 'endpoint':
      // Mixes and radios: a watch endpoint, sometimes with only a playlist id.
      if (payload.videoId) return { kind: 'song', id: payload.videoId, playlistId: payload.playlistId, ...base }
      if (payload.playlistId) return { kind: 'playlist', id: payload.playlistId, ...base }
      return null
    default:
      return null
  }
}

function fromPanelVideo(n: any): Item | null {
  if (!n?.video_id) return null
  const artists = refs(n.artists)
  return {
    kind: 'song',
    id: n.video_id,
    title: text(n.title),
    subtitle: artists?.map((a) => a.name).join(', ') || n.author || '',
    thumb: thumbOf(n.thumbnail),
    duration: n.duration?.seconds,
    artists,
    album: n.album ? { name: n.album.name, id: n.album.id } : undefined
  }
}

function toItem(n: any): Item | null {
  switch (n?.type) {
    case 'MusicResponsiveListItem':
      return fromListItem(n)
    case 'MusicTwoRowItem':
      return fromTwoRow(n)
    case 'PlaylistPanelVideo':
      return fromPanelVideo(n)
    case 'PlaylistPanelVideoWrapper':
      return fromPanelVideo(n.primary)
    default:
      return null
  }
}

const toItems = (nodes: any): Item[] =>
  (Array.from(nodes ?? []) as any[]).map(toItem).filter((i): i is Item => !!i && !!i.title)

function toShelf(n: any): Shelf | null {
  const title = text(n?.header?.title ?? n?.title)
  const items = toItems(n?.contents ?? n?.items)
  return items.length ? { title, items } : null
}

const toShelves = (nodes: any): Shelf[] =>
  (Array.from(nodes ?? []) as any[]).map(toShelf).filter((s): s is Shelf => !!s)

function headerOf(h: any): Pick<Collection, 'title' | 'subtitle' | 'description' | 'thumb'> {
  if (!h) return { title: '', subtitle: '', description: '', thumb: '' }
  if (h.type === 'MusicEditablePlaylistDetailHeader') return headerOf(h.header)
  const subtitle = [h.strapline_text_one, h.subtitle, h.second_subtitle]
    .map(text)
    // youtubei.js renders an absent run as the literal "N/A".
    .filter((part) => part && part !== 'N/A')
    .join(' • ')
  const description = h.description?.type === 'MusicDescriptionShelf' ? text(h.description.description) : text(h.description)
  const thumb = thumbOf(h.thumbnail) || thumbOf(h.thumbnails) || thumbOf(h.foreground_thumbnail)
  return { title: text(h.title), subtitle, description, thumb }
}

export async function home(): Promise<Shelf[]> {
  const y = await yt()
  let feed = await y.music.getHomeFeed()
  const shelves = toShelves(feed.sections)
  // One continuation is enough to fill the page without a slow first paint.
  if (feed.has_continuation) {
    try {
      feed = await feed.getContinuation()
      shelves.push(...toShelves(feed.sections))
    } catch {
      /* partial home feed is still useful */
    }
  }
  return shelves
}

export async function search(query: string): Promise<SearchResult> {
  const y = await yt()
  // The unfiltered search page comes back as a flat list with artist and album
  // fields unparsed, so run one filtered search per category instead.
  const types = ['song', 'album', 'artist', 'playlist', 'video'] as const
  const titles = { song: 'Songs', album: 'Albums', artist: 'Artists', playlist: 'Playlists', video: 'Videos' }
  const results = await Promise.allSettled(types.map((type) => y.music.search(query, { type })))
  const shelves: Shelf[] = []
  results.forEach((r, i) => {
    if (r.status !== 'fulfilled') return
    const items = (Array.from(r.value.contents ?? []) as any[]).flatMap((c) => toItems(c?.contents))
    if (items.length) shelves.push({ title: titles[types[i]], items })
  })
  if (!shelves.length && results.every((r) => r.status === 'rejected')) {
    throw (results[0] as PromiseRejectedResult).reason
  }
  return { shelves }
}

export async function suggest(query: string): Promise<string[]> {
  if (!query.trim()) return []
  const y = await yt()
  const sections = await y.music.getSearchSuggestions(query)
  const out: string[] = []
  for (const section of sections as any) {
    for (const entry of section?.contents ?? []) {
      const s = text(entry?.suggestion)
      if (s) out.push(s)
    }
  }
  return out.slice(0, 8)
}

export async function library(): Promise<Item[]> {
  const y = await yt()
  const lib = await y.music.getLibrary()
  const items: Item[] = []
  for (const block of (lib.contents ?? []) as any) items.push(...toItems(block?.items ?? block?.contents))
  return items
}

export async function playlist(id: string): Promise<Collection> {
  const y = await yt()
  let page = await y.music.getPlaylist(id)
  const head = headerOf(page.header)
  const tracks = toItems(page.items)
  for (let i = 0; i < 9 && page.has_continuation; i++) {
    try {
      page = await page.getContinuation()
      tracks.push(...toItems(page.items))
    } catch {
      break
    }
  }
  return { id, kind: 'playlist', ...head, tracks, shelves: [] }
}

export async function album(id: string): Promise<Collection> {
  const y = await yt()
  const page = await y.music.getAlbum(id)
  const head = headerOf(page.header)
  // Album rows carry no art of their own; inherit the cover and album ref.
  const tracks = toItems(page.contents).map((t): Item => ({
    ...t,
    kind: 'song',
    thumb: t.thumb || head.thumb,
    album: t.album ?? { name: head.title, id }
  }))
  return { id, kind: 'album', ...head, tracks, shelves: toShelves(page.sections) }
}

export async function artist(id: string): Promise<Collection> {
  const y = await yt()
  const page = await y.music.getArtist(id)
  const head = headerOf(page.header)
  const tracks: Item[] = []
  const shelves: Shelf[] = []
  for (const section of page.sections as any) {
    if (section?.type === 'MusicShelf' && !tracks.length) tracks.push(...toItems(section.contents))
    else {
      const shelf = toShelf(section)
      if (shelf) shelves.push(shelf)
    }
  }
  return { id, kind: 'artist', ...head, tracks, shelves }
}

export async function upNext(videoId: string): Promise<Item[]> {
  const y = await yt()
  let panel: any
  try {
    panel = await y.music.getUpNext(videoId, true)
  } catch {
    panel = await y.music.getUpNext(videoId, false)
  }
  return toItems(panel?.contents)
}

export async function lyrics(videoId: string): Promise<string> {
  const y = await yt()
  try {
    const shelf = await y.music.getLyrics(videoId)
    return text(shelf?.description)
  } catch {
    return ''
  }
}

export async function like(videoId: string, liked: boolean): Promise<void> {
  const y = await yt()
  await (liked ? y.interact.like(videoId) : y.interact.removeRating(videoId))
}

export async function addToPlaylist(playlistId: string, videoId: string): Promise<void> {
  const y = await yt()
  await y.playlist.addVideos(playlistId.replace(/^VL/, ''), [videoId])
}

export async function createPlaylist(title: string, videoIds: string[]): Promise<void> {
  const y = await yt()
  await y.playlist.create(title, videoIds, 'PRIVATE')
}

export async function getAccountProfile(): Promise<{ name?: string; photo?: string }> {
  try {
    const y = await yt()
    const info: any = await y.account.getInfo()
    const name =
      text(info?.account_name) ||
      text(info?.name) ||
      text(info?.header?.title) ||
      'Google Account'
    const photo = thumbOf(info?.account_photo || info?.header?.thumbnail || [])
    return { name, photo }
  } catch {
    return { name: 'Google Account' }
  }
}
