# Progress And Acceptance Display

StoryMaker daily production has two user-visible phases:

1. Progress events while the pipeline is running.
2. A final acceptance summary after one unit reaches `awaiting_user_review`.

## Progress Event Schema

CLI progress lines are generated from this event shape:

```ts
type ProduceProgressEvent = {
  error?: string;
  index: number;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  stepId: string;
  stepName: string;
  total: number;
};
```

Plain text commands print one line per completed step:

```text
[1/12] completed: Load project configuration (load-project-config)
```

JSON commands suppress progress text and return the final command envelope only.

## Final Acceptance Summary

When production completes or an existing draft is already waiting for review, StoryMaker prints and returns:

```text
Final acceptance
WorkUnit: chapter-0001
Draft path: outputs/chapters/Placeholder Chapter.md
Quality report path: reviews/run-...md
Question: Approve this chapter?
```

The same data is exposed in JSON as `acceptance`:

```json
{
  "acceptance": {
    "unitId": "chapter-0001",
    "draftPath": "outputs/chapters/Placeholder Chapter.md",
    "qualityReportPath": "reviews/run-...md",
    "question": "Approve this chapter?"
  }
}
```

## Adapter Relay Rule

AI adapters should summarize progress briefly while a run is active. For the real daily writing path, adapters should generate a Work Packet, write the Markdown draft themselves, submit it with `storymaker draft submit`, then show the draft path, quality report path, and the approval question.

They should not start another unit automatically after reaching `awaiting_user_review`.

Placeholder production output is only a test or no-model fallback, not the default adapter path.
