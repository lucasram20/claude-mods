import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  isOurs,
  MARKER,
  parseSettings,
  statusCommand,
  statusLineOf,
  withoutStatusLine,
  withStatusLine,
  type Settings,
  type StatusLine,
} from './settings.ts'

/** Claude Code's config folder (it honours CLAUDE_CONFIG_DIR too). */
export const claudeDir = (env: NodeJS.ProcessEnv = process.env): string =>
  env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude')

export const installRoot = (dir: string): string => join(dir, MARKER)
export const settingsPath = (dir: string): string => join(dir, 'settings.json')

/** Can this machine show what is playing? Linux needs `playerctl`; macOS isn't supported yet. */
export type MusicSupport = 'ready' | 'needs-playerctl' | 'unsupported'

function musicSupport(): MusicSupport {
  if (process.platform === 'win32') return 'ready'
  if (process.platform !== 'linux') return 'unsupported'
  try {
    execFileSync('playerctl', ['--version'], { stdio: 'ignore', timeout: 3000 })
    return 'ready'
  } catch {
    return 'needs-playerctl'
  }
}

export interface Inspection {
  settingsPath: string
  current: StatusLine | undefined
  ours: boolean
  hasGit: boolean
  music: MusicSupport
  settingsError: string | undefined
}

export function inspect(dir: string): Inspection {
  const file = settingsPath(dir)
  let settings: Settings = {}
  let settingsError: string | undefined
  try {
    settings = parseSettings(existsSync(file) ? readFileSync(file, 'utf8') : undefined)
  } catch (error) {
    settingsError = (error as Error).message
  }

  let hasGit = true
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore', timeout: 3000 })
  } catch {
    hasGit = false
  }

  return { settingsPath: file, current: statusLineOf(settings), ours: isOurs(settings), hasGit, music: musicSupport(), settingsError }
}

/** One unit of work. `run` may return a short detail to show next to the label, or throw. */
export interface Step {
  label: string
  run(): string | void
}

export interface InstallOptions {
  claudeDir: string
  /** Folder holding the built runtime `.js` files (dist/runtime). */
  sourceDir: string
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-')

/** Writes next to the target and renames, so a crash can't leave a half-written settings.json. */
function writeSettings(file: string, settings: Settings): void {
  const tmp = `${file}.tmp-${process.pid}`
  writeFileSync(tmp, `${JSON.stringify(settings, null, 2)}\n`)
  renameSync(tmp, file)
}

function backup(file: string): string {
  const copy = `${file}.bak-claude-mods-${stamp()}`
  copyFileSync(file, copy)
  return copy
}

export function installSteps(opts: InstallOptions): Step[] {
  const root = installRoot(opts.claudeDir)
  const file = settingsPath(opts.claudeDir)
  let settings: Settings = {}

  return [
    {
      // Everything that can fail on the user's side is checked first, before anything is written.
      label: 'Checking your settings',
      run() {
        settings = parseSettings(existsSync(file) ? readFileSync(file, 'utf8') : undefined)
        if (!readdirSync(opts.sourceDir).some(f => f.endsWith('.js'))) {
          throw new Error(`No built files in ${opts.sourceDir}. Run "npm run build" first.`)
        }
      },
    },
    {
      label: 'Copying the status line',
      run() {
        const files = readdirSync(opts.sourceDir).filter(f => f.endsWith('.js'))
        const runtime = join(root, 'runtime')
        mkdirSync(root, { recursive: true })
        // The copied files are ES modules; this makes Node treat them that way.
        writeFileSync(join(root, 'package.json'), '{\n  "type": "module",\n  "private": true\n}\n')
        rmSync(runtime, { recursive: true, force: true })
        mkdirSync(runtime)
        for (const f of files) copyFileSync(join(opts.sourceDir, f), join(runtime, f))
        // 0.1.x kept a quotes API key and a quotes setting here; nothing reads them any more.
        rmSync(join(root, '.env'), { force: true })
        rmSync(join(root, 'config.json'), { force: true })
        return root
      },
    },
    {
      label: 'Updating settings.json',
      run() {
        mkdirSync(opts.claudeDir, { recursive: true })
        const saved = existsSync(file) ? backup(file) : undefined
        writeSettings(file, withStatusLine(settings, statusCommand(root)))
        return saved ? `backup: ${saved}` : 'created'
      },
    },
  ]
}

export function uninstallSteps(dir: string): Step[] {
  const root = installRoot(dir)
  const file = settingsPath(dir)
  let settings: Settings = {}

  return [
    {
      label: 'Checking your settings',
      run() {
        settings = parseSettings(existsSync(file) ? readFileSync(file, 'utf8') : undefined)
      },
    },
    {
      label: 'Removing the status line from settings.json',
      run() {
        if (!isOurs(settings)) return 'not ours, left untouched'
        const saved = backup(file)
        writeSettings(file, withoutStatusLine(settings))
        return `backup: ${saved}`
      },
    },
    {
      label: 'Deleting the installed files',
      run() {
        rmSync(root, { recursive: true, force: true })
        return root
      },
    },
  ]
}

/** Runs steps in order and returns each step's detail. The UI drives them one by one instead. */
export function runSteps(steps: Step[]): { label: string; detail: string | void }[] {
  return steps.map(step => ({ label: step.label, detail: step.run() }))
}
