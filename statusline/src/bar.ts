import { bg, levelColor, PALETTE, RESET_ALL } from './theme.ts'

/** Solid context bar drawn with background colors, tinted by how full the context is. */
export function renderBar(percent: number, width = 20): string {
  const clamped = Math.min(100, Math.max(0, percent))
  const filled = Math.round((clamped / 100) * width)
  return (
    bg(levelColor(clamped)) +
    ' '.repeat(filled) +
    bg(PALETTE.barEmpty) +
    ' '.repeat(width - filled) +
    RESET_ALL
  )
}
