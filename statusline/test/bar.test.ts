import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderBar } from '../src/runtime/bar.ts'
import { bg, levelColor, PALETTE } from '../src/runtime/theme.ts'

const EMPTY_BG = bg(PALETTE.barEmpty)
const plain = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '')

test('bar has a fixed width and a proportional fill', () => {
  assert.equal(plain(renderBar(50)).length, 20)
  const [filled = ''] = renderBar(50).split(EMPTY_BG) // everything before the empty part
  assert.equal(plain(filled).length, 10)
})

test('percent is clamped to 0-100', () => {
  assert.equal(plain(renderBar(250)).length, 20)
  assert.equal(plain(renderBar(-5)).length, 20)
  assert.equal(plain(renderBar(250).split(EMPTY_BG)[1] ?? '').length, 0) // nothing empty
  assert.equal(plain(renderBar(-5).split(EMPTY_BG)[0] ?? '').length, 0) // nothing filled
})

test('level colors step green, yellow, orange, red', () => {
  const levels = [10, 44, 45, 69, 70, 84, 85, 100].map(p => levelColor(p).join(';'))
  assert.equal(new Set(levels).size, 4)
  assert.equal(levels[0], levels[1])
  assert.notEqual(levels[1], levels[2])
  assert.equal(levels[2], levels[3])
  assert.notEqual(levels[3], levels[4])
  assert.equal(levels[4], levels[5])
  assert.notEqual(levels[5], levels[6])
  assert.equal(levels[6], levels[7])
})

test('bar is tinted with the level color', () => {
  assert.ok(renderBar(60).startsWith(bg(levelColor(60))))
})
