import { spawn } from 'node:child_process'
import { readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import type { Track } from './player.ts'

// The status line only reads a cache file. A watcher process, started on demand, keeps it
// current once a second, so the line never waits on the player and follows it closely.

export interface Cache {
  track?: Track | undefined
  /** When the watcher last wrote the cache; a recent value means a watcher is running. */
  updatedAt: number
  /** Last time a watcher was started; throttles restarts when one can't run at all. */
  attemptedAt: number
}

const ALIVE_MS = 4000 // the watcher writes every second, so a write this recent means it is running
const RETRY_MS = 15_000 // after starting a watcher, wait before trying again
const STALE_MS = 10_000 // a reading older than this belongs to a watcher that is gone
export const IDLE_EXIT_MS = 30_000 // the watcher quits when no status line has run for this long

const dir = () => process.env.STATUSLINE_CACHE_DIR ?? tmpdir()
const cacheFile = () => join(dir(), 'claude-statusline-music.json')
const heartbeatFile = () => join(dir(), 'claude-statusline-music.alive')

export function readCache(): Cache {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return JSON.parse(readFileSync(cacheFile(), 'utf8'))
    } catch {} // missing, or caught mid-write: look once more
  }
  return { updatedAt: 0, attemptedAt: 0 }
}

/** Written next to the target and renamed, so a reader never sees half a file. */
export function writeCache(cache: Cache): void {
  try {
    const tmp = `${cacheFile()}.${process.pid}`
    writeFileSync(tmp, JSON.stringify(cache))
    renameSync(tmp, cacheFile())
  } catch {} // cache is best-effort
}

/** Every status line run says "someone is looking"; the watcher stops once nobody is. */
export function touchHeartbeat(): void {
  try {
    writeFileSync(heartbeatFile(), '')
  } catch {}
}

export function msSinceHeartbeat(now: number): number {
  try {
    return now - statSync(heartbeatFile()).mtimeMs
  } catch {
    return Infinity
  }
}

export const watcherAlive = (cache: Cache, now: number): boolean => now - cache.updatedAt < ALIVE_MS
export const needsWatcher = (cache: Cache, now: number): boolean =>
  !watcherAlive(cache, now) && now - cache.attemptedAt > RETRY_MS

/** The cached reading moved forward to `now`, so the progress keeps ticking between reads. */
export function liveTrack(track: Track | undefined, now: number): Track | undefined {
  if (!track || now - track.at > STALE_MS) return undefined
  if (!track.playing) return track
  const position = track.position + Math.max(0, now - track.at) / 1000
  return { ...track, position: track.duration ? Math.min(position, track.duration) : position }
}

/**
 * The track that is playing, instantly. When no watcher is running, a detached one is
 * started for the next update (the first line after a start shows no song).
 */
export function currentTrack(now: number): Track | undefined {
  const cache = readCache()
  touchHeartbeat()
  if (needsWatcher(cache, now)) {
    writeCache({ ...cache, attemptedAt: now })
    // Same extension as this file: .ts when run from source, .js once built.
    spawn(process.execPath, [join(import.meta.dirname, `watch-music${extname(import.meta.filename)}`)], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref()
  }
  return liveTrack(cache.track, now)
}
