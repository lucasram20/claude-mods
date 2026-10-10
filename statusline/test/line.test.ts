import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildLine } from '../src/runtime/line.ts'

const plain = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '').replace(/ +(?=\d+% )/g, ' ')

const track = { title: 'Pandora', artist: 'Wisp', playing: true, position: 60, duration: 240, at: 0 }
const parts = { model: 'Opus 5.5', percent: 48, git: 'main ~1', music: track, time: '5:42 PM' }

test('one line: model, bar, git, song, then the clock last', () => {
  const line = plain(buildLine({ ...parts, columns: 160 }))
  assert.match(line, /^✻ Opus 5\.5 \| 48% \| main ~1 \| ♪ Pandora — Wisp [━●─]{16} 1:00\/4:00 \| 5:42 PM$/)
})

test('the seek bar shrinks, then the song goes, as the terminal gets narrower', () => {
  const barOf = (columns: number) => plain(buildLine({ ...parts, columns })).match(/[━●─]+/)?.[0].length
  assert.equal(barOf(160), 16)
  assert.ok((barOf(100) ?? 0) < 16)
  assert.equal(plain(buildLine({ ...parts, columns: 80 })), '✻ Opus 5.5 | 48% | main ~1 | 5:42 PM')
})

test('the line never grows past the terminal', () => {
  for (const columns of [70, 90, 100, 120, 160, 200]) {
    const line = buildLine({ ...parts, columns }).replace(/\x1b\[[0-9;]*m/g, '') // keeps the bar's spaces
    assert.ok(line.length <= columns - 2 || !line.includes('♪'), `${columns} columns: ${line.length} characters`)
  }
})

test('git and music disappear cleanly when missing', () => {
  const line = plain(buildLine({ model: 'M', percent: 5, git: '', time: '1:00 AM' }))
  assert.equal(line, '✻ M | 5% | 1:00 AM')
})
