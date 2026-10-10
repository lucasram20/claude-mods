import { renderBar } from './bar.ts'
import { paintGit } from './git.ts'
import { renderMusic } from './music-line.ts'
import type { Track } from './player.ts'
import { fg, levelColor, PALETTE } from './theme.ts'

export interface LineParts {
  model: string
  percent: number
  git: string // plain `summarize` output, empty outside a repo
  music?: Track | undefined // what is playing right now, if anything
  columns?: number // terminal width, so a long title can't push the line past the edge
  time: string
}

const DIVIDER = ' | '
const MARGIN = 2 // Claude Code pads the status line a little; stay clear of the edge

/** Characters on screen, ignoring color codes. */
const visibleLength = (text: string): number => text.replace(/\x1b\[[0-9;]*m/g, '').length

/** The status line: `✻ Model | bar NN% | branch flags | ♪ Song — Artist ▂▅▇ 1:12/4:21 | time` */
export function buildLine({ model, percent, git, music, columns = 100, time }: LineParts): string {
  const head = [
    // A text status line can't draw the SVG logo, so use the starburst glyph Claude Code itself uses.
    fg(PALETTE.claude, `✻ ${model}`),
    `${renderBar(percent)} ${fg(levelColor(percent), `${percent}%`)}`,
    git && paintGit(git),
  ].filter(Boolean)
  const clock = fg(PALETTE.time, time)

  // The song takes whatever width the other parts leave, and the clock stays last.
  const used = [...head, clock].reduce((sum, part) => sum + visibleLength(part), 0) + DIVIDER.length * head.length
  const song = music ? renderMusic(music, columns - MARGIN - used - DIVIDER.length) : ''

  return [...head, song, clock].filter(Boolean).join(fg(PALETTE.divider, DIVIDER))
}
