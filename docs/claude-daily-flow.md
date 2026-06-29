# Claude Code Daily Flow

Claude Code should use StoryMaker skills as an internal routing layer. The user should speak naturally and review results.

## Daily Loop

```text
User: Continue writing the next chapter.
Claude Code: Chapter 0012 is complete. Here is the draft and quality report. Approve it?
```

The user should not need to manually invoke `story-brief`, `story-produce`, `story-review`, or a chain of low-level CLI commands.

## Main Entry

Use the generated `story-produce` skill for daily work:

| User says | Claude Code should do |
| --- | --- |
| "Continue", "继续写下一章" | Recover state, run `storymaker produce packet --unit next --json`, write the real Markdown draft, then run `storymaker draft submit --unit <unit> --from <file> --title <title> --json`. |
| "Approve", "通过" | Run `storymaker approve --unit <unit>` for the awaiting-review unit. |
| "Reject: <reason>", "打回，原因是..." | Run `storymaker reject --unit <unit> --reason <reason>`. |
| "Revise with..." | Run `storymaker revise --unit <unit> --mode <mode>` after rejection or when revising a rejected unit. |
| "Status", "现在进度如何" | Use `storymaker status --json` or `storymaker resume --json`, then summarize. |

## Safety Rules

- Recover current workflow state before choosing an action.
- Do not approve without explicit user confirmation.
- Do not start a new unit while one is awaiting user review.
- Do not ask the user to manually invoke multiple StoryMaker skills.
- Prefer `storymaker`; `storyctl` remains a compatibility alias.
- Claude Code must write the real Markdown draft itself from the Work Packet prompt and context.
- Placeholder output is only a test or no-model fallback, not the default daily path.

## Real Generation Steps

For a safe "continue writing" request, Claude Code should:

1. Run `storymaker status --json` or `storymaker resume --json`.
2. If no unit is awaiting review, run `storymaker produce packet --unit next --json`.
3. Use `data.generation.prompt`, context sources, gaps, constraints, and output target to write the full Markdown draft.
4. Add a `storymaker-facts` block when the draft establishes staged facts; follow [Fact Draft Protocol](fact-draft-protocol.md).
5. Save that draft to a temporary Markdown file.
6. Run `storymaker draft submit --unit <unit> --from <file> --title <title> --json`.
7. Show the staged draft path, report path, and approval question.
8. Stop for the user's approve/reject decision.

## Review Response

After a unit is produced, Claude Code should show:

```text
progress lines, when visible
draft path
quality report path
short summary or known blocker
approval question
```

The final acceptance block should follow this template:

```text
Final acceptance
WorkUnit: chapter-0012
Draft path: outputs/chapters/0012.md
Quality report path: reviews/run-0012.md
Question: Approve this chapter?
```

See `docs/progress-and-acceptance.md` for the progress event schema.

The turn should end at the user decision point, not with another automatic chapter.
