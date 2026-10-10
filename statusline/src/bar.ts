const BASE = 246 // filled
const EMPTY = 238 // free space
const GLINT = [250, 255, 250] // soft edge, bright core, soft edge (256-color grays)
const SPEED = 3 // cells per second
const PAUSE = 10 // idle cells after the glint leaves, so the shine is periodic

/**
 * Solid context bar drawn with background colors, with a glint that sweeps across
 * the filled part. The frame is a pure function of `now`, so the status line needs
 * no state between runs: Claude Code just re-runs it every `refreshInterval`.
 */
export function renderBar(percent: number, now: number, width = 20): string {
  const clamped = Math.min(100, Math.max(0, percent))
  const filled = Math.round((clamped / 100) * width)
  const cycle = filled + GLINT.length + PAUSE
  const head = (Math.floor((now / 1000) * SPEED) % cycle) - GLINT.length // glint's leading edge

  let out = ''
  for (let i = 0; i < width; i++) {
    const g = head - i // 0..GLINT.length-1 when this cell is under the glint
    const color = i >= filled ? EMPTY : g >= 0 && g < GLINT.length ? GLINT[g] : BASE
    out += `\x1b[48;5;${color}m `
  }
  return `${out}\x1b[0m`
}
