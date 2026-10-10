#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

const HELP = `claude-mods-statusline: install the claude-mods status line into Claude Code

Usage: npx claude-mods-statusline [options]

Options:
  -y, --yes        Skip the prompts and install
      --uninstall  Remove the status line and the files this installer added
  -h, --help       Show this help
  -v, --version    Show the version

Environment:
  CLAUDE_CONFIG_DIR   Claude Code config folder (default: ~/.claude)
`

let args: { yes?: boolean; uninstall?: boolean; help?: boolean; version?: boolean }
try {
  args = parseArgs({
    options: {
      yes: { type: 'boolean', short: 'y' },
      uninstall: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  }).values
} catch (error) {
  console.error(`${(error as Error).message}\n\n${HELP}`)
  process.exit(2)
}

if (args.help) {
  console.log(HELP)
  process.exit(0)
}

if (args.version) {
  const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'package.json'), 'utf8'))
  console.log(pkg.version)
  process.exit(0)
}

// Checked before the installer loads, so an old Node gets a clear message instead of a syntax error.
if (Number(process.versions.node.split('.')[0]) < 22) {
  console.error(`Node.js 22 or newer is required (you have ${process.versions.node}). Get it at https://nodejs.org`)
  process.exit(1)
}

const { run } = await import('./ui.ts')
const { claudeDir } = await import('./install.ts')

process.exitCode = await run({
  mode: args.uninstall ? 'uninstall' : 'install',
  ask: !args.yes && Boolean(process.stdin.isTTY && process.stdout.isTTY),
  claudeDir: claudeDir(),
  sourceDir: join(import.meta.dirname, '..', 'runtime'),
})
