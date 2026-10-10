#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

const HELP = `claude-mods-statusline: install the claude-mods status line into Claude Code

Usage: npx claude-mods-statusline [options]

Options:
  -y, --yes        Skip the prompts and install with defaults
      --uninstall  Remove the status line and the files this installer added
  -h, --help       Show this help
  -v, --version    Show the version

Environment:
  API_NINJAS_KEY      Quotes API key to save when running with --yes
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

// Checked before loading Ink, which refuses to start on older Node versions.
if (Number(process.versions.node.split('.')[0]) < 22) {
  console.error(`Node.js 22 or newer is required (you have ${process.versions.node}). Get it at https://nodejs.org`)
  process.exit(1)
}

const { render } = await import('ink')
const { App } = await import('./app.tsx')
const { claudeDir } = await import('./install.ts')

const { waitUntilExit } = render(
  <App
    mode={args.uninstall ? 'uninstall' : 'install'}
    ask={!args.yes && Boolean(process.stdin.isTTY && process.stdout.isTTY)}
    claudeDir={claudeDir()}
    sourceDir={join(import.meta.dirname, '..', 'runtime')}
    envKey={process.env.API_NINJAS_KEY}
  />,
)
await waitUntilExit()
