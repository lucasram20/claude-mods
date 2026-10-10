import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadEnv } from './env.ts'
import { TOPICS, type Topic } from './topics.ts'

export interface Quote {
  text: string
  author: string
}

interface Cache {
  quote?: Quote
  fetchedAt: number // last successful fetch
  attemptedAt: number // last time a refresh was started (throttles retries)
}

const TTL_MS = 10 * 60_000 // a new quote every 10 minutes
const RETRY_MS = 60_000 // after a failed refresh, wait a minute before trying again
const MAX_LEN = 70 // quote + author must fit on the first status line next to everything else
const MAX_ATTEMPTS = 8 // short quotes are rare, so try several random picks before giving up

/** Whether a quote is short enough to display (as `“text” — author`). */
export const fits = (q: Quote): boolean => q.text.length + q.author.length + 5 <= MAX_LEN

const apiUrl = () => process.env.QUOTES_API_URL ?? 'https://api.api-ninjas.com/v2/randomquotes'
const cacheFile = () => join(process.env.STATUSLINE_CACHE_DIR ?? tmpdir(), 'claude-statusline-quote.json')

export function apiKey(): string | undefined {
  loadEnv(join(import.meta.dirname, '..', '.env'))
  return process.env.API_NINJAS_KEY || undefined
}

function readCache(): Cache {
  try {
    return JSON.parse(readFileSync(cacheFile(), 'utf8'))
  } catch {
    return { fetchedAt: 0, attemptedAt: 0 }
  }
}

function writeCache(cache: Cache): void {
  try {
    writeFileSync(cacheFile(), JSON.stringify(cache))
  } catch {} // cache is best-effort
}

function query(topic: Topic, rand: () => number): URLSearchParams {
  const q = new URLSearchParams()
  if (topic.categories) q.set('categories', topic.categories)
  if (topic.authors?.length) q.set('author', topic.authors[Math.floor(rand() * topic.authors.length)] ?? '')
  return q
}

/**
 * One random quote from a random topic. Topics that return nothing (or only quotes too
 * long to display) fall through to the next one. Any HTTP or network error gives up.
 */
export async function fetchQuote(key: string, rand: () => number = Math.random): Promise<Quote | undefined> {
  const start = Math.floor(rand() * TOPICS.length)
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const topic = TOPICS[(start + i) % TOPICS.length]
    if (!topic) continue
    try {
      const res = await fetch(`${apiUrl()}?${query(topic, rand)}`, {
        headers: { 'X-Api-Key': key },
        signal: AbortSignal.timeout(4000),
      })
      if (!res.ok) return undefined // bad key, rate limit, outage: no point trying other topics
      const [q] = (await res.json()) as { quote?: string; author?: string }[]
      const quote = { text: q?.quote ?? '', author: q?.author ?? 'Unknown' }
      if (quote.text && fits(quote)) return quote
    } catch {
      return undefined
    }
  }
  return undefined
}

/** Runs in the detached child: fetch a quote and store it. A failed fetch keeps the old one. */
export async function refreshQuote(): Promise<void> {
  const key = apiKey()
  if (!key) return
  const old = readCache()
  const quote = await fetchQuote(key)
  writeCache(quote ? { quote, fetchedAt: Date.now(), attemptedAt: Date.now() } : old)
}

/**
 * The cached quote, instantly. When it is stale, a detached child process refreshes the
 * cache in the background so the status line itself never waits on the network.
 */
export function currentQuote(now: number): Quote | undefined {
  const cache = readCache()
  const quote = cache.quote && fits(cache.quote) ? cache.quote : undefined // drop quotes cached under an older, longer limit
  const isStale = !quote || now - cache.fetchedAt > TTL_MS
  if (isStale && now - cache.attemptedAt > RETRY_MS && apiKey()) {
    writeCache({ ...cache, attemptedAt: now })
    spawn(process.execPath, [join(import.meta.dirname, 'refresh-quote.ts')], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref()
  }
  return quote
}
