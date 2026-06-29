# StoryMaker Quickstart

This quickstart is for authors using StoryMaker through Codex or Claude Code.

## Install Note

The current npm package is `@storyos/cli`, and it provides the preferred `storymaker` command plus the compatibility `storyctl` alias. `@storymaker/cli` is not published yet.

## 1. Create A Project

Create a separate story directory. Do not write your novel inside the StoryMaker source repository.

```bash
mkdir my-novel
cd my-novel
storymaker init --type superlong_webnovel --profile production
```

Then edit the project starter files:

```text
project.yaml
00-项目企划案.md
00-项目假设.md
```

## 2. Install One AI Adapter

For Codex:

```bash
storymaker adapter install codex --cli-only
```

For Claude Code:

```bash
storymaker adapter install claude-code --cli-only
```

Use one adapter first. Both adapters can exist later, but daily work is easiest when one agent owns the current session.

## 3. Daily Use

After the project brief is ready, the normal daily interaction should be natural language:

```text
User: Continue writing the next chapter.
AI: Chapter 0001 is complete. Here is the draft and quality report. Approve it?
```

Approve:

```text
User: Approved.
```

Reject:

```text
User: Reject it. The hook is weak and the pacing is too slow.
```

The AI agent should call StoryMaker commands in the background. The user should not need to manually run `status`, `context`, `produce`, `index`, `approve`, and `resume` for normal work.

## 4. Useful Manual Commands

Advanced users can still inspect the project directly:

```bash
storymaker status
storymaker resume
storymaker search "protagonist"
storymaker export --format md
```

`storyctl` remains available as a compatibility alias for every command.

## 5. Local Dashboard From Source

If you are running StoryMaker from this monorepo instead of an installed package, build the Dashboard runtime once before starting the local Dashboard:

```bash
corepack pnpm build:dashboard
```

Then run it against a StoryMaker project:

```powershell
$env:STORYOS_CWD = (Resolve-Path "examples/superlong-webnovel").Path
corepack pnpm storymaker dashboard --once --port 0
Remove-Item Env:STORYOS_CWD
```

The Dashboard uses built workspace `dist` files. Re-run `corepack pnpm build:dashboard` after changing Dashboard, CLI, or package source files.
