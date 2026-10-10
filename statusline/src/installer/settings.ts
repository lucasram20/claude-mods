import { join } from 'node:path'

/** Appears in the install path, which is how we recognise our own entry in settings.json. */
export const MARKER = 'claude-mods-statusline'
export const REFRESH_SECONDS = 1 // the shortest Claude Code allows: keeps the clock and the song time moving while a session is idle

export type Settings = Record<string, unknown>

export interface StatusLine {
  type?: string
  command?: string
  refreshInterval?: number
}

const INVALID = 'settings.json is not valid JSON, so it was left untouched. Fix it and run the installer again.'

/** Parses settings.json text. A missing or empty file is `{}`; anything unparsable throws. */
export function parseSettings(text: string | undefined): Settings {
  if (text === undefined || text.trim() === '') return {}
  let value: unknown
  try {
    value = JSON.parse(text.replace(/^﻿/, ''))
  } catch {
    throw new Error(INVALID)
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(INVALID)
  return value as Settings
}

export function statusLineOf(settings: Settings): StatusLine | undefined {
  const sl = settings.statusLine
  return typeof sl === 'object' && sl !== null ? (sl as StatusLine) : undefined
}

export const isOurs = (settings: Settings): boolean => statusLineOf(settings)?.command?.includes(MARKER) === true

/** `node "<root>/runtime/main.js"`, with forward slashes so it works in Git Bash, PowerShell and sh. */
export const statusCommand = (root: string): string =>
  `node "${join(root, 'runtime', 'main.js').replaceAll('\\', '/')}"`

export const withStatusLine = (settings: Settings, command: string): Settings => ({
  ...settings,
  statusLine: { type: 'command', command, refreshInterval: REFRESH_SECONDS },
})

/** Drops the status line, but only if it is ours. */
export function withoutStatusLine(settings: Settings): Settings {
  if (!isOurs(settings)) return settings
  const { statusLine: _removed, ...rest } = settings
  return rest
}
