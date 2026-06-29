# StoryMaker Branding

## Product Name

StoryMaker is the user-facing product name for this project.

StoryMaker describes the daily author experience: a creator asks to continue a story, the AI agent advances the workflow, and the user reviews each finished unit.

## Runtime Name

StoryOS remains a historical and internal runtime name during the transition. Existing package names, generated files, and relay history may still use StoryOS until each migration task explicitly changes them.

## CLI Names

The target user-facing CLI entry is:

```text
storymaker
```

The existing CLI entry remains supported as a compatibility alias:

```text
storyctl
```

Documentation for new users should prefer `storymaker`. Low-level engineering notes may mention `storyctl` when describing compatibility or current implementation details.

## npm Package Name

The current npm package remains:

```text
@storyos/cli
```

That package exposes both `storymaker` and `storyctl`. The package name `@storymaker/cli` is not published yet. See [Publishing strategy](publishing.md) for the package-name migration policy.

## Runtime Directory

Existing projects currently store local runtime state under:

```text
.storyos/
```

This directory must remain readable and writable during the transition. StoryMaker must not force-migrate user projects to `.storymaker/` until a dedicated migration command and rollback strategy exist.

The recommended transition rule is:

```text
Prefer .storyos/ for existing projects.
Allow .storymaker/ only when a later compatibility task explicitly implements it.
Never silently move user runtime data.
```

`storymaker doctor` reports the runtime directory strategy explicitly:

- `.storyos active` means the current project is using the compatibility runtime directory.
- `.storyos active; .storymaker also exists` means `.storymaker/` was detected, but the CLI still uses `.storyos/` and does not move data.
- `.storymaker detected, but .storyos remains the active compatibility runtime` means a `.storymaker/` directory exists without the required `.storyos/` runtime files. This is reported for visibility only; StoryMaker does not create, rename, copy, or delete runtime data automatically.

Until a dedicated migration command exists, users do not need to rename `.storyos/` to `.storymaker/`.

## User Experience Principle

Users should not need to remember the command chain behind daily production. The intended daily interaction is:

```text
User: continue writing the next chapter
StoryMaker: the chapter is complete; here is the draft and quality report. Approve it?
```

The CLI remains the deterministic substrate used by Codex, Claude Code, Dashboard, tests, and advanced users.
