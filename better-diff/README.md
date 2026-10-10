# better-diff

A Claude Code plugin that draws `Edit` and `Write` results like [opencode](https://opencode.ai) does: a quiet header (`path  +N -M`), then a side-by-side diff. The old file is on the left with removed lines in red, the new file on the right with added lines in green, each with its own line numbers and syntax highlighting. When one side has nothing (a pure addition or removal) it is filled with a faint hatch instead of a blank hole. A new file shows its first 30 lines in one pane.

The split view needs a wide terminal (160 columns or more). On anything narrower, and for errors, staged edits and empty patches, Claude Code's own diff is drawn. Nothing is written to disk and the model never sees the change.

It hooks `ui.render` on `ToolResult` only.

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

The width cut-over is `SPLIT_MIN_COLUMNS` in `hooks/register.tsx`.
