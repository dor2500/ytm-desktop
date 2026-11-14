export type ItemKind = 'song' | 'video' | 'album' | 'playlist' | 'artist'

export interface Ref {
  name: string
  id?: string
}

export interface Item {
  kind: ItemKind
  id: string
  title: string
  subtitle: string
  thumb: string
  /** Seconds, tracks only. */
  duration?: number
  artists?: Ref[]
  album?: Ref
  /** Radio / mix playlist attached to a playable item. */
  playlistId?: string
}

export interface Shelf {
  title: string
  items: Item[]
}

export interface Collection {
  id: string
  kind: 'playlist' | 'album' | 'artist'
  title: string
  subtitle: string
  description: string
  thumb: string
  tracks: Item[]
  shelves: Shelf[]
}

export interface SearchResult {
  shelves: Shelf[]
}

export interface AuthState {
  signedIn: boolean
  name?: string
  photo?: string
}

export interface AdBlockStats {
  enabled: boolean
  blockedCount: number
}

export interface EngineState {
  videoId: string
  playing: boolean
  buffering: boolean
  position: number
  duration: number
  /** The track (not an advert) reached its end. */
  ended: boolean
  ad: boolean
  /** YouTube showed a consent or sign-in page instead of the player. */
  blocked?: boolean
}

export interface AriaApi {
  player: {
    load(videoId: string): Promise<void>
    stop(): Promise<void>
    play(): Promise<void>
    pause(): Promise<void>
    seek(seconds: number): Promise<void>
    setVolume(volume: number): Promise<void>
    setMuted(muted: boolean): Promise<void>
    onState(cb: (s: EngineState) => void): () => void
    onMediaKey(cb: (key: string) => void): () => void
  }
  auth: {
    state(): Promise<AuthState>
    signIn(): Promise<AuthState>
    signOut(): Promise<AuthState>
    importCookies(cookieString: string): Promise<AuthState>
    onChange(cb: (s: AuthState) => void): () => void
  }
  adblock: {
    stats(): Promise<AdBlockStats>
    toggle(): Promise<boolean>
    onStats(cb: (stats: AdBlockStats) => void): () => void
  }
  music: {
    home(): Promise<Shelf[]>
    search(query: string): Promise<SearchResult>
    suggest(query: string): Promise<string[]>
    library(): Promise<Item[]>
    playlist(id: string): Promise<Collection>
    album(id: string): Promise<Collection>
    artist(id: string): Promise<Collection>
    upNext(videoId: string): Promise<Item[]>
    lyrics(videoId: string): Promise<string>
    like(videoId: string, liked: boolean): Promise<void>
    addToPlaylist(playlistId: string, videoId: string): Promise<void>
    createPlaylist(title: string, videoIds: string[]): Promise<void>
  }
}
