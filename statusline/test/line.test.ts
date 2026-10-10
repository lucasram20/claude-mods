import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildLine } from '../src/runtime/line.ts'

const plain = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '').replace(/ +(?=\d+% )/g, ' ')

test('full line: model, bar, git, quote, time in that order', () => {
  const line = plain(
    buildLine({
      model: 'Opus 5.5',
      percent: 48,
      git: 'main ~1',
      quote: { text: 'Hi', author: 'A' },
      time: '5:42 PM',
    }),
  )
  assert.equal(line, '✻ Opus 5.5 | 48% | main ~1 | “Hi” — A | 5:42 PM')
})

test('git and quote segments disappear cleanly when missing', () => {
  const line = plain(buildLine({ model: 'M', percent: 5, git: '', time: '1:00 AM' }))
  assert.equal(line, '✻ M | 5% | 1:00 AM')
})
