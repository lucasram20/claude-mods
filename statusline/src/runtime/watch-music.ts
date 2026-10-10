// Entry point for the detached watcher that music.ts starts. It reads the player once a
// second into the cache, and quits when no status line has run for a while.
import { IDLE_EXIT_MS, msSinceHeartbeat, readCache, watcherAlive, writeCache } from './music.ts'
import { watchPlayer } from './player.ts'

if (watcherAlive(readCache(), Date.now())) process.exit(0) // another watcher already has it covered

const stop = watchPlayer(
  track => {
    const now = Date.now()
    if (msSinceHeartbeat(now) > IDLE_EXIT_MS) {
      stop()
      process.exit(0)
    }
    writeCache({ track, updatedAt: now, attemptedAt: now })
  },
  () => process.exit(0),
)
