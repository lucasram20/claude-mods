import { Box, Text, useApp, useInput } from 'ink'
import { useEffect, useState, type ReactNode } from 'react'
import { buildLine } from '../runtime/line.ts'
import { API_KEY_PATTERN, inspect, installSteps, uninstallSteps } from './install.ts'
import { MARKER } from './settings.ts'

const ORANGE = '#d97757' // Claude brand color
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const PLATFORMS: Record<string, string> = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' }

const SAMPLE = { model: 'Opus', percent: 38, git: 'main +1 ~2', time: '5:42 PM' }
const PREVIEW = buildLine({ ...SAMPLE, quote: { text: 'Less is more.', author: 'Mies' } })
const PREVIEW_PLAIN = buildLine(SAMPLE)

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

type Phase = 'confirm' | 'quotes' | 'key' | 'run' | 'done' | 'error' | 'cancelled'

export interface AppProps {
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

function Spinner() {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setFrame(f => (f + 1) % FRAMES.length), 80)
    return () => clearInterval(timer)
  }, [])
  return <Text color={ORANGE}>{FRAMES[frame]}</Text>
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Box width={10}>
        <Text dimColor>{label}</Text>
      </Box>
      <Text>{children}</Text>
    </Box>
  )
}

const short = (text: string, max = 64) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

export function App({ mode, ask, claudeDir, sourceDir, envKey, quotes }: AppProps) {
  const { exit } = useApp()
  const installing = mode === 'install'
  const [info] = useState(() => inspect(claudeDir))
  const [phase, setPhase] = useState<Phase>(info.settingsError ? 'error' : ask ? 'confirm' : 'run')
  const [error, setError] = useState<string | undefined>(info.settingsError)
  const [typed, setTyped] = useState('')
  const [keyError, setKeyError] = useState<string>()
  const [apiKey, setApiKey] = useState<string | undefined>(envKey?.trim() || undefined)
  const [finished, setFinished] = useState<{ label: string; detail?: string | void }[]>([])
  const [current, setCurrent] = useState<string>()
  // Asked in the 'quotes' phase. With no prompts: an explicit flag, else on when a key was provided or is already saved.
  const [wantQuotes, setWantQuotes] = useState(
    ask ? info.quotesOn : (quotes ?? (Boolean(envKey?.trim()) || (info.hasKey && info.quotesOn))),
  )

  useInput(
    (input, key) => {
      if (phase === 'confirm') {
        const answer = input.toLowerCase()
        if (key.return || answer === 'y') setPhase(installing ? 'quotes' : 'run')
        else if (answer === 'n' || key.escape) setPhase('cancelled')
      } else if (phase === 'quotes') {
        const answer = input.toLowerCase()
        if (answer === 'y') {
          setWantQuotes(true)
          setPhase('key')
        } else if (answer === 'n') {
          setWantQuotes(false)
          setPhase('run')
        } else if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow || key.tab) {
          setWantQuotes(w => !w)
        } else if (key.return) {
          setPhase(wantQuotes ? 'key' : 'run')
        } else if (key.escape) {
          setPhase('cancelled')
        }
      } else if (phase === 'key') {
        if (key.return) {
          const value = typed.trim()
          if (!value && !info.hasKey) {
            setKeyError('Quotes need an API key. Paste it, or press Esc to go back and choose no quotes.')
            return
          }
          if (value && !API_KEY_PATTERN.test(value)) {
            setKeyError('That does not look like an API key. Paste it again, or press Esc to go back.')
            setTyped('')
            return
          }
          setApiKey(value || undefined)
          setPhase('run')
        } else if (key.escape) {
          setTyped('')
          setKeyError(undefined)
          setPhase('quotes')
        } else if (key.backspace || key.delete) {
          setTyped(t => t.slice(0, -1))
        } else if (input && !key.ctrl && !key.meta) {
          setKeyError(undefined)
          setTyped(t => t + input.replace(/\s/g, ''))
        }
      }
    },
    { isActive: ask && (phase === 'confirm' || phase === 'quotes' || phase === 'key') },
  )

  useEffect(() => {
    if (phase !== 'run') return
    let alive = true
    void (async () => {
      const steps = installing ? installSteps({ claudeDir, sourceDir, quotes: wantQuotes, apiKey }) : uninstallSteps(claudeDir)
      try {
        for (const step of steps) {
          if (!alive) return
          setCurrent(step.label)
          if (ask) await sleep(250) // just long enough to see each step
          const detail = step.run()
          setFinished(done => [...done, { label: step.label, detail }])
        }
        setCurrent(undefined)
        setPhase('done')
      } catch (e) {
        setCurrent(undefined)
        setError((e as Error).message)
        setPhase('error')
      }
    })()
    return () => {
      alive = false
    }
  }, [phase])

  useEffect(() => {
    if (phase === 'error') process.exitCode = 1
    if (phase === 'done' || phase === 'error' || phase === 'cancelled') exit()
  }, [phase])

  const currentLine = !info.current
    ? 'none'
    : info.ours
      ? 'claude-mods statusline (will be updated)'
      : `${short(info.current.command ?? 'custom')} (will be replaced)`

  return (
    <Box flexDirection="column" paddingY={1}>
      <Box borderStyle="round" borderColor={ORANGE} paddingX={2}>
        <Text bold color={ORANGE}>
          ✻ claude-mods
        </Text>
        <Text> · statusline {installing ? 'installer' : 'uninstaller'}</Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Row label="System">{`${PLATFORMS[process.platform] ?? process.platform} · Node ${process.version}`}</Row>
        <Row label="Config">{info.settingsPath}</Row>
        {installing && <Row label="Current">{currentLine}</Row>}
        {installing && (
          <Row label="Git">
            {info.hasGit ? <Text color="green">found</Text> : <Text color="yellow">not found, so the branch will be hidden</Text>}
          </Row>
        )}
      </Box>

      {installing && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>Preview</Text>
          <Text>{wantQuotes ? PREVIEW : PREVIEW_PLAIN}</Text>
        </Box>
      )}

      {phase === 'confirm' && (
        <Box marginTop={1}>
          <Text color={ORANGE}>? </Text>
          <Text>{installing ? 'Install the status line? ' : `Remove the status line and the ${MARKER} folder? `}</Text>
          <Text dimColor>(Y/n)</Text>
        </Box>
      )}

      {phase === 'quotes' && (
        <Box flexDirection="column" marginTop={1}>
          <Box>
            <Text color={ORANGE}>? </Text>
            <Text>Add a random quote to the status line? </Text>
            <Text dimColor>(↑/↓ to choose, Enter to confirm)</Text>
          </Box>
          <Text color={wantQuotes ? ORANGE : undefined} dimColor={!wantQuotes}>
            {wantQuotes ? '› ' : '  '}Yes, show quotes <Text dimColor>(needs a free API Ninjas key)</Text>
          </Text>
          <Text color={!wantQuotes ? ORANGE : undefined} dimColor={wantQuotes}>
            {!wantQuotes ? '› ' : '  '}No, keep it simple
          </Text>
        </Box>
      )}

      {phase === 'key' && (
        <Box flexDirection="column" marginTop={1}>
          <Box>
            <Text color={ORANGE}>? </Text>
            <Text>API Ninjas key for the quotes </Text>
            <Text dimColor>{info.hasKey ? '(Enter keeps your saved key, Esc goes back)' : '(Esc goes back)'}</Text>
          </Box>
          <Box>
            <Text color={ORANGE}>› </Text>
            <Text>{'•'.repeat(typed.length)}</Text>
            <Text color={ORANGE}>{'▌'}</Text>
          </Box>
          <Text dimColor>Free at https://api-ninjas.com/register. It is stored only in {MARKER}/.env on this machine.</Text>
          {keyError && <Text color="red">{keyError}</Text>}
        </Box>
      )}

      {(finished.length > 0 || current) && (
        <Box flexDirection="column" marginTop={1}>
          {finished.map(step => (
            <Text key={step.label} wrap="truncate-end">
              <Text color="green">✔ </Text>
              {step.label}
              {step.detail ? <Text dimColor> {short(step.detail, 90)}</Text> : null}
            </Text>
          ))}
          {current && (
            <Box>
              <Spinner />
              <Text> {current}</Text>
            </Box>
          )}
        </Box>
      )}

      {phase === 'done' && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="green">
            {installing ? 'All set! Start (or restart) Claude Code to see your new status line.' : 'Removed. Restart Claude Code to go back to the default status line.'}
          </Text>
          {installing && !wantQuotes && <Text dimColor>Quotes are off. Run the installer again to turn them on.</Text>}
          {installing && <Text dimColor>To remove it later: npx claude-mods-statusline --uninstall</Text>}
        </Box>
      )}

      {phase === 'error' && (
        <Box marginTop={1}>
          <Text color="red">✖ {error}</Text>
        </Box>
      )}

      {phase === 'cancelled' && (
        <Box marginTop={1}>
          <Text dimColor>Nothing was changed.</Text>
        </Box>
      )}
    </Box>
  )
}
