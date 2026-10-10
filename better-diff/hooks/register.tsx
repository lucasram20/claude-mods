import type { Register } from 'claude-code'

type Hunk = { oldStart: number; oldLines: number; newStart: number; newLines: number; lines: string[] }
type Cell = { n: number; text: string; kind: 'add' | 'del' | 'ctx' }
type Row = 'gap' | { l?: Cell; r?: Cell }

const PREVIEW_LINES = 30 // a new file shows its head; the full text is one Read away
const SPLIT_MIN_COLUMNS = 160 // two panes need ~80 columns each; narrower terminals keep Claude Code's own diff
const MAX_ROWS = 80 // each row is a few elements, so a huge rewrite is cut with a note

// The engine refuses any text holding a control character but tab and newline. CRLF files carry a
// `\r` on every line, so without this the whole tree is refused and the default diff is drawn.
const clean = (s: string): string => s.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')

const count = (hunks: Hunk[], mark: '+' | '-'): number =>
  hunks.reduce((n, h) => n + h.lines.filter(l => l.startsWith(mark)).length, 0)

/** Last three path segments: enough to recognise the file, short enough for one row. */
const shortPath = (p: string): string => clean(p).replaceAll('\\', '/').split('/').slice(-3).join('/')

/** Pairs each run of removed lines with the added lines that replace it, so the panes line up. */
function toRows(hunks: Hunk[]): Row[] {
  const rows: Row[] = []
  for (const h of hunks) {
    if (rows.length) rows.push('gap')
    let o = h.oldStart
    let n = h.newStart
    let dels: Cell[] = []
    let adds: Cell[] = []
    const flush = () => {
      for (let i = 0; i < Math.max(dels.length, adds.length); i++) rows.push({ l: dels[i], r: adds[i] })
      dels = []
      adds = []
    }
    for (const raw of h.lines) {
      const line = clean(raw)
      const mark = line[0]
      const text = line.slice(1)
      if (mark === '-') dels.push({ n: o++, text, kind: 'del' })
      else if (mark === '+') adds.push({ n: n++, text, kind: 'add' })
      else if (mark === '\\') continue // "\ No newline at end of file"
      else {
        flush()
        rows.push({ l: { n: o++, text, kind: 'ctx' }, r: { n: n++, text, kind: 'ctx' } })
      }
    }
    flush()
  }
  return rows
}

export const register: Register = on => {
  on('ui.render', { component: 'ToolResult' }, ($, e, next) => {
    const { tool, output, isErrored } = e.props
    if (isErrored || (tool !== 'Edit' && tool !== 'Write')) return next(e)

    // Same record shape for both tools; Write also carries `type` and `content`.
    const r = output as {
      filePath: string
      structuredPatch: Hunk[]
      staged?: boolean
      type?: 'create' | 'update'
      content?: string
    }
    if (!r || r.staged) return next(e)

    const { Box, Text, Code } = $.ui.resolve(e)
    const isNew = tool === 'Write' && r.type === 'create' && typeof r.content === 'string'
    const hunks = r.structuredPatch ?? []
    if (!isNew && hunks.length === 0) return next(e) // nothing changed, let the engine say so

    // Not wide enough for two panes: leave it to Claude Code's own diff.
    const columns = e.viewport?.columns ?? SPLIT_MIN_COLUMNS // unmeasured: assume wide
    if (columns < SPLIT_MIN_COLUMNS) return next(e)

    const path = clean(r.filePath)
    const added = isNew ? r.content!.split('\n').length : count(hunks, '+')
    const removed = isNew ? 0 : count(hunks, '-')
    const head = isNew ? r.content!.split('\n').slice(0, PREVIEW_LINES) : []
    const hidden = isNew ? added - head.length : 0

    const header = (
      <Text dimColor>
        {isNew ? 'Created ' : ''}
        {shortPath(r.filePath)}{'  '}
        <Text color="green">+{added}</Text>{' '}
        <Text color="red">-{removed}</Text>
      </Text>
    )

    // A new file has no old side, so it stays one pane.
    if (isNew) {
      return (
        <Box flexDirection="column" paddingLeft={2}>
          {header}
          <Code source={clean(head.join('\n'))} path={path} startLine={1} wrap="truncate-end" />
          {hidden > 0 ? <Text dimColor>… {hidden} more lines</Text> : null}
        </Box>
      )
    }

    // Split view: old file on the left (removed lines red), new file on the right (added lines green).
    const rows = toRows(hunks)
    const shown = rows.slice(0, MAX_ROWS)
    const width = String(Math.max(...hunks.map(h => Math.max(h.oldStart + h.oldLines, h.newStart + h.newLines)))).length

    // The empty side of an added or removed block: a faint hatch, not a hole.
    const hatch = '╱'.repeat(Math.floor((columns - 3) / 2))

    const side = (c: Cell | undefined, key: string) => {
      if (!c) {
        return (
          <Box key={key} width="50%" flexShrink={1} overflow="hidden">
            <Text color="subtle" dimColor>
              {hatch}
            </Text>
          </Box>
        )
      }
      const bg = c?.kind === 'add' ? 'diffAddedDimmed' : c?.kind === 'del' ? 'diffRemovedDimmed' : undefined
      const tint = c?.kind === 'add' ? 'success' : c?.kind === 'del' ? 'error' : undefined
      return (
        <Box key={key} width="50%" flexShrink={1} overflow="hidden" backgroundColor={bg}>
          <Text color={tint} dimColor={!tint}>
            {c ? String(c.n).padStart(width) : ' '.repeat(width)}{' '}
            {c?.kind === 'add' ? '+' : c?.kind === 'del' ? '-' : ' '}{' '}
          </Text>
          <Box flexGrow={1} flexShrink={1}>
            {c ? <Code source={c.text === '' ? ' ' : c.text} path={path} wrap="truncate-end" /> : <Text> </Text>}
          </Box>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" paddingLeft={2}>
        {header}
        {shown.map((row, i) =>
          row === 'gap' ? (
            <Text key={`g${i}`} dimColor>
              {'⋯'}
            </Text>
          ) : (
            <Box key={`r${i}`} columnGap={1}>
              {side(row.l, 'l')}
              {side(row.r, 'r')}
            </Box>
          ),
        )}
        {rows.length > shown.length ? <Text dimColor>… {rows.length - shown.length} more rows</Text> : null}
        {hidden > 0 ? <Text dimColor>… {hidden} more lines</Text> : null}
      </Box>
    )
  }).catch(($, e, next) => next(e)) // a shape surprise falls back to the engine's own diff
}
