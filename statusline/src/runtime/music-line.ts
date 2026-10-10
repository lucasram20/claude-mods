import type { Track } from './player.ts'
import { fg, PALETTE } from './theme.ts'

const BAR_WIDTH = 16
const MIN_BAR = 6
const MIN_TITLE = 12 // the title keeps this much; the bar shrinks first, then goes, then the whole segment
const MAX_TITLE = 50

/** Seek bar: a bright line up to a round knob, then a dim line, like `━━━━●───────`. */
export function renderSeek(track: Track, width = BAR_WIDTH): string {
  const knob = track.duration ? Math.round(((width - 1) * track.position) / track.duration) : width - 1 // unknown length: knob at the end
  const at = Math.min(width - 1, Math.max(0, knob))
  return fg(PALETTE.music, `${'━'.repeat(at)}●`) + fg(PALETTE.musicDim, '─'.repeat(width - 1 - at))
}

export function formatTime(totalSeconds: number): string {
  const s = Math.floor(totalSeconds)
  const h = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(mm).padStart(2, '0')}:${ss}` : `${mm}:${ss}`
}

const ellipsis = (text: string, max: number): string => (text.length > max ? `${text.slice(0, Math.max(0, max - 1))}…` : text)

/** Fits "title — artist" in `max` characters: the artist gives way first. */
export function fitTitle(title: string, artist: string, max: number): { title: string; artist: string } {
  if (!artist || title.length + artist.length + 3 <= max) return { title, artist }
  const room = max - title.length - 3
  return room >= 6 ? { title, artist: ellipsis(artist, room) } : { title: ellipsis(title, max), artist: '' }
}

/**
 * The now-playing segment: `♪ Title — Artist ━━━━●─────── 1:12/4:21` (`❚❚` instead of `♪` while paused).
 * `room` is how many characters it may take. A short room shrinks the bar, then drops it,
 * and a tiny one drops the segment (empty string), so the status line never wraps.
 */
export function renderMusic(track: Track, room: number): string {
  const glyphWidth = track.playing ? 1 : 2
  const time = track.duration ? `${formatTime(track.position)}/${formatTime(track.duration)}` : formatTime(track.position)
  const rest = room - (glyphWidth + 1) - (time.length + 1) // what the title and the bar share
  if (rest < MIN_TITLE) return ''
  const barWidth = Math.min(BAR_WIDTH, rest - MIN_TITLE - 1)
  const bar = barWidth >= MIN_BAR ? barWidth : 0
  const { title, artist } = fitTitle(track.title, track.artist, Math.min(MAX_TITLE, rest - (bar ? bar + 1 : 0)))
  const glyph = track.playing ? fg(PALETTE.music, '♪') : fg(PALETTE.musicDim, '❚❚')
  return [
    `${glyph} ${fg(PALETTE.music, title)}${artist ? fg(PALETTE.artist, ` — ${artist}`) : ''}`,
    bar ? renderSeek(track, bar) : '',
    fg(PALETTE.time, time),
  ]
    .filter(Boolean)
    .join(' ')
}
