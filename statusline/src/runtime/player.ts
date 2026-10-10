// Reads whatever music app is playing: YouTube Music, Spotify, a browser tab...
// Windows asks the system media controls (the same ones the volume flyout shows) through
// PowerShell; Linux asks any MPRIS player through `playerctl`. Nothing else is supported yet.
import { spawn, spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline'

export interface Track {
  title: string
  artist: string
  playing: boolean
  /** Seconds into the track at `at`. */
  position: number
  /** Track length in seconds; 0 when the player doesn't say (live streams). */
  duration: number
  /** When `position` was measured (epoch ms), so it can be advanced while playing. */
  at: number
}

/** How often the player is read while the status line is open. */
export const POLL_MS = 1000

/** Titles come from web pages and files, so drop anything that could act as a terminal escape. */
export const clean = (text: unknown): string =>
  String(text ?? '').replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').trim()

const seconds = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

// --- Windows ---------------------------------------------------------------------------

// Windows PowerShell 5.1 ships with every Windows and can call the WinRT media API. Starting
// it costs about half a second, so one PowerShell stays open and answers once a second. The
// script goes in on stdin: no file to ship and no execution policy to fight. It quits when
// the Node process that started it is gone, so it can't be left running.
const windowsScript = (parentPid: number): string => `
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
function Await($op, $type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$manager = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
${GET_TRACK}
while ($true) { try { Get-Track } catch { '{}' }; try { [void][System.Diagnostics.Process]::GetProcessById(${parentPid}) } catch { exit }; Start-Sleep -Milliseconds ${POLL_MS} }
`

// PowerShell reads stdin one line at a time and silently drops a block that spans several
// lines, so each block is joined onto a single line.
const GET_TRACK = `function Get-Track { ${[
  `$session = @($manager.GetSessions()) | Where-Object { $_.GetPlaybackInfo().PlaybackStatus.ToString() -eq 'Playing' } | Select-Object -First 1`,
  `if (-not $session) { $session = $manager.GetCurrentSession() }`,
  `if (-not $session) { return '{}' }`,
  `$props = Await ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])`,
  `$timeline = $session.GetTimelineProperties()`,
  `$playing = $session.GetPlaybackInfo().PlaybackStatus.ToString() -eq 'Playing'`,
  `$now = [DateTimeOffset]::UtcNow`,
  `$position = $timeline.Position.TotalSeconds`,
  `if ($playing) { $position += ($now - $timeline.LastUpdatedTime).TotalSeconds }`,
  `return ([pscustomobject]@{ title = $props.Title; artist = $props.Artist; playing = $playing; position = $position; duration = ($timeline.EndTime - $timeline.StartTime).TotalSeconds; at = $now.ToUnixTimeMilliseconds() } | ConvertTo-Json -Compress)`,
].join('; ')} }`

/** Turns the PowerShell script's JSON line into a Track. `readAt` is used when the script gave no time of its own. */
export function parseWindows(output: string, readAt: number): Track | undefined {
  try {
    const j = JSON.parse(output.trim()) as Record<string, unknown>
    const title = clean(j.title)
    if (!title) return undefined
    const duration = seconds(j.duration)
    const position = seconds(j.position)
    const at = seconds(j.at) || readAt // measured inside the script, before PowerShell's own exit time
    return { title, artist: clean(j.artist), playing: j.playing === true, position: duration ? Math.min(position, duration) : position, duration, at }
  } catch {
    return undefined // no player, or PowerShell said something else
  }
}

function watchWindows(onRead: (track: Track | undefined) => void, onEnd: () => void): () => void {
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '-'], {
    stdio: ['pipe', 'pipe', 'ignore'],
    windowsHide: true,
  })
  child.stdin.on('error', () => {}) // PowerShell going away first is handled by 'exit'
  child.stdin.end(windowsScript(process.pid))
  createInterface({ input: child.stdout }).on('line', line => onRead(parseWindows(line, Date.now())))
  child.on('exit', onEnd)
  child.on('error', onEnd)
  return () => child.kill()
}

// --- Linux -----------------------------------------------------------------------------

const SEP = '\x1f'
const PLAYERCTL_FORMAT = ['{{status}}', '{{artist}}', '{{title}}', '{{position}}', '{{mpris:length}}'].join(SEP)

/** One line per player (`playerctl -a`): the playing one wins, otherwise the first. */
export function parsePlayerctl(output: string, at: number): Track | undefined {
  const tracks = output
    .split('\n')
    .map((line): Track | undefined => {
      const [status = '', artist = '', title = '', position = '', length = ''] = line.split(SEP)
      if (!clean(title)) return undefined
      // playerctl reports microseconds
      const duration = seconds(length) / 1e6
      return {
        title: clean(title),
        artist: clean(artist),
        playing: status === 'Playing',
        position: Math.min(seconds(position) / 1e6, duration || Infinity),
        duration,
        at,
      }
    })
    .filter((t): t is Track => t !== undefined)
  return tracks.find(t => t.playing) ?? tracks[0]
}

function readLinux(): Track | undefined {
  const result = spawnSync('playerctl', ['-a', 'metadata', '--format', PLAYERCTL_FORMAT], { encoding: 'utf8', timeout: 5000 })
  if (result.error) throw result.error // playerctl is not installed
  return result.status === 0 ? parsePlayerctl(result.stdout, Date.now()) : undefined
}

function watchLinux(onRead: (track: Track | undefined) => void, onEnd: () => void): () => void {
  const timer = setInterval(() => {
    try {
      onRead(readLinux())
    } catch {
      clearInterval(timer)
      onEnd()
    }
  }, POLL_MS)
  return () => clearInterval(timer)
}

// ---------------------------------------------------------------------------------------

/**
 * Calls `onRead` with the current track (undefined when nothing is open) every `POLL_MS`.
 * `onEnd` runs if reading is impossible (no PowerShell, no playerctl, unsupported system).
 * Returns a function that stops it.
 */
export function watchPlayer(onRead: (track: Track | undefined) => void, onEnd: () => void): () => void {
  if (process.platform === 'win32') return watchWindows(onRead, onEnd)
  if (process.platform === 'linux') return watchLinux(onRead, onEnd)
  queueMicrotask(onEnd)
  return () => {}
}
