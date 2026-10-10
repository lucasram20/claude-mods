import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { CONFIG_FILE, quotesSetting } from '../runtime/config.ts'
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

/** Keys are alphanumeric tokens; rejecting anything else keeps `.env` injection out. */
export const API_KEY_PATTERN = /^[A-Za-z0-9_\-+/=.]{8,}$/

export interface Inspection {
  settingsPath: string
  current: StatusLine | undefined
  ours: boolean
  hasGit: boolean
  hasKey: boolean
  /** The saved quotes choice (on unless the installer turned it off earlier). */
  quotesOn: boolean
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

  let hasKey = false
  try {
    hasKey = /^API_NINJAS_KEY=\S+/m.test(readFileSync(join(installRoot(dir), '.env'), 'utf8'))
  } catch {} // not installed yet

  const quotesOn = quotesSetting(join(installRoot(dir), CONFIG_FILE))

  return { settingsPath: file, current: statusLineOf(settings), ours: isOurs(settings), hasGit, hasKey, quotesOn, settingsError }
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
  /** Show a random quote. Off removes any saved API key and the status line never calls the API. */
  quotes: boolean
  /** New API Ninjas key for the quotes; leave out to keep the one already saved. */
  apiKey?: string | undefined
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

  const steps: Step[] = [
    {
      // Everything that can fail on the user's side is checked first, before anything is written.
      label: 'Checking your settings',
      run() {
        settings = parseSettings(existsSync(file) ? readFileSync(file, 'utf8') : undefined)
        if (opts.quotes && opts.apiKey !== undefined && !API_KEY_PATTERN.test(opts.apiKey)) {
          throw new Error('That API key has unexpected characters. Copy it again from api-ninjas.com/account.')
        }
        if (opts.quotes && !opts.apiKey && !existsSync(join(root, '.env'))) {
          throw new Error('Quotes need an API key. Set API_NINJAS_KEY, or run without --yes to paste it, or use --no-quotes.')
        }
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
        return root
      },
    },
  ]

  steps.push({
    label: opts.quotes ? 'Turning quotes on' : 'Leaving quotes off',
    run() {
      const env = join(root, '.env')
      writeFileSync(join(root, CONFIG_FILE), `${JSON.stringify({ quotes: opts.quotes }, null, 2)}\n`)
      if (!opts.quotes) {
        const had = existsSync(env)
        rmSync(env, { force: true }) // nobody asked for quotes, so don't keep a key around
        return had ? 'removed the saved API key' : undefined
      }
      if (!opts.apiKey) return 'kept the saved API key'
      writeFileSync(env, `API_NINJAS_KEY=${opts.apiKey}\n`, { mode: 0o600 })
      chmodSync(env, 0o600) // writeFileSync's mode is ignored when the file already exists
      return 'saved your API key'
    },
  })

  steps.push({
    label: 'Updating settings.json',
    run() {
      mkdirSync(opts.claudeDir, { recursive: true })
      const saved = existsSync(file) ? backup(file) : undefined
      writeSettings(file, withStatusLine(settings, statusCommand(root)))
      return saved ? `backup: ${saved}` : 'created'
    },
  })
  return steps
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
