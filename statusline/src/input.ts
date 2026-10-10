import { readFileSync } from 'node:fs'

/** The subset of Claude Code's status line JSON (sent on stdin) that we use. */
export interface StatusInput {
  model?: { display_name?: string }
  workspace?: { current_dir?: string }
  cwd?: string
  context_window?: { used_percentage?: number | null }
}

export function readInput(): StatusInput {
  try {
    // Strip a UTF-8 BOM: Windows PowerShell adds one when piping text.
    return JSON.parse(readFileSync(0, 'utf8').replace(/^﻿/, ''))
  } catch {
    return {} // empty or malformed stdin: render with defaults
  }
}
