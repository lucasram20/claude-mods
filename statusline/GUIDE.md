# Statusline guide

How to use `claude-mods-statusline`, the themed status line for [Claude Code](https://code.claude.com) that also shows the song you are playing. One command installs it, and it has **no dependencies**.

```
✻ Sonnet 5.5 | ██████████░░░░░░░░░░ 48% | main +1 ~2 ?1 ↑1 | ♪ Pandora — Wisp ━━━━●─────── 1:12/4:21 | 5:42 PM
```

- **Model:** the Claude starburst in brand orange, then the model name.
- **Context bar:** a solid bar plus the percentage, green below 45%, yellow from 45%, orange from 70%, red from 85%.
- **Git:** purple branch, then `+` staged (green), `~` modified (yellow), `?` untracked (red), `↑` ahead and `↓` behind (cyan), or `clean`. Hidden outside a repo.
- **Now playing:** the title, artist, a seek bar (`━━━●───`) and the time, for whatever is playing: YouTube Music, Spotify, a browser tab, VLC... `❚❚` replaces `♪` while paused. It disappears when nothing is open. On a narrow terminal the seek bar shrinks and then goes, so the line never wraps.
- **Time:** a 12-hour clock, always last.

## Now playing

| System | Needs |
| --- | --- |
| Windows 10 and 11 | nothing: it reads the same media controls as the volume flyout |
| Linux | [`playerctl`](https://github.com/altdesktop/playerctl) 2.0 or newer, for any MPRIS player (Spotify, Firefox, VLC...) |
| macOS | not supported yet |

## Install

Requires **Node.js 22 or newer**. Git is optional (without it the branch is hidden).

```sh
npx claude-mods-statusline
```

The installer shows a preview and asks you to confirm. It then:

1. copies the status line to `~/.claude/claude-mods-statusline/` (or `$CLAUDE_CONFIG_DIR/claude-mods-statusline/`),
2. backs up your `settings.json`, then sets `statusLine` in it. Everything else in the file is left alone.

Restart Claude Code afterwards. Run the installer again any time to update. If you already use a different status line, the installer shows it and replaces it only after you confirm.

| Option | |
| --- | --- |
| `-y`, `--yes` | No prompts |
| `--uninstall` | Remove the status line and the files the installer added (only if it is the status line this tool installed) |
| `-h`, `--help` / `-v`, `--version` | |

## How it stays light

Claude Code runs the status line after every event, so each run is a short-lived plain Node process. Git results are cached for 5 seconds. The song is read once a second by a small background process that keeps a cache file current, so the line never waits on the player and follows it closely. That process starts by itself when the status line runs and stops about 30 seconds after the last run. The installer sets the status line to refresh every second, which is what keeps the clock and the song time moving.

Working on the code: [`DEVELOPMENT.md`](DEVELOPMENT.md). Back to the [repo overview](../README.md).
