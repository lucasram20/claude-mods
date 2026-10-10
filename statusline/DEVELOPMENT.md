# Developing the statusline

User docs are in [`README.md`](README.md) (that file is what npm shows). This one is for working on the code. It is not published to npm.

## Tech stack

- **TypeScript**, compiled to ES modules with `tsc`
- **No runtime dependencies.** The installer prompts with `node:readline`, and the status line uses only Node built-ins (`fs`, `child_process`, `fetch`)
- **`node:test`** for tests
- [**API Ninjas Quotes API**](https://api-ninjas.com/api/quotes) (free tier is non-commercial)

Keep it dependency-free: a package with no dependencies has no supply chain to audit, which is what Socket's supply chain score measures. Add a dependency only if a few lines of Node can't do the job.

## How it stays light

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
│   └── installer/      the installer (npx claude-mods-statusline)
│       ├── cli.ts            entry point and argument parsing
│       ├── ui.ts             prompts and progress output
│       ├── install.ts        file copy, key, settings backup
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
