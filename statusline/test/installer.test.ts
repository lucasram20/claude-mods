import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { inspect, installRoot, installSteps, runSteps, settingsPath, uninstallSteps } from '../src/installer/install.ts'
import {
  isOurs,
  parseSettings,
  REFRESH_SECONDS,
  statusCommand,
  withoutStatusLine,
  withStatusLine,
} from '../src/installer/settings.ts'

/** A throwaway Claude config folder plus a fake built runtime to install from. */
function sandbox() {
  const base = mkdtempSync(join(tmpdir(), 'installer-test-'))
  const claudeDir = join(base, '.claude')
  const sourceDir = join(base, 'dist-runtime')
  mkdirSync(claudeDir)
  mkdirSync(sourceDir)
  writeFileSync(join(sourceDir, 'main.js'), 'console.log("hi")\n')
  writeFileSync(join(sourceDir, 'bar.js'), 'export {}\n')
  writeFileSync(join(sourceDir, 'main.js.map'), '{}') // only .js files are copied
  return { claudeDir, sourceDir }
}

const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8'))

test('parseSettings: empty is fine, garbage throws', () => {
  assert.deepEqual(parseSettings(undefined), {})
  assert.deepEqual(parseSettings('  '), {})
  assert.deepEqual(parseSettings('\uFEFF{"a":1}'), { a: 1 })
  assert.throws(() => parseSettings('{ nope'), /not valid JSON/)
  assert.throws(() => parseSettings('[1]'), /not valid JSON/)
})

test('statusCommand uses forward slashes and quotes the path', () => {
  assert.equal(
    statusCommand('C:\\Users\\a b\\.claude\\claude-mods-statusline'),
    'node "C:/Users/a b/.claude/claude-mods-statusline/runtime/main.js"',
  )
})

test('withStatusLine / withoutStatusLine only touch our own entry', () => {
  const mine = withStatusLine({ theme: 'dark' }, statusCommand('/h/.claude/claude-mods-statusline'))
  assert.equal(isOurs(mine), true)
  assert.deepEqual(withoutStatusLine(mine), { theme: 'dark' })

  const foreign = { statusLine: { type: 'command', command: 'node other.js' } }
  assert.equal(isOurs(foreign), false)
  assert.equal(withoutStatusLine(foreign), foreign)
})

test('install into a fresh config folder', () => {
  const { claudeDir, sourceDir } = sandbox()
  runSteps(installSteps({ claudeDir, sourceDir }))

  const root = installRoot(claudeDir)
  assert.deepEqual(readdirSync(join(root, 'runtime')).sort(), ['bar.js', 'main.js'])
  assert.equal(readJson(join(root, 'package.json')).type, 'module')
  const { statusLine } = readJson(settingsPath(claudeDir))
  assert.equal(statusLine.command, statusCommand(root))
  assert.equal(statusLine.refreshInterval, REFRESH_SECONDS)
  assert.equal(existsSync(join(root, '.env')), false)
})

test('install keeps other settings, replaces a foreign status line and backs up first', () => {
  const { claudeDir, sourceDir } = sandbox()
  const original = { theme: 'dark', statusLine: { type: 'command', command: 'node gsd.js' }, hooks: { a: 1 } }
  writeFileSync(settingsPath(claudeDir), JSON.stringify(original))

  runSteps(installSteps({ claudeDir, sourceDir }))

  const after = readJson(settingsPath(claudeDir))
  assert.equal(after.theme, 'dark')
  assert.deepEqual(after.hooks, { a: 1 })
  assert.equal(isOurs(after), true)
  const backups = readdirSync(claudeDir).filter(f => f.startsWith('settings.json.bak-claude-mods-'))
  assert.equal(backups.length, 1)
  assert.deepEqual(readJson(join(claudeDir, backups[0] ?? '')), original)
})

test('a broken settings.json aborts before anything is written', () => {
  const { claudeDir, sourceDir } = sandbox()
  writeFileSync(settingsPath(claudeDir), '{ broken')
  assert.throws(() => runSteps(installSteps({ claudeDir, sourceDir })), /not valid JSON/)
  assert.equal(existsSync(installRoot(claudeDir)), false)
  assert.equal(readFileSync(settingsPath(claudeDir), 'utf8'), '{ broken')
  assert.match(inspect(claudeDir).settingsError ?? '', /not valid JSON/)
})

test('uninstall removes our files and status line but not a foreign one', () => {
  const { claudeDir, sourceDir } = sandbox()
  runSteps(installSteps({ claudeDir, sourceDir }))
  runSteps(uninstallSteps(claudeDir))
  assert.equal(existsSync(installRoot(claudeDir)), false)
  assert.equal('statusLine' in readJson(settingsPath(claudeDir)), false)

  const foreign = { statusLine: { type: 'command', command: 'node other.js' } }
  writeFileSync(settingsPath(claudeDir), JSON.stringify(foreign))
  runSteps(uninstallSteps(claudeDir))
  assert.deepEqual(readJson(settingsPath(claudeDir)), foreign)
})

test('re-install drops what 0.1.x left behind: the quotes key and setting', () => {
  const { claudeDir, sourceDir } = sandbox()
  const root = installRoot(claudeDir)
  mkdirSync(root, { recursive: true })
  writeFileSync(join(root, '.env'), 'API_NINJAS_KEY=abcDEF123456')
  writeFileSync(join(root, 'config.json'), '{"quotes":true}')
  runSteps(installSteps({ claudeDir, sourceDir }))
  assert.equal(existsSync(join(root, '.env')), false)
  assert.equal(existsSync(join(root, 'config.json')), false)
})
