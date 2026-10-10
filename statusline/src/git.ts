import { execFileSync } from 'node:child_process'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fg, PALETTE, type Rgb } from './theme.ts'

const CACHE_TTL_MS = 5000

/** Turns `git status --porcelain=v1 -b` output into "main +2 ~3 ?1 ↑1" or "main clean". */
export function summarize(out: string): string {
  const [head, ...files] = out.split('\n').filter(Boolean)
  if (!head) return ''

  const branch = (head.slice(3).split('...')[0] ?? '').replace(/^No commits yet on /, '')
  let staged = 0
  let modified = 0
  let untracked = 0
  for (const f of files) {
    if (f.startsWith('??')) untracked++
    else {
      if (f[0] !== ' ') staged++
      if (f[1] !== ' ') modified++
    }
  }

  const ahead = /ahead (\d+)/.exec(head)?.[1]
  const behind = /behind (\d+)/.exec(head)?.[1]
  const flags = [
    staged && `+${staged}`,
    modified && `~${modified}`,
    untracked && `?${untracked}`,
    ahead && `↑${ahead}`,
    behind && `↓${behind}`,
  ].filter(Boolean)
  return `${branch} ${flags.length ? flags.join(' ') : 'clean'}`
}

const FLAG_COLORS: [RegExp, Rgb][] = [
  [/^\+\d+$/, PALETTE.staged],
  [/^~\d+$/, PALETTE.modified],
  [/^\?\d+$/, PALETTE.untracked],
  [/^[↑↓]\d+$/, PALETTE.sync],
  [/^clean$/, PALETTE.clean],
]

/** Colors a `summarize` result: purple branch, then each flag in its own color. */
export function paintGit(summary: string): string {
  const words = summary.split(' ')
  let split = words.length // index where the trailing flags begin
  while (split > 1 && FLAG_COLORS.some(([re]) => re.test(words[split - 1] ?? ''))) split--
  const flags = words.slice(split).map(w => fg(FLAG_COLORS.find(([re]) => re.test(w))?.[1] ?? PALETTE.divider, w))
  return [fg(PALETTE.branch, words.slice(0, split).join(' ')), ...flags].join(' ')
}

function run(dir: string): string {
  try {
    return execFileSync('git', ['--no-optional-locks', 'status', '--porcelain=v1', '-b'], {
      cwd: dir,
      encoding: 'utf8',
      timeout: 1000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return '' // not a repo, or git missing
  }
}

/** Git summary for `dir`, cached on disk for a few seconds so most ticks spawn nothing. */
export function gitSummary(dir: string, now: number): string {
  const key = Buffer.from(dir).toString('base64url').slice(-40)
  const file = join(tmpdir(), `claude-statusline-git-${key}`)
  try {
    if (now - statSync(file).mtimeMs < CACHE_TTL_MS) return readFileSync(file, 'utf8')
  } catch {} // no cache yet

  const summary = summarize(run(dir))
  try {
    writeFileSync(file, summary)
  } catch {} // cache is best-effort
  return summary
}
