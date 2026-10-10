import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Written next to the runtime folder by the installer, e.g. `{ "quotes": false }`. */
export const CONFIG_FILE = 'config.json'

/**
 * Whether quotes are switched on. Only an explicit `"quotes": false` turns them off, so a
 * missing or unreadable file (a repo checkout, an older install) keeps the default: on.
 */
export function quotesSetting(file: string): boolean {
  try {
    return (JSON.parse(readFileSync(file, 'utf8')) as { quotes?: unknown }).quotes !== false
  } catch {
    return true
  }
}

/** Installed layout: `<root>/runtime/config.js` next to `<root>/config.json`. */
export const quotesEnabled = (): boolean => quotesSetting(join(import.meta.dirname, '..', CONFIG_FILE))
