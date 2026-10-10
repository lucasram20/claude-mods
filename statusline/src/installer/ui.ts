import { createInterface } from 'node:readline/promises'
import { buildLine } from '../runtime/line.ts'
import { fg, PALETTE, RESET_ALL, type Rgb } from '../runtime/theme.ts'
import { inspect, installSteps, uninstallSteps } from './install.ts'
import { MARKER } from './settings.ts'

const PLATFORMS: Record<string, string> = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' }
const RED: Rgb = [225, 85, 85]

// Plain text when piped (CI, logs); color only on a real terminal.
const color = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR
const paint = (rgb: Rgb, text: string) => (color ? fg(rgb, text) : text)
const dim = (text: string) => (color ? `\x1b[2m${text}${RESET_ALL}` : text)
const short = (text: string, max = 64) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

const SAMPLE = {
  model: 'Opus',
  percent: 38,
  git: 'main +1 ~2',
  time: '5:42 PM',
  music: { title: 'Pandora', artist: 'Wisp', playing: true, position: 72, duration: 261, at: 0 },
}

export interface UiOptions {
  mode: 'install' | 'uninstall'
  /** Interactive prompts; off for --yes and when there is no terminal. */
  ask: boolean
  claudeDir: string
  sourceDir: string
}

/** One question on its own readline. */
async function question(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  rl.once('SIGINT', () => {
    rl.close()
    console.log()
    process.exit(130)
  })
  try {
    return (await rl.question(prompt)).trim()
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

/** Runs the installer or uninstaller. Resolves to the process exit code. */
export async function run(options: UiOptions): Promise<number> {
  const { mode, ask, claudeDir, sourceDir } = options
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
    row(
      'Music',
      info.music === 'ready'
        ? paint(PALETTE.staged, 'found')
        : info.music === 'needs-playerctl'
          ? paint(PALETTE.modified, 'playerctl not found, so install it to show what is playing')
          : paint(PALETTE.modified, 'not supported on this system yet, so nothing will show'),
    )
  }

  if (info.settingsError) {
    say()
    say(paint(RED, `✖ ${info.settingsError}`))
    return 1
  }

  if (ask) {
    if (installing) {
      say()
      say(dim('Preview'))
      say(buildLine(SAMPLE))
    }
    say()
    if (!(await yesNo(installing ? 'Install the status line?' : `Remove the status line and the ${MARKER} folder?`, true))) {
      say(dim('Nothing was changed.'))
      return 0
    }
  }

  say()
  const steps = installing ? installSteps({ claudeDir, sourceDir }) : uninstallSteps(claudeDir)
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
  if (installing) say(dim('To remove it later: npx claude-mods-statusline --uninstall'))
  return 0
}
