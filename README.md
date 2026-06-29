# StoryMaker

StoryMaker is a CLI-first, local-first narrative engineering runtime for complex story production. It is designed to let Codex or Claude Code work independently through a stable local workflow while Markdown remains the source of truth and SQLite acts as the searchable index layer.

This repository is the platform monorepo. StoryOS remains the historical internal runtime name while the user-facing product transitions to StoryMaker.

## Daily Experience

The intended daily experience is natural language through an AI agent:

```text
User: Continue writing the next chapter.
StoryMaker Agent: Chapter 0001 is complete. Here is the draft and quality report. Approve it?
```

The agent should call StoryMaker commands in the background. Users should normally review the result, approve it, or reject it with a reason.

For real production, the agent should request a work packet, write the draft, and submit it back to StoryMaker:

```bash
storymaker produce packet --unit next --json
storymaker draft submit --unit chapter-0001 --from path/to/draft.md --title "Chapter Title"
```

`storymaker produce next --placeholder` is a deterministic development and test fallback. It is useful for CLI workflow fixtures, but it is not the default daily authoring path.

Start here:

- [Quickstart](docs/quickstart.md)
- [Daily usage](docs/daily-usage.md)
- [Product-grade example](examples/superlong-webnovel/README.md)
- [Branding and compatibility](docs/branding.md)
- [Publishing strategy](docs/publishing.md)

Try the product example:

```powershell
$env:STORYOS_CWD = (Resolve-Path "examples/superlong-webnovel").Path
corepack pnpm storymaker status
corepack pnpm storymaker resume
Remove-Item Env:STORYOS_CWD
```

## Naming

- `StoryMaker` is the product name shown to authors.
- `storymaker` is the target user-facing CLI entry.
- `storyctl` remains the compatibility CLI entry during the transition.
- Existing projects continue to use `.storyos/` for local runtime state until an explicit migration command exists.

See [docs/branding.md](docs/branding.md) for the transition rules.

## Workspace

```text
apps/
packages/
templates/
docs/
```

## Commands

Install dependencies:

```bash
pnpm install
```

Run TypeScript checks across the workspace:

```bash
pnpm -r typecheck
```

Run tests across the workspace:

```bash
pnpm test
```

Run the CLI from source:

```bash
pnpm storymaker --help
pnpm storyctl --help
```

Build and run the local Dashboard from source:

```bash
corepack pnpm build:dashboard
```

Then point `STORYOS_CWD` at a StoryMaker project and start the Dashboard:

```powershell
$env:STORYOS_CWD = (Resolve-Path "examples/superlong-webnovel").Path
corepack pnpm storymaker dashboard --once --port 0
Remove-Item Env:STORYOS_CWD
```

The Dashboard runs from built workspace `dist` files. If those files are missing, rebuild with `corepack pnpm build:dashboard` before starting it.

## npm Package

The current npm package name is `@storyos/cli`. It exposes both executable names:

- `storymaker`: preferred user-facing command.
- `storyctl`: compatibility alias for existing scripts and docs.

`@storymaker/cli` is not published yet. Do not use `npm install -g @storymaker/cli` until a future package-alias task adds and verifies that package. For now, install or pack `@storyos/cli` and run `storymaker`.

Migration path:

1. Keep publishing `@storyos/cli` while StoryMaker APIs stabilize.
2. Prefer `storymaker` in new docs, adapters, and daily agent flows.
3. Keep `storyctl` working as a compatibility alias.
4. Evaluate `@storymaker/cli` later as either a package rename or alias package with its own `npm pack --dry-run`.

Before publishing, verify the package locally:

```bash
corepack pnpm --filter @storyos/cli build
cd packages/cli
npm pack --dry-run
npx --yes ./storyos-cli-0.0.0.tgz --help
```

Versioning convention:

- Keep `packages/cli/package.json` as the package version source of truth.
- Update `CHANGELOG.md` in the same change as any version bump.
- Use `0.x.y` while StoryMaker APIs are still stabilizing.

See [docs/publishing.md](docs/publishing.md) for the detailed compatibility policy.

## Platform Launchers

Generate Node-dependent platform launchers with:

```bash
corepack pnpm package:binaries
```

The script name is historical: it does not build native single-file binaries.

This writes compatibility launchers:

```text
bin/platform/storyctl.exe
bin/platform/storyctl-macos
bin/platform/storyctl-linux
```

These artifacts keep the `storyctl` filename for existing automation. They are not native single-file binaries and they do not contain Node.js or the CLI source. Each launcher requires Node.js 24 or newer on `PATH` and executes the built CLI in `packages/cli/dist/index.js`.

## Export Formats

Stable exports:

- `storymaker export --format md`
- `storymaker export --format txt`

Current placeholder exports:

- `storymaker export --format docx`
- `storymaker export --format epub`

`docx` and `epub` currently write deterministic placeholder text artifacts with the requested extension. They are useful for preserving chapter order in tests and handoffs, but they are not complete Word or EPUB packages yet. Use `md` or `txt` for stable exports until a future task implements real document packaging.

## Development Notes

- `storyctl` is the stable compatibility CLI entry point.
- `storymaker` is the target user-facing CLI entry for the next phase.
- Base project templates, `project.yaml` schema, adapters, workflow state, and indexes are developed through relay tasks.
- The `.dev/` directory tracks relay development state for Planner, Worker, Reviewer, and Integrator handoffs.
