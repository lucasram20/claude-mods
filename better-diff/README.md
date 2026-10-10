# better-diff

A Claude Code mod that draws `Edit` and `Write` results like [opencode](https://opencode.ai) does: a quiet header (`path  +N -M`), then the engine's own diff block with a line-number gutter and add/remove coloring. A new file shows its first 30 lines.

It hooks `ui.render` on `ToolResult` only. Errors, staged edits and empty patches fall through to Claude Code's default row. Nothing is written to disk and the model never sees the change.

## Install

From a clone of the repo, for every session:

```sh
claude plugin marketplace add ./better-diff
claude plugin install better-diff@better-diff --scope user
```

The plugin is read from the folder itself, so keep the clone where it is. After editing it, run `/reload-plugins`.

To try it for one session only: `claude --plugin-dir ./better-diff`.

## Check

```sh
claude plugin validate ./better-diff
claude plugin test ./better-diff
```

Not done: opencode's side-by-side split view (the engine's `Code` element only does unified diffs).
