# Changelog

All notable StoryMaker CLI package changes should be recorded here.

StoryMaker currently uses `packages/cli/package.json` as the npm package version source of truth. Update this file in the same change as any version bump.

## Unreleased

- Adopted `StoryMaker` as the user-facing product name.
- Documented `storymaker` as the target CLI entry while retaining `storyctl` as the compatibility command.
- Documented that existing projects keep using `.storyos/` runtime state until a dedicated migration command exists.
- Documented the current npm publishing strategy: keep `@storyos/cli`, expose `storymaker` and `storyctl`, and defer `@storymaker/cli` until a verified alias or rename task.

## 0.0.0

- Initial unpublished package preparation for `@storyos/cli`.
- Includes the `storyctl` CLI, local project initialization, workflow commands, adapters, indexing, import/export, MCP enablement, and Dashboard/test scaffolding needed by the current relay milestone.
