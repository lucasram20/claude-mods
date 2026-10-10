# claude-mods

Personal mods for [Claude Code](https://code.claude.com). Each mod lives in its own folder and is self-contained.

| Mod | What it does |
| --- | --- |
| [`statusline/`](statusline) | A custom status line: Claude logo and model, a shimmering context bar, git branch and status, a 12-hour clock, and a random quote on a second line |

## statusline

```
✻ Sonnet 5.5 | ██████████░░░░░░░░░░ 48% | main +1 ~2 ?1 ↑1 | “Simple is reliable.” — E. Dijkstra | 5:42 PM
```

- **Model:** the Claude starburst in brand orange (`#d97757`), then the model name.
- **Context bar:** a solid bar with a glint that sweeps across the filled part, plus the percentage. Green below 50%, amber from 50%, red from 80%. Claude Code re-runs the script every second, and the animation frame is derived from the clock.
- **Git:** purple branch plus `+` staged (green), `~` modified (yellow), `?` untracked (red), `↑` ahead and `↓` behind (cyan), or `clean`. Hidden outside a repo. Cached for 5 seconds.
- **Time:** 12-hour clock, in blue.
- **Colors:** all in [`src/theme.ts`](statusline/src/theme.ts) as 24-bit RGB, so the palette is easy to retune.
- **Quote:** a short random quote (70 characters including the author) on philosophy, science, software development or games, from [API Ninjas](https://api-ninjas.com/api/quotes), shown just before the clock. Optional, and it changes every 10 minutes. Longer quotes are skipped.

### Tech stack

- **TypeScript** run directly by **Node.js 24+** (built-in type stripping, so no build step)
- **Zero runtime dependencies:** only Node built-ins (`fs`, `child_process`, `http`, `fetch`)
- **`tsc`** for type checking only; **`node:test`** for tests
- [**API Ninjas Quotes API**](https://api-ninjas.com/api/quotes) for the quotes (free tier is non-commercial)

### Setup

Requires Node.js 24 or newer and Git.

```sh
git clone https://github.com/lucasram20/claude-mods.git
cd claude-mods/statusline
npm install        # dev tooling only (typescript, @types/node)
```

Point Claude Code at it in `~/.claude/settings.json`, using the absolute path to your clone:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node C:/path/to/claude-mods/statusline/src/main.ts",
    "refreshInterval": 1
  }
}
```

`refreshInterval: 1` makes Claude Code re-run the script every second, which drives the shine and the clock. Remove it to update only on session events (the shine will stop moving).

### Quotes (optional)

1. Get a free key at [api-ninjas.com/register](https://api-ninjas.com/register).
2. `cp .env.example .env` (Windows: `copy .env.example .env`) and set `API_NINJAS_KEY=`. `.env` is git-ignored. A real `API_NINJAS_KEY` environment variable also works and wins over the file.

Without a key the quote line is simply left out.

The API's category list only includes `philosophy` of the four topics. Science, software and games quotes are matched by author instead, using the lists in [`src/topics.ts`](statusline/src/topics.ts). Edit those names to change what you see.

### How it stays light

The status line runs every second, so each run must be cheap.

- No state is kept in memory: the shine is a pure function of the clock, and each run is a short-lived process.
- Git results are cached on disk for 5 seconds, so most runs don't start `git`.
- The quote is read from a cache file. When it is older than 10 minutes, a detached background process refreshes it, so the status line never waits on the network. A failed refresh keeps the old quote and retries after a minute.

### Development

```sh
cd statusline
npm run check      # type check + tests
npm start          # run once (reads status JSON from stdin)
```

Try it with sample input:

```sh
echo '{"model":{"display_name":"Opus 4.5"},"context_window":{"used_percentage":48}}' | node src/main.ts
```

### Project layout

```
claude-mods/
├── README.md
├── .gitignore
└── statusline/
    ├── package.json
    ├── tsconfig.json
    ├── .env.example
    ├── src/
    │   ├── main.ts            entry point, assembles the lines
    │   ├── input.ts           reads the status JSON from stdin
    │   ├── bar.ts             context bar and shine animation
    │   ├── git.ts             git branch and status, cached
    │   ├── quote.ts           quote fetching and cache
    │   ├── refresh-quote.ts   detached background refresh entry
    │   ├── topics.ts          quote topics and authors
    │   ├── theme.ts           color palette and helpers
    │   └── env.ts             tiny .env loader
    └── test/                  node:test suites
```
