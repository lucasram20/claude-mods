# claude-mods

Personal mods for Claude Code. Each mod lives in its own folder and is self-contained.

| Folder | What it is | Ships as |
| --- | --- | --- |
| `statusline/` | Status line (TypeScript, Ink installer) | npm package `claude-mods-statusline`, released automatically |
| `better-diff/` | Claude Code plugin (a `ui.render` hooks module) | Not published; installed from a clone |

A change belongs to one mod. Don't let `statusline/` and `better-diff/` import from each other.

## Commits and releases (read this first)

Every push to `main` that touches `statusline/` runs semantic-release, which reads **every commit since the last tag**, including ones about other mods. Only `feat`, `fix`, `perf`, `revert` and breaking changes release (see `statusline/.releaserc.json`).

- Use [Conventional Commits](https://www.conventionalcommits.org): `type(scope): subject`.
- **`better-diff` commits must never be `feat`, `fix` or `perf`.** Use `chore(better-diff):` or `docs(better-diff):`, otherwise the next statusline release picks them up as a statusline patch.
- Statusline changes that should ship use `feat(statusline):` or `fix(statusline):`. Anything that shouldn't release uses `docs`, `ci`, `chore`, `test`, `refactor` or `style`.
- Never put `!` or a `BREAKING CHANGE:` footer in a commit unless a minor statusline release is intended.
- Don't edit `version` in `statusline/package.json`; the version lives in the git tag.
- Only commit or push when asked. Push straight to `main`; there is no branch protection.
- End commit messages with the `Co-Authored-By:` line the session gives you.

## CI and workflows

- `.github/workflows/ci-statusline.yml`: statusline tests (3 OS x Node 22 and 24). Called by `publish.yml`.
- `.github/workflows/publish.yml`: the release. **Keep this file name and its `release` job**; npm trusted publishing is tied to the name. Keep the `test` job id so check names stay `Release / test / ...`.
- `.github/workflows/ci-better-diff.yml`: validates and tests the plugin with Claude Code itself.
- Each workflow only runs for its own folder (`paths:` filters). A new mod gets its own `ci-<mod>.yml`; don't fold it into another mod's workflow.
- After a push that changes workflows, check the runs with `gh run list` and confirm no new tag appeared.

## Code rules

- Smallest change that works. Reuse what's in the folder, then the standard library, then an installed dependency. Don't add a dependency for a few lines, and don't add abstractions, options or files for later.
- TypeScript, strict. No semicolons, single quotes, 2-space indent, `const` over `let`, small functions, named exports.
- Comments say **why**, not what. Mark a deliberate shortcut with a `ponytail:` comment naming its limit and the upgrade path.
- Non-trivial logic leaves one runnable check behind. Don't add test frameworks.
- Never commit secrets: `.env` is ignored, only `.env.example` is tracked.
- User-facing text is plain and short. Update the mod's README and the root README table when behavior or install steps change.

### statusline/

- Node 22+, `node:test`, ES modules compiled with `tsc`; imports use the `.ts` extension.
- `src/runtime/` is copied to the user's machine and runs on every status update: **Node built-ins only, no dependencies**, no work that waits on the network. Cache on disk, refresh in the background.
- `src/installer/` is the only place that uses Ink. Anything that edits `settings.json` must back it up first, leave other keys alone, and only remove what it installed (identified by `MARKER`).
- Check with `npm run check`, then `npm run build`, from `statusline/`.

### better-diff/

- A hooks module: `hooks/register.tsx` is built from `$.ui.resolve(e)` elements, with no DOM and no Node. Its API types come from Claude Code's `plugin-authoring` skill; read those instead of guessing.
- It must never break the default diff. Return `next(e)` for anything it doesn't draw (errors, staged edits, empty patches, terminals under `SPLIT_MIN_COLUMNS`), and keep the `.catch` that falls back to it.
- Text the engine draws can't hold control characters other than tab and newline, or the whole tree is refused. Run file content and paths through `clean()` (CRLF files carry `\r`).
- Check with `claude plugin validate ./better-diff` and `claude plugin test ./better-diff`. Tests exercise the tree, not the paint, so look at a real Edit after any layout change, then run `/reload-plugins`.
- When writing test or source files that contain backslashes or control characters, use the Write/Edit tools, not shell heredocs; the shell eats them.
