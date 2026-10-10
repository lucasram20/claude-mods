import assert from 'node:assert/strict'
import { test } from 'node:test'
import { paintGit, summarize } from '../src/runtime/git.ts'

const plain = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '')

test('paintGit keeps the text and colors each part', () => {
  const painted = paintGit('feature/x y +1 ~2 ?3 ↑1')
  assert.equal(plain(painted), 'feature/x y +1 ~2 ?3 ↑1')
  assert.equal(painted.match(/\x1b\[38;[25];[\d;]+m/g)?.length, 5) // branch + four flags
  assert.equal(plain(paintGit('main clean')), 'main clean')
})

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
