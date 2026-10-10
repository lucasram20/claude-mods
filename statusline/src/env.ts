import { readFileSync } from 'node:fs'

/** Minimal `.env` loader (KEY=value, # comments, optional quotes). Real env vars win. */
export function loadEnv(file: string): void {
  let text: string
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    return // no .env file
  }
  for (const line of text.split(/\r?\n/)) {
    if (line.trimStart().startsWith('#')) continue
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line)
    if (m?.[1]) process.env[m[1]] ??= (m[2] ?? '').replace(/^(["'])(.*)\1$/, '$2')
  }
}
