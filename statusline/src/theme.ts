// Colors for the status line, as 24-bit RGB (Claude Code renders ANSI truecolor).
export type Rgb = readonly [number, number, number]

const RESET = '\x1b[0m'

/** Foreground-colored text; the color is reset afterwards. */
export const fg = (color: Rgb, text: string, italic = false): string =>
  `\x1b[${italic ? '3;' : ''}38;2;${color.join(';')}m${text}${RESET}`

/** Escape that switches the background color (the caller resets it). */
export const bg = (color: Rgb): string => `\x1b[48;2;${color.join(';')}m`

export const RESET_ALL = RESET

export const PALETTE = {
  claude: [217, 119, 87], // Claude brand #d97757: logo and model
  branch: [189, 147, 249], // purple
  staged: [80, 250, 123], // green
  modified: [241, 250, 140], // yellow
  untracked: [255, 110, 110], // red
  sync: [139, 233, 253], // cyan: ahead/behind
  clean: [120, 200, 150], // calm green
  quote: [125, 207, 220], // soft teal
  author: [150, 160, 190], // muted blue-gray
  time: [122, 162, 247], // blue
  divider: [90, 94, 110], // dim slate
  barEmpty: [58, 58, 68], // free part of the context bar
} as const satisfies Record<string, Rgb>

const GREEN: Rgb = [63, 185, 120]
const YELLOW: Rgb = [240, 200, 70]
const ORANGE: Rgb = [240, 140, 50]
const RED: Rgb = [225, 85, 85]

/** Color of the context bar and percentage: green, then yellow from 45%, orange from 70%, red from 85%. */
export const levelColor = (percent: number): Rgb =>
  percent < 45 ? GREEN : percent < 70 ? YELLOW : percent < 85 ? ORANGE : RED
