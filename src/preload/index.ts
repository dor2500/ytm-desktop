import { contextBridge, ipcRenderer } from 'electron'
import type { AriaApi, AuthState, AdBlockStats } from '@shared/types'

const call =
  (channel: string) =>
  (...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args)

const listen =
  <T,>(channel: string) =>
  (cb: (payload: T) => void) => {
    const listener = (_e: unknown, payload: T): void => cb(payload)
    ipcRenderer.on(channel, listener)
    return () => {
      ipcRenderer.removeListener(channel, listener)
    }
  }

const api: AriaApi = {
  player: {
    load: call('player:load'),
    stop: call('player:stop'),
    play: call('player:play'),
    pause: call('player:pause'),
    seek: call('player:seek'),
    setVolume: call('player:volume'),
    setMuted: call('player:muted'),
    onState: listen('player:state'),
    onMediaKey: listen('player:mediaKey')
  },
  auth: {
    state: call('auth:state'),
    signIn: call('auth:signIn'),
    signOut: call('auth:signOut'),
    importCookies: call('auth:importCookies'),
    onChange(cb) {
      const listener = (_e: unknown, state: AuthState): void => cb(state)
      ipcRenderer.on('auth:changed', listener)
      return () => ipcRenderer.removeListener('auth:changed', listener)
    }
  },
  adblock: {
    stats: call('adblock:stats'),
    toggle: call('adblock:toggle'),
    onStats(cb) {
      const listener = (_e: unknown, stats: AdBlockStats): void => cb(stats)
      ipcRenderer.on('adblock:stats', listener)
      return () => ipcRenderer.removeListener('adblock:stats', listener)
    }
  },
  music: {
    home: call('music:home'),
    search: call('music:search'),
    suggest: call('music:suggest'),
    library: call('music:library'),
    playlist: call('music:playlist'),
    album: call('music:album'),
    artist: call('music:artist'),
    upNext: call('music:upNext'),
    lyrics: call('music:lyrics'),
    like: call('music:like'),
    addToPlaylist: call('music:addToPlaylist'),
    createPlaylist: call('music:createPlaylist')
  }
}

contextBridge.exposeInMainWorld('aria', api)
