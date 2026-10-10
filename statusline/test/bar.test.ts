import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderBar } from '../src/bar.ts'
import { levelColor } from '../src/theme.ts'

const plain = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '')

test('bar has a fixed width and a proportional fill', () => {
  assert.equal(plain(renderBar(50)).length, 20)
  const [filled = ''] = renderBar(50).split('\x1b[48;2;58;58;68m') // everything before the empty part
  assert.equal(plain(filled).length, 10)
})

test('percent is clamped to 0-100', () => {
  assert.equal(plain(renderBar(250)).length, 20)
  assert.equal(plain(renderBar(-5)).length, 20)
  assert.equal(plain(renderBar(250).split('\x1b[48;2;58;58;68m')[1] ?? '').length, 0) // nothing empty
  assert.equal(plain(renderBar(-5).split('\x1b[48;2;58;58;68m')[0] ?? '').length, 0) // nothing filled
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
  assert.ok(renderBar(60).startsWith(`\x1b[48;2;${levelColor(60).join(';')}m`))
})
