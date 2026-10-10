import assert from 'node:assert/strict'
import { test } from 'node:test'
import { liveTrack, needsWatcher, watcherAlive } from '../src/runtime/music.ts'
import { fitTitle, formatTime, renderMusic, renderSeek } from '../src/runtime/music-line.ts'
import { clean, parsePlayerctl, parseWindows, type Track } from '../src/runtime/player.ts'

const plain = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '')
const track: Track = { title: 'Pandora', artist: 'Wisp', playing: true, position: 10, duration: 100, at: 1000 }

test('parseWindows reads the PowerShell line and keeps its own timestamp', () => {
  const out = '{"title":"Tempest","artist":"Deftones","playing":true,"position":280.4,"duration":378.6,"at":5000}\r\n'
  assert.deepEqual(parseWindows(out, 9999), {
    title: 'Tempest',
    artist: 'Deftones',
    playing: true,
    position: 280.4,
    duration: 378.6,
    at: 5000,
  })
})

test('parseWindows: no player, junk and untitled sessions give nothing', () => {
  assert.equal(parseWindows('', 1), undefined)
  assert.equal(parseWindows('not json', 1), undefined)
  assert.equal(parseWindows('{"title":"","artist":"x"}', 1), undefined)
})

test('parseWindows: position never passes the length, and a missing length is fine', () => {
  assert.equal(parseWindows('{"title":"t","position":500,"duration":200}', 1)?.position, 200)
  const live = parseWindows('{"title":"t","position":-3,"duration":0,"playing":false}', 7)
  assert.deepEqual([live?.position, live?.duration, live?.at, live?.playing], [0, 0, 7, false])
})

test('parsePlayerctl prefers the playing player and converts microseconds', () => {
  const line = (...f: string[]) => f.join('\x1f')
  const out = [
    line('Paused', 'Old', 'Song A', '1000000', '60000000'),
    line('Playing', 'Alice In Chains', 'Nutshell', '58000000', '260000000'),
  ].join('\n')
  assert.deepEqual(parsePlayerctl(out, 42), {
    title: 'Nutshell',
    artist: 'Alice In Chains',
    playing: true,
    position: 58,
    duration: 260,
    at: 42,
  })
  assert.equal(parsePlayerctl(line('Paused', 'Old', 'Song A', '', ''), 1)?.title, 'Song A')
  assert.equal(parsePlayerctl('', 1), undefined)
})

test('titles cannot carry terminal escapes', () => {
  assert.equal(clean('Evil \x1b]8;;http://x\x07link\r\nsong'), 'Evil  ]8;;http://x link song')
  assert.equal(parseWindows(JSON.stringify({ title: 'a\x1bb', artist: '\x07' }), 1)?.title, 'a b')
})

test('liveTrack moves a playing track forward and holds a paused one', () => {
  assert.equal(liveTrack(track, 4000)?.position, 13)
  assert.equal(liveTrack({ ...track, playing: false }, 4000)?.position, 10)
  assert.equal(liveTrack({ ...track, position: 95 }, 9000)?.position, 100) // never past the end of the track
  assert.equal(liveTrack(undefined, 1), undefined)
  assert.equal(liveTrack(track, 1000 + 11_000), undefined) // the watcher that took it is gone
})

test('a watcher is wanted only when none is writing, and not too often', () => {
  const cache = { track, updatedAt: 10_000, attemptedAt: 0 }
  assert.equal(watcherAlive(cache, 13_000), true)
  assert.equal(needsWatcher(cache, 13_000), false) // still writing
  assert.equal(watcherAlive(cache, 15_000), false)
  assert.equal(needsWatcher({ ...cache, attemptedAt: 12_000 }, 16_000), false) // just tried
  assert.equal(needsWatcher({ ...cache, attemptedAt: 12_000 }, 28_000), true)
  assert.equal(needsWatcher({ updatedAt: 0, attemptedAt: 0 }, 20_000), true) // fresh start
})

test('formatTime', () => {
  assert.equal(formatTime(0), '0:00')
  assert.equal(formatTime(72.9), '1:12')
  assert.equal(formatTime(3725), '1:02:05')
})

test('the seek bar puts the knob where the song is', () => {
  const bar = (t: Track, width = 11) => plain(renderSeek(t, width))
  assert.equal(bar({ ...track, position: 0 }), '●──────────')
  assert.equal(bar({ ...track, position: 50 }), '━━━━━●─────')
  assert.equal(bar({ ...track, position: 100 }), '━━━━━━━━━━●')
  assert.equal(bar({ ...track, duration: 0 }), '━━━━━━━━━━●') // unknown length: knob at the end
  assert.equal(bar({ ...track, position: 500 }), '━━━━━━━━━━●') // never past the end
})

test('fitTitle trims the artist first, then the title', () => {
  assert.deepEqual(fitTitle('Song', 'Band', 40), { title: 'Song', artist: 'Band' })
  assert.deepEqual(fitTitle('Song', 'A very long band name', 20), { title: 'Song', artist: 'A very long …' })
  assert.deepEqual(fitTitle('A very long title indeed', 'Band', 20), { title: 'A very long title i…', artist: '' })
})

test('renderMusic: note while playing, pause marker when paused, time without a length', () => {
  assert.match(plain(renderMusic(track, 100)), /^♪ Pandora — Wisp [━●─]{16} 0:10\/1:40$/)
  assert.match(plain(renderMusic({ ...track, playing: false, duration: 0 }, 100)), /^❚❚ Pandora — Wisp [━●─]{16} 0:10$/)
})

test('renderMusic: a tight room shrinks the bar and trims the artist; a tiny one shows nothing', () => {
  const tight = plain(renderMusic(track, 36))
  assert.match(tight, /^♪ Pandora [━●─]{11} 0:10\/1:40$/)
  assert.ok(tight.length <= 36)
  assert.equal(plain(renderMusic(track, 20)), '')
})
