# claude-mods-statusline

A custom status line for [Claude Code](https://code.claude.com), with a one-command installer for Windows, macOS and Linux.

```
✻ Sonnet 5.5 | ██████████░░░░░░░░░░ 48% | main +1 ~2 ?1 ↑1 | “Simple is reliable.” — E. Dijkstra | 5:42 PM
```

- **Model:** the Claude starburst in brand orange (`#d97757`), then the model name.
- **Context bar:** a solid bar plus the percentage, colored by how full the context is: green below 45%, yellow from 45%, orange from 70%, red from 85%.
- **Git:** purple branch plus `+` staged (green), `~` modified (yellow), `?` untracked (red), `↑` ahead and `↓` behind (cyan), or `clean`. Hidden outside a repo. Cached for 5 seconds.
- **Quote:** a short random quote (70 characters including the author) on philosophy, science, software development or games, from [API Ninjas](https://api-ninjas.com/api/quotes). Optional; without a key the quote is simply left out.
- **Time:** 12-hour clock, in blue.

## Install

Requires **Node.js 22 or newer** and Git.

```sh
npx claude-mods-statusline
```

The installer shows a preview, asks for an optional API Ninjas key (free at [api-ninjas.com/register](https://api-ninjas.com/register)), then:

1. copies the status line to `~/.claude/claude-mods-statusline/` (or `$CLAUDE_CONFIG_DIR/claude-mods-statusline/`),
2. saves your key there in a private `.env` (mode `0600`),
3. backs up your `settings.json` to `settings.json.bak-claude-mods-<time>`, then sets `statusLine` in it. Everything else in the file is left alone.

Restart Claude Code afterwards. Run the installer again any time to add or change the key or to update.

| Option | |
| --- | --- |
| `-y`, `--yes` | No prompts; reads the key from the `API_NINJAS_KEY` environment variable if set |
| `--uninstall` | Remove the status line and the files the installer added (only if it is the status line this tool installed) |
| `-h`, `--help` / `-v`, `--version` | |

Once installed, the status line itself runs on plain Node with **no dependencies**, so Claude Code only starts one small process per update.

If you already have a different status line configured, the installer shows it and replaces it only after you confirm; the backup lets you go back.

## Tech stack

- **TypeScript**, compiled to ES modules with `tsc`
- **[Ink](https://github.com/vadimdemedes/ink)** (React for the terminal) for the installer UI
- The status line runtime uses only Node built-ins (`fs`, `child_process`, `fetch`)
- **`node:test`** for tests
- [**API Ninjas Quotes API**](https://api-ninjas.com/api/quotes) (free tier is non-commercial)

## How it stays light

Claude Code runs the status line after every event, so each run must be cheap.

- Nothing is kept in memory between runs: each run is a short-lived process.
- Git results are cached on disk for 5 seconds, so most runs don't start `git`.
- The quote is read from a cache file in the OS temp folder. When it is older than 10 minutes, a detached background process refreshes it, so the status line never waits on the network. A failed refresh keeps the old quote and retries after a minute.
- `refreshInterval: 30` re-runs it every 30 seconds so the clock stays current while idle.

The API's category list only includes `philosophy` of the four topics. Science, software and games quotes are matched by author instead, using the lists in `src/runtime/topics.ts`.

## Development

```sh
git clone https://github.com/lucasram20/claude-mods.git
cd claude-mods/statusline
npm install
npm run check      # type check + tests
npm run build      # compile to dist/
node dist/installer/cli.js     # try the installer (set CLAUDE_CONFIG_DIR to a temp folder first)
```

Run the status line straight from source (Node 24+ strips the types):

```sh
echo '{"model":{"display_name":"Opus 4.5"},"context_window":{"used_percentage":48}}' | node src/runtime/main.ts
```

For quotes while developing, copy `.env.example` to `.env` and set `API_NINJAS_KEY=`. `.env` is git-ignored, and a real `API_NINJAS_KEY` environment variable wins over the file.

### Layout

```
statusline/
├── src/
│   ├── runtime/        the status line itself (copied to the user's config folder)
│   │   ├── main.ts           entry point
│   │   ├── line.ts           assembles the line
│   │   ├── input.ts          reads the status JSON from stdin
│   │   ├── bar.ts            context bar
│   │   ├── git.ts            git branch and status, cached
│   │   ├── quote.ts          quote fetching and cache
│   │   ├── refresh-quote.ts  detached background refresh
│   │   ├── topics.ts         quote topics and authors
│   │   ├── theme.ts          color palette and helpers
│   │   └── env.ts            tiny .env loader
│   └── installer/      the Ink installer (npx claude-mods-statusline)
│       ├── cli.tsx           entry point and argument parsing
│       ├── app.tsx           the terminal UI
│       ├── install.ts        file copy, key, settings backup
│       └── settings.ts       pure settings.json edits
└── test/               node:test suites
```

## Publishing (maintainer)

```sh
npm login
cd statusline
npm version patch      # for later releases
npm publish            # runs type check, tests and build first; asks for your 2FA code
```

## License

MIT
