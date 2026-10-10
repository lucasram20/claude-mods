// Claude Code status line entry point. Claude Code pipes session JSON to stdin and
// shows whatever this prints (see line.ts for the layout).
import { gitSummary } from './git.ts'
import { readInput } from './input.ts'
import { buildLine } from './line.ts'
import { currentQuote } from './quote.ts'

const input = readInput()
const now = Date.now()

console.log(
  buildLine({
    model: input.model?.display_name ?? '?',
    percent: Math.round(input.context_window?.used_percentage ?? 0),
    git: gitSummary(input.workspace?.current_dir ?? input.cwd ?? process.cwd(), now),
    quote: currentQuote(now),
    time: new Date(now).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
  }),
)
