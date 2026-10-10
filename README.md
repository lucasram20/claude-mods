# claude-mods

Personal mods for [Claude Code](https://code.claude.com). Each mod lives in its own folder and is self-contained.

| Mod | What it does |
| --- | --- |
| [`statusline/`](statusline) | A custom status line: Claude logo and model, a color-coded context bar, git branch and status, a random quote and a 12-hour clock. Installs with one command on Windows, macOS and Linux |
| [`better-diff/`](better-diff) | Draws `Edit` and `Write` results as a clean opencode-style diff (path, `+N -M`, line-number gutter) |

## statusline

```
✻ Sonnet 5.5 | ██████████░░░░░░░░░░ 48% | main +1 ~2 ?1 ↑1 | “Simple is reliable.” — E. Dijkstra | 5:42 PM
```

Install (Node.js 22+ and Git):

```sh
npx claude-mods-statusline
```

Remove it again with `npx claude-mods-statusline --uninstall`.

Full docs, options and development notes are in [`statusline/README.md`](statusline/README.md).

## better-diff

A Claude Code plugin that redraws `Edit` and `Write` results as a clean, opencode-style diff: a `path +N -M` header, a line-number gutter and soft add/remove colors.

Install from a clone of this repo:

```sh
claude plugin marketplace add ./better-diff
claude plugin install better-diff@better-diff --scope user
```

Details and development notes are in [`better-diff/README.md`](better-diff/README.md).
