# claude-mods

Personal mods for [Claude Code](https://code.claude.com). Each mod lives in its own folder and is self-contained.

| Mod | What it does | Install |
| --- | --- | --- |
| [`statusline/`](statusline) | A themed status line: model, color-coded context bar, git status, a clock and the song you are playing | `npx claude-mods-statusline` |
| [`better-diff/`](better-diff) | Shows file changes as a clean side-by-side diff, like opencode | [From a clone](#better-diff) |

## statusline

```
✻ Sonnet 5.5 | ██████████░░░░░░░░░░ 48% | main +1 ~2 ?1 ↑1 | ♪ Pandora — Wisp ━━━━●─────── 1:12/4:21 | 5:42 PM
```

Shows the model, a context bar that turns yellow, orange and red as it fills, git branch and changes, and the song that is playing (YouTube Music, Spotify and more), ending with a 12-hour clock. Works on Windows, macOS and Linux; the song needs Windows or Linux.

```sh
npx claude-mods-statusline              # install (Node.js 22+ and Git)
npx claude-mods-statusline --uninstall  # remove it again
```

Features, options and development notes: [`statusline/GUIDE.md`](statusline/GUIDE.md).

## better-diff

A Claude Code plugin that redraws file changes the way [opencode](https://opencode.ai) does: the old file on the left with removed lines in red, the new file on the right with added lines in green, each with line numbers and syntax highlighting.

- Needs a wide terminal (160 columns or more). On narrower ones Claude Code's own diff is shown.
- A new file shows its first 30 lines in one pane.

Install from a clone of this repo:

```sh
claude plugin marketplace add ./better-diff
claude plugin install better-diff@better-diff --scope user
```

Details and development notes: [`better-diff/README.md`](better-diff/README.md).

## Contributing

Commit rules, CI layout and code style are in [`CLAUDE.md`](CLAUDE.md).

## License

[MIT](LICENSE) © 2026 lucasram20
