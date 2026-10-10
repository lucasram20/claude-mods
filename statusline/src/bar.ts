import { bg, heat, PALETTE, RESET_ALL, type Rgb } from './theme.ts'

const SPEED = 3 // cells per second
const PAUSE = 10 // idle cells after the glint leaves, so the shine is periodic
const GLINT_WIDTH = 3 // soft edge, bright core, soft edge

/**
 * Solid context bar drawn with background colors, tinted by how full the context is,
 * with a glint that sweeps across the filled part. The frame is a pure function of
 * `now`, so the status line needs no state between runs: Claude Code just re-runs it
 * every `refreshInterval`.
 */
export function renderBar(percent: number, now: number, width = 20): string {
  const clamped = Math.min(100, Math.max(0, percent))
  const filled = Math.round((clamped / 100) * width)
  const { base, edge, core } = heat(clamped)
  const glint: Rgb[] = [edge, core, edge]
  const cycle = filled + GLINT_WIDTH + PAUSE
  const head = (Math.floor((now / 1000) * SPEED) % cycle) - GLINT_WIDTH // glint's leading edge

  let out = ''
  for (let i = 0; i < width; i++) {
    const g = head - i // 0..GLINT_WIDTH-1 when this cell is under the glint
    const color = i >= filled ? PALETTE.barEmpty : g >= 0 && g < GLINT_WIDTH ? (glint[g] ?? base) : base
    out += `${bg(color)} `
  }
  return out + RESET_ALL
}
