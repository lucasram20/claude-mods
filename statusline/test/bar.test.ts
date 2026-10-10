import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderBar } from '../src/bar.ts'
import { heat, PALETTE } from '../src/theme.ts'

const EMPTY = PALETTE.barEmpty.join(';')
const cells = (bar: string) => [...bar.matchAll(/48;2;(\d+;\d+;\d+)m /g)].map(m => m[1])

test('bar has a fixed width and a proportional fill', () => {
  const c = cells(renderBar(50, 0, 20))
  assert.equal(c.length, 20)
  assert.equal(c.filter(x => x === EMPTY).length, 10)
})

test('percent is clamped to 0-100', () => {
  assert.equal(cells(renderBar(250, 0)).filter(x => x === EMPTY).length, 0)
  assert.equal(cells(renderBar(-5, 0)).filter(x => x === EMPTY).length, 20)
})

test('glint stays inside the filled part and does sweep across it', () => {
  const seen = new Set<string | undefined>()
  for (let t = 0; t < 30_000; t += 1000) {
    const c = cells(renderBar(48, t))
    assert.ok(c.slice(10).every(x => x === EMPTY), 'free space never shines')
    c.slice(0, 10).forEach(x => seen.add(x))
  }
  const { base, edge, core } = heat(48)
  for (const color of [base, edge, core]) assert.ok(seen.has(color.join(';')))
})

test('bar color follows context usage', () => {
  const fill = (p: number) => cells(renderBar(p, 0))[0]
  assert.notEqual(fill(10), fill(60))
  assert.notEqual(fill(60), fill(90))
})
