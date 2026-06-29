# StoryMaker Publishing Strategy

## Current Package

The current npm package remains:

```text
@storyos/cli
```

This package exposes both command names:

```text
storymaker
storyctl
```

`storymaker` is the preferred user-facing command. `storyctl` remains a compatibility alias for existing scripts, adapters, and older documentation.

## Current Limitation

`@storymaker/cli` is not published yet. Users should not run:

```bash
npm install -g @storymaker/cli
```

Until a future task creates and verifies that package, install or pack `@storyos/cli` and use the `storymaker` binary from that package.

## Migration Path

1. Keep `@storyos/cli` as the package name for the current milestone.
2. Prefer `storymaker` in all new user-facing docs and agent flows.
3. Keep `storyctl` as a compatibility alias.
4. Do not remove `storyctl` until a major migration plan exists.
5. Evaluate `@storymaker/cli` later as either:
   - a new alias package that depends on or re-exports `@storyos/cli`; or
   - a package rename with explicit migration notes.

## Verification Policy

Because this task does not add `@storymaker/cli`, no `@storymaker/cli` pack dry run is required.

Before publishing `@storyos/cli`, run:

```bash
corepack pnpm --filter @storyos/cli build
cd packages/cli
npm pack --dry-run
```

If a future task adds `@storymaker/cli`, that task must include its own `npm pack --dry-run` result and document how the `storymaker` and `storyctl` bins are exposed.
