import type { EngineState, Item } from '@shared/types'
import { api } from './app'
import { createStore } from './store'

export type Repeat = 'off' | 'all' | 'one'

interface PlayerState {
  queue: Item[]
  index: number
  playing: boolean
  buffering: boolean
  /** YouTube is playing an advert before or during the track. */
  ad: boolean
  position: number
  duration: number
  volume: number
  muted: boolean
  shuffle: boolean
  repeat: Repeat
  notice: string
  liked: Record<string, boolean>
}

const storedVolume = localStorage.getItem('aria.volume')

export const player = createStore<PlayerState>({
  queue: [],
  index: -1,
  playing: false,
  buffering: false,
  ad: false,
  position: 0,
  duration: 0,
  volume: storedVolume !== null && Number.isFinite(Number(storedVolume)) ? Number(storedVolume) : 80,
  muted: false,
  shuffle: false,
  repeat: 'off',
  notice: '',
  liked: {}
})

export const currentOf = (s: PlayerState): Item | undefined => s.queue[s.index]

/** How long a track may sit without producing audio before it is skipped. */
const START_TIMEOUT_MS = 20_000

let failures = 0
let extending = false
// The engine page is unloaded once the queue runs out; play must reload it.
let stopped = true
let watchdog: ReturnType<typeof setTimeout> | undefined
let noticeTimer: ReturnType<typeof setTimeout> | undefined

export function notify(message: string): void {
  player.set({ notice: message })
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => player.set({ notice: '' }), 4500)
}

void api.player.setVolume(player.get().volume)

api.player.onState((s: EngineState) => {
  const item = currentOf(player.get())
  if (!item || s.videoId !== item.id || stopped) return
  if (s.blocked) return fail('YouTube asked for a sign-in or consent page instead of playing.')
  if (s.playing || s.ad) {
    failures = 0
    clearTimeout(watchdog)
  }
  if (s.ended) {
    // Second guard against an advert's end: the ended media must be about as
    // long as the track's own metadata says.
    const mismatch = !!item.duration && !!s.duration && Math.abs(s.duration - item.duration) > 20
    if (!mismatch) return next(true)
    return
  }
  player.set({
    playing: s.playing,
    buffering: s.buffering,
    ad: s.ad,
    // During an advert the element reports the advert's own timeline.
    position: s.ad ? 0 : s.position,
    duration: s.ad ? (item.duration ?? 0) : s.duration || item.duration || 0
  })
})

api.player.onMediaKey((key) => (key === 'next' ? next() : previous()))

function fail(reason: string): void {
  const s = player.get()
  failures++
  notify(reason)
  clearTimeout(watchdog)
  if (failures < 3 && s.index < s.queue.length - 1) next(true)
  else halt()
}

function halt(): void {
  stopped = true
  clearTimeout(watchdog)
  void api.player.stop()
  player.set({ playing: false, buffering: false, ad: false })
}

function load(index: number): void {
  const item = player.get().queue[index]
  if (!item) return
  stopped = false
  player.set({ index, position: 0, duration: item.duration ?? 0, buffering: true, playing: false, ad: false })
  void api.player.load(item.id)
  clearTimeout(watchdog)
  watchdog = setTimeout(() => fail(`“${item.title}” didn’t start playing.`), START_TIMEOUT_MS)
  void extend()
}

/** Top the queue up with YouTube Music's radio for the last track. */
async function extend(): Promise<void> {
  const s = player.get()
  if (extending || s.index < s.queue.length - 2) return
  const seed = s.queue[s.queue.length - 1]
  if (!seed) return
  extending = true
  try {
    const more = await api.music.upNext(seed.id)
    const have = new Set(player.get().queue.map((i) => i.id))
    const fresh = more.filter((i) => !have.has(i.id))
    if (fresh.length) player.set((cur) => ({ queue: [...cur.queue, ...fresh] }))
  } catch {
    /* running out of radio is not worth interrupting playback for */
  } finally {
    extending = false
  }
}

const playable = (i: Item): boolean => i.kind === 'song' || i.kind === 'video'

export function playQueue(items: Item[], startIndex = 0): void {
  const start = items[startIndex]
  const queue = items.filter(playable)
  if (!queue.length) return
  failures = 0
  player.set({ queue })
  load(Math.max(0, start ? queue.indexOf(start) : 0))
}

export function playItem(item: Item): void {
  playQueue([item], 0)
}

export function jump(index: number): void {
  failures = 0
  load(index)
}

export function toggle(): void {
  const s = player.get()
  if (s.index < 0) return
  if (stopped) return load(s.index)
  if (s.playing) {
    player.set({ playing: false })
    void api.player.pause()
  } else {
    player.set({ playing: true })
    void api.player.play()
  }
}

export function next(auto = false): void {
  const s = player.get()
  if (s.index < 0) return
  if (auto && s.repeat === 'one') return load(s.index)
  if (s.shuffle && s.queue.length > 1) {
    let pick = s.index
    while (pick === s.index) pick = Math.floor(Math.random() * s.queue.length)
    return load(pick)
  }
  if (s.index < s.queue.length - 1) return load(s.index + 1)
  if (s.repeat === 'all') return load(0)
  halt()
}

export function previous(): void {
  const s = player.get()
  if (s.index < 0) return
  if (s.position > 3 || s.index === 0) seek(0)
  else load(s.index - 1)
}

export function seek(seconds: number): void {
  const s = player.get()
  // Seeking the element during an advert would skip the advert.
  if (stopped || s.ad) return
  player.set({ position: seconds })
  void api.player.seek(seconds)
}

export function setVolume(volume: number): void {
  const v = Math.round(Math.min(100, Math.max(0, volume)))
  player.set({ volume: v, muted: false })
  localStorage.setItem('aria.volume', String(v))
  void api.player.setMuted(false)
  void api.player.setVolume(v)
}

export function toggleMute(): void {
  const muted = !player.get().muted
  player.set({ muted })
  void api.player.setMuted(muted)
}

export function toggleShuffle(): void {
  player.set((s) => ({ shuffle: !s.shuffle }))
}

export function cycleRepeat(): void {
  const order: Repeat[] = ['off', 'all', 'one']
  player.set((s) => ({ repeat: order[(order.indexOf(s.repeat) + 1) % order.length] }))
}

export function playNext(item: Item): void {
  if (!playable(item)) return
  const s = player.get()
  if (s.index < 0) return playItem(item)
  const current = s.queue[s.index]
  if (current.id === item.id) return
  const queue = s.queue.filter((q) => q.id !== item.id)
  const at = queue.indexOf(current) + 1
  queue.splice(at, 0, item)
  player.set({ queue, index: at - 1 })
  notify('Playing next')
}

export function enqueue(item: Item): void {
  if (!playable(item)) return
  const s = player.get()
  if (s.index < 0) return playItem(item)
  if (!s.queue.some((q) => q.id === item.id)) player.set({ queue: [...s.queue, item] })
  notify('Added to queue')
}

export async function toggleLike(item: Item): Promise<void> {
  const liked = !player.get().liked[item.id]
  player.set((s) => ({ liked: { ...s.liked, [item.id]: liked } }))
  try {
    await api.music.like(item.id, liked)
    notify(liked ? 'Added to liked music' : 'Removed from liked music')
  } catch {
    player.set((s) => ({ liked: { ...s.liked, [item.id]: !liked } }))
    notify('Sign in to like songs')
  }
}
