// Claude Code status line entry point. Claude Code pipes session JSON to stdin and
// shows whatever this prints. Layout:
//   ✻ Model | Context: [shimmering bar] NN% | branch + git status | 12h time
//   "a random quote" - Author
import { renderBar } from './bar.ts'
import { gitSummary } from './git.ts'
import { readInput } from './input.ts'
import { currentQuote } from './quote.ts'

// Claude brand color #d97757. A text status line can't draw the SVG logo, so use the
// starburst glyph Claude Code itself uses.
const LOGO = '\x1b[38;2;217;119;87m✻\x1b[0m'

const input = readInput()
const now = Date.now()
const dir = input.workspace?.current_dir ?? input.cwd ?? process.cwd()
const percent = Math.round(input.context_window?.used_percentage ?? 0)
const time = new Date(now).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

console.log(
  [
    `${LOGO} ${input.model?.display_name ?? '?'}`,
    `Context: ${renderBar(percent, now)} ${percent}%`,
    gitSummary(dir, now),
    time,
  ]
    .filter(Boolean)
    .join(' | '),
)

const quote = currentQuote(now)
if (quote) console.log(`\x1b[2;3m“${quote.text}” — ${quote.author}\x1b[0m`)
