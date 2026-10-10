import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import { buildLine } from '../runtime/line.ts'
import { fg, PALETTE, RESET_ALL, type Rgb } from '../runtime/theme.ts'
import { API_KEY_PATTERN, inspect, installSteps, uninstallSteps } from './install.ts'
import { MARKER } from './settings.ts'

const PLATFORMS: Record<string, string> = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' }
const RED: Rgb = [225, 85, 85]

// Plain text when piped (CI, logs); color only on a real terminal.
const color = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR
const paint = (rgb: Rgb, text: string) => (color ? fg(rgb, text) : text)
const dim = (text: string) => (color ? `\x1b[2m${text}${RESET_ALL}` : text)
const short = (text: string, max = 64) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

const SAMPLE = { model: 'Opus', percent: 38, git: 'main +1 ~2', time: '5:42 PM' }

export interface UiOptions {
  mode: 'install' | 'uninstall'
  /** Interactive prompts; off for --yes and when there is no terminal. */
  ask: boolean
  claudeDir: string
  sourceDir: string
  /** API key from the API_NINJAS_KEY environment variable (non-interactive installs). */
  envKey?: string | undefined
  /** Forces quotes on or off without prompting; leave out to decide from the key and earlier choice. */
  quotes?: boolean | undefined
}

/** One question on its own readline, so a secret answer can be typed without echo. */
async function question(prompt: string, secret = false): Promise<string> {
  const mute = new Writable({ write: (_chunk, _encoding, done) => done() })
  const rl = createInterface({ input: process.stdin, output: secret ? mute : process.stdout, terminal: true })
  rl.once('SIGINT', () => {
    rl.close()
    console.log()
    process.exit(130)
  })
  if (secret) process.stdout.write(prompt)
  try {
    const answer = await rl.question(secret ? '' : prompt)
    if (secret) console.log()
    return answer.trim()
  } finally {
    rl.close()
  }
}

async function yesNo(text: string, fallback: boolean): Promise<boolean> {
  for (;;) {
    const answer = (await question(`${paint(PALETTE.claude, '? ')}${text} ${dim(fallback ? '(Y/n)' : '(y/N)')} `)).toLowerCase()
    if (answer === '') return fallback
    if (answer.startsWith('y')) return true
    if (answer.startsWith('n')) return false
  }
}

/** Returns the new key, `undefined` to keep the saved one, or `null` when quotes should stay off. */
async function askKey(hasSavedKey: boolean): Promise<string | undefined | null> {
  const hint = hasSavedKey ? 'Enter keeps your saved key' : 'Enter with nothing turns quotes off'
  console.log(dim(`Free at https://api-ninjas.com/register. It is stored only in ${MARKER}/.env on this machine.`))
  for (;;) {
    const value = await question(`${paint(PALETTE.claude, '? ')}API Ninjas key ${dim(`(${hint}, typing is hidden)`)} `, true)
    if (!value) return hasSavedKey ? undefined : null
    if (API_KEY_PATTERN.test(value)) return value
    console.log(paint(RED, 'That does not look like an API key. Paste it again.'))
  }
}

/** Runs the installer or uninstaller. Resolves to the process exit code. */
export async function run(options: UiOptions): Promise<number> {
  const { mode, ask, claudeDir, sourceDir, envKey, quotes } = options
  const installing = mode === 'install'
  const info = inspect(claudeDir)
  const say = (text = '') => console.log(text)

  say()
  say(`${paint(PALETTE.claude, '✻ claude-mods')} · statusline ${installing ? 'installer' : 'uninstaller'}`)
  say()
  const row = (label: string, value: string) => say(`${dim(label.padEnd(9))}${value}`)
  row('System', `${PLATFORMS[process.platform] ?? process.platform} · Node ${process.version}`)
  row('Config', info.settingsPath)
  if (installing) {
    const current = !info.current
      ? 'none'
      : info.ours
        ? 'claude-mods statusline (will be updated)'
        : `${short(info.current.command ?? 'custom')} (will be replaced)`
    row('Current', current)
    row('Git', info.hasGit ? paint(PALETTE.staged, 'found') : paint(PALETTE.modified, 'not found, so the branch will be hidden'))
  }

  if (info.settingsError) {
    say()
    say(paint(RED, `✖ ${info.settingsError}`))
    return 1
  }

  // Without prompts: an explicit flag, else on when a key was provided or is already saved.
  let wantQuotes = ask ? info.quotesOn : (quotes ?? (Boolean(envKey?.trim()) || (info.hasKey && info.quotesOn)))
  let apiKey = envKey?.trim() || undefined

  if (ask) {
    if (installing) {
      say()
      say(dim('Preview'))
      say(buildLine({ ...SAMPLE, quote: { text: 'Less is more.', author: 'Mies' } }))
    }
    say()
    if (!(await yesNo(installing ? 'Install the status line?' : `Remove the status line and the ${MARKER} folder?`, true))) {
      say(dim('Nothing was changed.'))
      return 0
    }
    if (installing) {
      wantQuotes = await yesNo('Add a random quote to the status line? (needs a free API Ninjas key)', info.quotesOn)
      if (wantQuotes) {
        const key = await askKey(info.hasKey)
        if (key === null) {
          wantQuotes = false
          say(dim('No key, so quotes stay off.'))
        } else {
          apiKey = key
        }
      }
    }
  }

  say()
  const steps = installing ? installSteps({ claudeDir, sourceDir, quotes: wantQuotes, apiKey }) : uninstallSteps(claudeDir)
  for (const step of steps) {
    try {
      const detail = step.run()
      say(`${paint(PALETTE.staged, '✔')} ${step.label}${detail ? dim(` ${short(detail, 90)}`) : ''}`)
    } catch (error) {
      say(paint(RED, `✖ ${(error as Error).message}`))
      return 1
    }
  }

  say()
  say(
    paint(
      PALETTE.staged,
      installing
        ? 'All set! Start (or restart) Claude Code to see your new status line.'
        : 'Removed. Restart Claude Code to go back to the default status line.',
    ),
  )
  if (installing && !wantQuotes) say(dim('Quotes are off. Run the installer again to turn them on.'))
  if (installing) say(dim('To remove it later: npx claude-mods-statusline --uninstall'))
  return 0
}
