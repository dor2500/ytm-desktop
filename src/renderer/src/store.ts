import { useSyncExternalStore } from 'react'

export interface Store<T> {
  get(): T
  set(patch: Partial<T> | ((s: T) => Partial<T>)): void
  subscribe(fn: () => void): () => void
  /** Subscribe a component to a slice. Selectors must return stable values. */
  use<U>(selector: (s: T) => U): U
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial
  const subs = new Set<() => void>()
  const get = (): T => state
  const subscribe = (fn: () => void): (() => void) => {
    subs.add(fn)
    return () => subs.delete(fn)
  }
  return {
    get,
    subscribe,
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch
      state = { ...state, ...next }
      subs.forEach((fn) => fn())
    },
    use: (selector) => useSyncExternalStore(subscribe, () => selector(state))
  }
}
