import type { Register } from 'claude-code'

type Hunk = { oldStart: number; oldLines: number; newStart: number; newLines: number; lines: string[] }

const PREVIEW_LINES = 30 // a new file shows its head; the full text is one Read away

// The engine refuses any text holding a control character but tab and newline. CRLF files carry a
// `\r` on every line, so without this the whole tree is refused and the default diff is drawn.
const clean = (s: string): string => s.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')

const toDiff = (hunks: Hunk[]): string =>
  clean(
    hunks
      .map(h => `@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@\n${h.lines.join('\n')}`)
      .join('\n'),
  )

const count = (hunks: Hunk[], mark: '+' | '-'): number =>
  hunks.reduce((n, h) => n + h.lines.filter(l => l.startsWith(mark)).length, 0)

/** Last three path segments: enough to recognise the file, short enough for one row. */
const shortPath = (p: string): string => clean(p).replaceAll('\\', '/').split('/').slice(-3).join('/')

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

    const added = isNew ? r.content!.split('\n').length : count(hunks, '+')
    const removed = isNew ? 0 : count(hunks, '-')
    const head = isNew ? r.content!.split('\n').slice(0, PREVIEW_LINES) : []
    const hidden = isNew ? added - head.length : 0

    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text dimColor>
          {isNew ? 'Created ' : ''}
          {shortPath(r.filePath)}{'  '}
          <Text color="green">+{added}</Text>{' '}
          <Text color="red">-{removed}</Text>
        </Text>
        {isNew ? (
          <Code source={clean(head.join('\n'))} path={clean(r.filePath)} startLine={1} wrap="truncate-end" />
        ) : (
          <Code source={toDiff(hunks)} path={clean(r.filePath)} format="diff" wrap="truncate-end" />
        )}
        {hidden > 0 ? <Text dimColor>… {hidden} more lines</Text> : null}
      </Box>
    )
  }).catch(($, e, next) => next(e)) // a shape surprise falls back to the engine's own diff
}
