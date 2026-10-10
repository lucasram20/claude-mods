// Colors for the status line. 24-bit RGB almost everywhere; macOS Terminal.app only does
// 256 colors, so it gets the nearest palette entry instead of garbled output.
export type Rgb = readonly [number, number, number]

const RESET = '\x1b[0m'

/** Nearest xterm-256 color-cube entry. */
const to256 = ([r, g, b]: Rgb): number => {
  const q = (v: number) => Math.round((v / 255) * 5)
  return 16 + 36 * q(r) + 6 * q(g) + q(b)
}

/** SGR parameters selecting `color` as foreground (38) or background (48). */
const select = (layer: 38 | 48, color: Rgb): string =>
  process.env.TERM_PROGRAM === 'Apple_Terminal' ? `${layer};5;${to256(color)}` : `${layer};2;${color.join(';')}`

/** Foreground-colored text; the color is reset afterwards. */
export const fg = (color: Rgb, text: string, italic = false): string =>
  `\x1b[${italic ? '3;' : ''}${select(38, color)}m${text}${RESET}`

/** Escape that switches the background color (the caller resets it). */
export const bg = (color: Rgb): string => `\x1b[${select(48, color)}m`

export const RESET_ALL = RESET

export const PALETTE = {
  claude: [217, 119, 87], // Claude brand #d97757: logo and model
  branch: [189, 147, 249], // purple
  staged: [80, 250, 123], // green
  modified: [241, 250, 140], // yellow
  untracked: [255, 110, 110], // red
  sync: [139, 233, 253], // cyan: ahead/behind
  clean: [120, 200, 150], // calm green
  music: [125, 207, 220], // soft teal: title, buttons, played part of the wave
  musicDim: [70, 78, 98], // unplayed part of the wave, paused marker
  artist: [150, 160, 190], // muted blue-gray
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
