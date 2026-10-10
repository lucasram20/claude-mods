# claude-mods-statusline

A themed status line for [Claude Code](https://code.claude.com). One command installs it on Windows, macOS and Linux, and it has **no dependencies**.

```
✻ Sonnet 5.5 | ██████████░░░░░░░░░░ 48% | main +1 ~2 ?1 ↑1 | “Simple is reliable.” — E. Dijkstra | 5:42 PM
```

- **Model:** the Claude starburst in brand orange, then the model name.
- **Context bar:** a solid bar plus the percentage, green below 45%, yellow from 45%, orange from 70%, red from 85%.
- **Git:** purple branch, then `+` staged (green), `~` modified (yellow), `?` untracked (red), `↑` ahead and `↓` behind (cyan), or `clean`. Hidden outside a repo.
- **Quote:** an optional short quote on philosophy, science, software or games, from [API Ninjas](https://api-ninjas.com/api/quotes). Say no in the installer and the line has no quote.
- **Time:** a 12-hour clock.

## Install

Requires **Node.js 22 or newer** and Git.

```sh
npx claude-mods-statusline
```

The installer shows a preview and asks whether you want quotes. Quotes need a free [API Ninjas key](https://api-ninjas.com/register); say no and no key is asked for or kept. It then:

1. copies the status line to `~/.claude/claude-mods-statusline/` (or `$CLAUDE_CONFIG_DIR/claude-mods-statusline/`),
2. saves your choice there, and your key in a private `.env` (mode `0600`) if you chose quotes,
3. backs up your `settings.json`, then sets `statusLine` in it. Everything else in the file is left alone.

Restart Claude Code afterwards. Run the installer again any time to turn quotes on or off, change the key, or update. If you already use a different status line, the installer shows it and replaces it only after you confirm.

| Option | |
| --- | --- |
| `-y`, `--yes` | No prompts. Quotes are on only if the `API_NINJAS_KEY` environment variable is set |
| `--quotes` / `--no-quotes` | With `--yes`: force quotes on (needs a key) or off |
| `--uninstall` | Remove the status line and the files the installer added (only if it is the status line this tool installed) |
| `-h`, `--help` / `-v`, `--version` | |

## How it stays light

Claude Code runs the status line after every event, so each run is a short-lived plain Node process. Git results are cached for 5 seconds, and the quote is read from a cache file that a detached background process refreshes, so the line never waits on the network.

## Source and license

Source, development notes and the release process: [github.com/lucasram20/claude-mods](https://github.com/lucasram20/claude-mods/tree/main/statusline). MIT licensed.
