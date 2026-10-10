import { renderBar } from './bar.ts'
import { paintGit } from './git.ts'
import type { Quote } from './quote.ts'
import { fg, levelColor, PALETTE } from './theme.ts'

export interface LineParts {
  model: string
  percent: number
  git: string // plain `summarize` output, empty outside a repo
  quote?: Quote | undefined
  time: string
}

/** The status line itself: ✻ Model | bar NN% | branch flags | “quote” — Author | time */
export function buildLine({ model, percent, git, quote, time }: LineParts): string {
  const quoteText =
    quote &&
    `${fg(PALETTE.quote, `“${quote.text}”`, true)} ${fg(PALETTE.author, `— ${quote.author}`, true)}`

  return [
    // A text status line can't draw the SVG logo, so use the starburst glyph Claude Code itself uses.
    fg(PALETTE.claude, `✻ ${model}`),
    `${renderBar(percent)} ${fg(levelColor(percent), `${percent}%`)}`,
    git && paintGit(git),
    quoteText,
    fg(PALETTE.time, time),
  ]
    .filter(Boolean)
    .join(fg(PALETTE.divider, ' | '))
}
