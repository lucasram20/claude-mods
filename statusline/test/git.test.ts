import assert from 'node:assert/strict'
import { test } from 'node:test'
import { summarize } from '../src/git.ts'

test('counts staged, modified, untracked and ahead', () => {
  const out = '## main...origin/main [ahead 2]\n M a.ts\nA  b.ts\n?? c.ts\n'
  assert.equal(summarize(out), 'main +1 ~1 ?1 ↑2')
})

test('a file both staged and modified counts in both', () => {
  assert.equal(summarize('## dev\nAM a.ts\n'), 'dev +1 ~1')
})

test('clean branch', () => {
  assert.equal(summarize('## main...origin/main\n'), 'main clean')
})

test('fresh repo with no commits', () => {
  assert.equal(summarize('## No commits yet on main\n'), 'main clean')
})

test('not a repo gives an empty string', () => {
  assert.equal(summarize(''), '')
})
