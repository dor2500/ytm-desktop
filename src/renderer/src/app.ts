import { useEffect, useState } from 'react'
import type { AriaApi, AuthState, AdBlockStats, Item, MusicService, ServiceBounds } from '@shared/types'
import { createStore } from './store'

declare global {
  interface Window {
    aria: AriaApi
  }
}

export const api = window.aria

/* ---------- routing ---------- */

export type Route =
  | { page: 'home' }
  | { page: 'library' }
  | { page: 'search'; q: string }
  | { page: 'collection'; kind: 'playlist' | 'album' | 'artist'; id: string }

export const nav = createStore<{ stack: Route[]; pos: number }>({ stack: [{ page: 'home' }], pos: 0 })

export const routeKey = (r: Route): string =>
  r.page === 'search' ? `search:${r.q}` : r.page === 'collection' ? `${r.kind}:${r.id}` : r.page

export function go(route: Route): void {
  const { stack, pos } = nav.get()
  if (routeKey(stack[pos]) === routeKey(route)) return
  nav.set({ stack: [...stack.slice(0, pos + 1), route], pos: pos + 1 })
}

export function step(delta: -1 | 1): void {
  const { stack, pos } = nav.get()
  const next = pos + delta
  if (next >= 0 && next < stack.length) nav.set({ pos: next })
}

export function openCollection(item: Pick<Item, 'kind' | 'id'>): void {
  if (item.kind === 'album' || item.kind === 'playlist' || item.kind === 'artist') {
    go({ page: 'collection', kind: item.kind, id: item.id })
  }
}

/* ---------- auth ---------- */

export const auth = createStore<AuthState & { ready: boolean; epoch: number }>({
  signedIn: false,
  ready: false,
  epoch: 0
})

export const authModalStore = createStore<{ open: boolean }>({ open: false })
export const openAuthModal = (): void => authModalStore.set({ open: true })
export const closeAuthModal = (): void => authModalStore.set({ open: false })

const cache = new Map<string, unknown>()

function applyAuth(state: AuthState): void {
  cache.clear()
  auth.set((s) => ({ ...state, ready: true, epoch: s.epoch + 1 }))
}

void api.auth.state().then(applyAuth)
api.auth.onChange(applyAuth)

/* ---------- ad blocker ---------- */

export const adblockStore = createStore<AdBlockStats>({
  enabled: true,
  blockedCount: 0
})

void api.adblock.stats().then((s) => adblockStore.set(s))
api.adblock.onStats((s) => adblockStore.set(s))

/* ---------- multi-service store (YouTube Music, Spotify, SoundCloud) ---------- */

export const serviceStore = createStore<{ current: MusicService }>({
  current: 'ytm'
})

void api.service.get().then((s) => serviceStore.set({ current: s }))
api.service.onChanged((s) => serviceStore.set({ current: s }))

export function switchService(service: MusicService, bounds?: ServiceBounds): void {
  serviceStore.set({ current: service })
  void api.service.set(service, bounds)
}

/* ---------- theme / accent ---------- */

export type AccentColor = 'lime' | 'emerald' | 'violet' | 'cyan' | 'rose' | 'amber'

const initialAccent = (localStorage.getItem('aria:accent') as AccentColor) || 'emerald'
export const themeStore = createStore<{ accent: AccentColor }>({ accent: initialAccent })

export function setAccent(accent: AccentColor): void {
  localStorage.setItem('aria:accent', accent)
  themeStore.set({ accent })
  document.documentElement.setAttribute('data-accent', accent)
}

if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-accent', initialAccent)
}

/* ---------- data ---------- */

export interface Async<T> {
  data?: T
  error?: string
  loading: boolean
}

/** Fetch keyed data with a session cache, refetching when the account changes. */
export function useData<T>(key: string, load: () => Promise<T>): Async<T> {
  const epoch = auth.use((s) => s.epoch)
  const [state, setState] = useState<Async<T>>(() =>
    cache.has(key) ? { data: cache.get(key) as T, loading: false } : { loading: true }
  )
  useEffect(() => {
    let live = true
    if (cache.has(key)) {
      setState({ data: cache.get(key) as T, loading: false })
      return
    }
    setState({ loading: true })
    load().then(
      (data) => {
        cache.set(key, data)
        if (live) setState({ data, loading: false })
      },
      (err: unknown) => {
        if (live) setState({ loading: false, error: cleanError(err) })
      }
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, epoch])
  return state
}

export function invalidate(key: string): void {
  cache.delete(key)
}

export function cleanError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

export function formatTime(seconds: number | undefined): string {
  if (!seconds || !isFinite(seconds)) return '0:00'
  const s = Math.floor(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}
