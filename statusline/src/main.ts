// Claude Code status line entry point. Claude Code pipes session JSON to stdin and
// shows whatever this prints. Layout:
//   ✻ Model | [context bar] NN% | branch + git status | "short quote" - Author | 12h time
import { renderBar } from './bar.ts'
import { gitSummary, paintGit } from './git.ts'
import { readInput } from './input.ts'
import { currentQuote } from './quote.ts'
import { fg, levelColor, PALETTE } from './theme.ts'

const input = readInput()
const now = Date.now()
const dir = input.workspace?.current_dir ?? input.cwd ?? process.cwd()
const percent = Math.round(input.context_window?.used_percentage ?? 0)
const time = new Date(now).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
const git = gitSummary(dir, now)
const quote = currentQuote(now)

// A text status line can't draw the SVG logo, so use the starburst glyph Claude Code itself uses.
const model = fg(PALETTE.claude, `✻ ${input.model?.display_name ?? '?'}`)
const context = `${renderBar(percent)} ${fg(levelColor(percent), `${percent}%`)}`
const quoteText = quote && `${fg(PALETTE.quote, `“${quote.text}”`, true)} ${fg(PALETTE.author, `— ${quote.author}`, true)}`

console.log(
  [model, context, git && paintGit(git), quoteText, fg(PALETTE.time, time)]
    .filter(Boolean)
    .join(fg(PALETTE.divider, ' | ')),
)
