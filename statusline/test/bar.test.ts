import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderBar } from '../src/bar.ts'

const cells = (bar: string) => [...bar.matchAll(/48;5;(\d+)m /g)].map(m => Number(m[1]))

test('bar has a fixed width and a proportional fill', () => {
  const c = cells(renderBar(50, 0, 20))
  assert.equal(c.length, 20)
  assert.equal(c.filter(x => x === 238).length, 10)
})

test('percent is clamped to 0-100', () => {
  assert.equal(cells(renderBar(250, 0)).filter(x => x === 238).length, 0)
  assert.equal(cells(renderBar(-5, 0)).filter(x => x === 238).length, 20)
})

test('glint stays inside the filled part and does sweep across it', () => {
  const seen = new Set<number>()
  for (let t = 0; t < 30_000; t += 1000) {
    const c = cells(renderBar(48, t))
    assert.ok(c.slice(10).every(x => x === 238), 'free space never shines')
    c.slice(0, 10).forEach(x => seen.add(x))
  }
  assert.ok(seen.has(255) && seen.has(246))
})
