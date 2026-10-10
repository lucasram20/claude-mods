import assert from 'node:assert/strict'
import { createServer, type IncomingHttpHeaders } from 'node:http'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, type TestContext } from 'node:test'
import { currentQuote, fetchQuote, refreshQuote } from '../src/quote.ts'

process.env.STATUSLINE_CACHE_DIR = mkdtempSync(join(tmpdir(), 'statusline-test-'))

/** Local stand-in for the API: replies to each request with the next canned response. */
async function mockApi(t: TestContext, replies: { status?: number; body: unknown }[]) {
  const headers: IncomingHttpHeaders[] = []
  const server = createServer((req, res) => {
    headers.push(req.headers)
    const reply = replies[headers.length - 1] ?? { body: [] }
    res.writeHead(reply.status ?? 200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(reply.body))
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  process.env.QUOTES_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`
  return headers
}

test('fetchQuote sends the key and maps the response', async t => {
  const requests = await mockApi(t, [{ body: [{ quote: 'Hi', author: 'A' }] }])
  assert.deepEqual(await fetchQuote('secret'), { text: 'Hi', author: 'A' })
  assert.equal(requests[0]?.['x-api-key'], 'secret')
})

test('empty and too-long results fall through to the next topic', async t => {
  const requests = await mockApi(t, [
    { body: [] },
    { body: [{ quote: 'x'.repeat(500), author: 'B' }] },
    { body: [{ quote: 'ok', author: 'C' }] },
  ])
  assert.deepEqual(await fetchQuote('k'), { text: 'ok', author: 'C' })
  assert.equal(requests.length, 3)
})

test('an HTTP error gives up without trying other topics', async t => {
  const requests = await mockApi(t, [{ status: 401, body: { error: 'bad key' } }])
  assert.equal(await fetchQuote('k'), undefined)
  assert.equal(requests.length, 1)
})

test('a cached quote that is too long for the line is not shown', () => {
  const cache = { quote: { text: 'x'.repeat(100), author: 'E' }, fetchedAt: Date.now(), attemptedAt: Date.now() }
  writeFileSync(join(process.env.STATUSLINE_CACHE_DIR!, 'claude-statusline-quote.json'), JSON.stringify(cache))
  process.env.API_NINJAS_KEY = '' // no key: nothing to refresh with, so nothing to show
  assert.equal(currentQuote(Date.now()), undefined)
})

test('refreshQuote fills the cache and currentQuote serves it without a key', async t => {
  await mockApi(t, [{ body: [{ quote: 'Cached', author: 'D' }] }])
  process.env.API_NINJAS_KEY = 'k'
  await refreshQuote()
  process.env.API_NINJAS_KEY = '' // no key: a fresh cache must be served and nothing spawned
  assert.deepEqual(currentQuote(Date.now()), { text: 'Cached', author: 'D' })
  assert.ok(readFileSync(join(process.env.STATUSLINE_CACHE_DIR!, 'claude-statusline-quote.json'), 'utf8'))
})
