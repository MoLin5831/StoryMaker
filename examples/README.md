# StoryMaker Examples

These examples are fixture projects for testing and demonstration. The `superlong-webnovel` project is the product-grade demo for the daily StoryMaker loop.

## Projects

```text
superlong-webnovel/
short-story/
screenplay/
```

Use them to inspect StoryMaker project structure, workflow state, staged chapters, quality reports, pending knowledge updates, and search/index behavior.

## Product Demo

`superlong-webnovel/` contains the demo story `镜城雨线`.

```text
User: Continue writing the next chapter.
StoryMaker Agent: Chapter 0001 is complete. Here is the draft and quality report. Approve it?
```

The example is intentionally paused at `awaiting_user_review` with:

- planning and assumptions;
- one real staged chapter fixture;
- one quality report;
- one pending knowledge update;
- one canon background knowledge file for default search.

Try it from the repository root:

```powershell
$env:STORYOS_CWD = (Resolve-Path "examples/superlong-webnovel").Path
corepack pnpm storymaker doctor
corepack pnpm storymaker status
corepack pnpm storymaker resume
corepack pnpm storymaker index rebuild --include-staged
corepack pnpm storymaker search "镜城"
corepack pnpm storymaker search --include-staged "白伞会"
corepack pnpm storymaker export --format md --include-staged
Remove-Item Env:STORYOS_CWD
```

For day-to-day authoring, create a separate project directory:

```bash
mkdir my-story
cd my-story
storymaker init --type superlong_webnovel --profile production
storymaker adapter install codex --cli-only
```

Then work through natural language with the AI agent:

```text
Continue writing the next chapter.
Approved.
Reject it: the ending does not hook the next chapter.
```

For real flow demonstrations, have the agent run `storymaker produce packet --unit next --json`, write a Markdown draft, then submit it with `storymaker draft submit`. For deterministic CLI tests or fixture refreshes, use `storymaker produce next --placeholder` explicitly; placeholder chapters are development fixtures rather than recommended author output.

The low-level `storyctl` command remains available for compatibility.
