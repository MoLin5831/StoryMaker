# Codex Daily Flow

Codex should make StoryMaker feel like a daily writing collaborator, not a command checklist.

## User-Facing Loop

```text
User: Continue writing the next chapter.
Codex: Chapter 0012 is complete. Here is the draft and quality report. Approve it?
```

The user should not need to run `status`, `resume`, `context`, `produce`, `draft submit`, `approve`, and `reject` manually. Codex runs StoryMaker commands internally and reports the result.

## Intent Routing

| User says | Codex should do |
| --- | --- |
| "Continue", "继续写下一章" | Recover state, run `storymaker produce packet --unit next --json`, write the real Markdown draft, then run `storymaker draft submit --unit <unit> --from <file> --title <title> --json`. |
| "Status", "现在进度如何" | Run `storymaker status --json` or `storymaker resume --json`, then summarize. |
| "Approve", "通过" | Approve the current awaiting-review unit with `storymaker approve --unit <unit>`. |
| "Reject: <reason>", "打回，原因是..." | Run `storymaker reject --unit <unit> --reason <reason>`. |
| "Revise with..." | Reject if needed, then run `storymaker revise --unit <unit> --mode <mode>`. |

## Safety Rules

- Always recover current state before choosing an action.
- Never approve without explicit user confirmation.
- Never start a new unit while another unit is awaiting user review.
- Preserve rejected drafts and staged knowledge until a later approval.
- Prefer `storymaker`; `storyctl` is only a compatibility alias.
- Codex must write the real Markdown draft itself from the Work Packet prompt and context.
- Placeholder output is only a test or no-model fallback, not the default daily path.

## Real Generation Steps

For a safe "continue writing" request, Codex should:

1. Run `storymaker status --json` or `storymaker resume --json`.
2. If no unit is awaiting review, run `storymaker produce packet --unit next --json`.
3. Use `data.generation.prompt`, context sources, gaps, constraints, and output target to write the full Markdown draft.
4. Add a `storymaker-facts` block when the draft establishes staged facts; follow [Fact Draft Protocol](fact-draft-protocol.md).
5. Save that draft to a temporary Markdown file.
6. Run `storymaker draft submit --unit <unit> --from <file> --title <title> --json`.
7. Show the staged draft path, report path, and approval question.
8. Stop for the user's approve/reject decision.

## What Codex Reports

After production, Codex should show:

```text
progress lines, when visible
draft path
quality report path
short quality summary when available
known blocker or continuity risk
approval question
```

The ideal close of a turn is:

```text
Final acceptance
WorkUnit: chapter-0012
Draft path: outputs/chapters/0012.md
Quality report path: reviews/run-0012.md
Question: Approve this chapter?
```

See `docs/progress-and-acceptance.md` for the progress event schema and final acceptance template.
