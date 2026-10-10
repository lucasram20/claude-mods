import { expect, test } from 'claude-code/testing'

const edit = {
  tool_use_id: 't1',
  isErrored: false,
  tool: 'Edit',
  output: {
    filePath: 'C:\\proj\\src\\a.ts',
    structuredPatch: [{ oldStart: 1, oldLines: 2, newStart: 1, newLines: 2, lines: [' keep', '-old', '+new'] }],
  },
}

// Stands in for the engine's own row, which sits beneath the plugin.
const engine = ($: any, e: any) => {
  const { Text } = $.ui.resolve(e)
  return <Text>engine</Text>
}

const mount = ($: any, props: typeof edit) =>
  $.ui.mount({ plugin: 'better-diff', surface: 'terminal', component: 'ToolResult', props })

test('Edit result draws a diff with a path and summary', async ($, on) => {
  on('ui.render', engine)
  const ui = await mount($, edit)
  expect(await ui.find({ type: 'Code' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /src\/a\.ts/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeUndefined()
})

test('CRLF lines still draw the diff instead of being refused', async ($, on) => {
  on('ui.render', engine)
  const lines = [' keep\r', '-old\r', '+new\r']
  const ui = await mount($, { ...edit, output: { ...edit.output, structuredPatch: [{ ...edit.output.structuredPatch[0]!, lines }] } })
  expect(await ui.find({ type: 'Code' })).toBeDefined()
})

test('an empty patch is left to the engine', async ($, on) => {
  on('ui.render', engine)
  const ui = await mount($, { ...edit, output: { ...edit.output, structuredPatch: [] } })
  expect(await ui.find({ type: 'Code' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
})
