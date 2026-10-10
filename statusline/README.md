# claude-mods-statusline

A custom status line for [Claude Code](https://code.claude.com), with a one-command installer for Windows, macOS and Linux.

```
✻ Sonnet 5.5 | ██████████░░░░░░░░░░ 48% | main +1 ~2 ?1 ↑1 | “Simple is reliable.” — E. Dijkstra | 5:42 PM
```

- **Model:** the Claude starburst in brand orange (`#d97757`), then the model name.
- **Context bar:** a solid bar plus the percentage, colored by how full the context is: green below 45%, yellow from 45%, orange from 70%, red from 85%.
- **Git:** purple branch plus `+` staged (green), `~` modified (yellow), `?` untracked (red), `↑` ahead and `↓` behind (cyan), or `clean`. Hidden outside a repo. Cached for 5 seconds.
- **Quote:** a short random quote (70 characters including the author) on philosophy, science, software development or games, from [API Ninjas](https://api-ninjas.com/api/quotes). Optional: choose it in the installer, or say no and the line has no quote.
- **Time:** 12-hour clock, in blue.

## Install

Requires **Node.js 22 or newer** and Git.

```sh
npx claude-mods-statusline
```

The installer shows a live preview and asks whether you want random quotes. Quotes are optional:

- **Yes:** it asks for your API Ninjas key (free at [api-ninjas.com/register](https://api-ninjas.com/register)). A key is required for this choice.
- **No:** no key is asked for, none is kept, and the status line never calls the quotes API.

Then it:

1. copies the status line to `~/.claude/claude-mods-statusline/` (or `$CLAUDE_CONFIG_DIR/claude-mods-statusline/`),
2. saves your choice in `config.json` there, and your key in a private `.env` (mode `0600`) if you picked quotes,
3. backs up your `settings.json` to `settings.json.bak-claude-mods-<time>`, then sets `statusLine` in it. Everything else in the file is left alone.

Restart Claude Code afterwards. Run the installer again any time to turn quotes on or off, change the key, or update.

| Option | |
| --- | --- |
| `-y`, `--yes` | No prompts. Quotes are on only if the `API_NINJAS_KEY` environment variable is set |
| `--quotes` / `--no-quotes` | With `--yes`: force quotes on (needs a key) or off |
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
│   │   ├── config.ts         reads the installer's quotes on/off choice
│   │   └── env.ts            tiny .env loader
│   └── installer/      the Ink installer (npx claude-mods-statusline)
│       ├── cli.tsx           entry point and argument parsing
│       ├── app.tsx           the terminal UI
│       ├── install.ts        file copy, key, settings backup
│       └── settings.ts       pure settings.json edits
└── test/               node:test suites
```

## Publishing (maintainer)

Releases are automated with [semantic-release](https://semantic-release.org) in [`.github/workflows/publish.yml`](../.github/workflows/publish.yml). Just push to `main`:

1. The test matrix in [`ci.yml`](../.github/workflows/ci.yml) runs first: Windows, macOS and Linux on Node 22 and 24, with type check, unit tests, build, an install/run/uninstall smoke test and a package check. Pull requests run the same tests. If anything fails, nothing is released.
2. If it passes, semantic-release reads the commit messages since the last tag and works out the next version. With no releasable commit it does nothing.
3. Otherwise it publishes to npm, creates the git tag `vX.Y.Z` and a GitHub release with notes.

Commit messages decide the version ([Conventional Commits](https://www.conventionalcommits.org)). While the package is below 1.0.0 the rules in [`.releaserc.json`](.releaserc.json) are deliberately gentle, so a version is never skipped:

| Commit | Release |
| --- | --- |
| `fix:`, `feat:`, `perf:`, `revert:` | patch (0.1.1, 0.1.2, ...) |
| a `BREAKING CHANGE:` footer or `type!:` | minor (0.2.0) |
| `docs:`, `ci:`, `chore:`, `test:`, `refactor:`, `style:` | no release |

To move to 1.0.0 later, change the `feat` rule to `minor` and the `breaking` rule to `major` in `.releaserc.json`.

Publishing uses npm [Trusted Publishing](https://docs.npmjs.com/trusted-publishers): the package's trusted publisher on npmjs.com points at this repository and `publish.yml`, so no token is stored. The repo's `package.json` keeps its version as is; the real version lives in the git tag, the GitHub release and the published package. You can preview the next version with `npx semantic-release --dry-run --no-ci` on `main`.

## License

MIT
