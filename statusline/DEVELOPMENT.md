# Developing the statusline

User docs are in [`GUIDE.md`](GUIDE.md). This one is for working on the code. Neither is published to npm; `README.md` (the npm page) only describes the package and links here.

## Tech stack

- **TypeScript**, compiled to ES modules with `tsc`
- **No runtime dependencies.** The installer prompts with `node:readline`, and the status line uses only Node built-ins (`fs`, `child_process`)
- **`node:test`** for tests
- **Windows PowerShell 5.1** (built into Windows) for the media controls, and `playerctl` on Linux, both spawned as child processes

Keep it dependency-free: a package with no dependencies has no supply chain to audit, which is what Socket's supply chain score measures. Add a dependency only if a few lines of Node can't do the job.

## How it stays light

- Nothing is kept in memory between runs: each run is a short-lived process.
- Git results are cached on disk for 5 seconds, so most runs don't start `git`.
- The playing track is read from a cache file in the OS temp folder. A detached watcher (`watch-music.ts`) rewrites it once a second, so the status line never waits on the player. The status line starts the watcher when the cache has gone quiet and touches a heartbeat file on every run; the watcher quits 30 seconds after the last heartbeat. Between writes the position is advanced from the time it was measured.
- `refreshInterval: 1` (the minimum) re-runs the status line every second so the clock and the song time keep moving while idle. Each run is one small Node start and a cache read.

### Now playing

- **Windows:** `src/runtime/player.ts` keeps one `powershell.exe -Command -` open and pipes a script into its stdin (no script file to ship, no execution policy to deal with). The script loops once a second and quits when the watcher is gone. PowerShell drops a block that spans several stdin lines, so the script keeps each block on one line. It uses the `GlobalSystemMediaTransportControlsSessionManager` WinRT API, picks the session that is playing (else the current one) and prints one JSON line.
- **Linux:** `playerctl -a metadata --format ...` once a second, one line per MPRIS player.
- Track text comes from web pages, so it goes through `clean()` before it can reach the terminal.

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
│   │   ├── player.ts         reads the player (PowerShell on Windows, playerctl on Linux)
│   │   ├── music.ts          cache, heartbeat and starting the watcher
│   │   ├── watch-music.ts    detached watcher that keeps the cache current
│   │   ├── music-line.ts     the now-playing segment and seek bar
│   │   └── theme.ts          color palette and helpers
│   └── installer/      the installer (npx claude-mods-statusline)
│       ├── cli.ts            entry point and argument parsing
│       ├── ui.ts             prompts and progress output
│       ├── install.ts        file copy, settings backup
│       └── settings.ts       pure settings.json edits
└── test/               node:test suites
```

## Publishing (maintainer)

Releases are automated with [semantic-release](https://semantic-release.org) in [`.github/workflows/publish.yml`](../.github/workflows/publish.yml). Just push to `main`:

1. The test matrix in [`ci-statusline.yml`](../.github/workflows/ci-statusline.yml) runs first: Windows, macOS and Linux on Node 22 and 24, with type check, unit tests, build, an install/run/uninstall smoke test and a package check. Pull requests run the same tests. If anything fails, nothing is released.
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
