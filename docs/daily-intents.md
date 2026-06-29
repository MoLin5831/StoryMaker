# StoryMaker Daily Intents

Daily intents turn the author's natural-language requests into stable actions that adapters and future UI surfaces can route safely.

## Intent Values

```text
continue_next_unit
approve_current_unit
reject_current_unit
revise_current_unit
show_status
show_pending_review
stop_auto_production
```

## Phrase Mapping

| User phrase examples | Intent | Required data |
| --- | --- | --- |
| "继续写下一章", "Continue writing the next chapter", "Continue" | `continue_next_unit` | none |
| "通过", "Approved", "Approve this chapter" | `approve_current_unit` | explicit approval |
| "打回，原因是主角选择不可信", "Reject it: the motivation is weak" | `reject_current_unit` | rejection reason |
| "修改后再给我看", "Revise with a stronger hook", "Rewrite and show me again" | `revise_current_unit` | revision direction |
| "现在进度如何", "Show current progress", "Status" | `show_status` | none |
| "给我看待验收章节", "Show pending review", "What am I reviewing?" | `show_pending_review` | none |
| "先停一下", "Stop auto production", "Pause after this" | `stop_auto_production` | none |

## Routing Rules

Before acting on any intent, the AI must recover current state by running or using the equivalent of:

```text
storymaker status
storymaker resume
```

The recovered workflow state decides the path:

| Workflow state | Safe behavior |
| --- | --- |
| `idle` or `ready_to_produce` | `continue_next_unit` may start the next production unit. |
| `awaiting_user_review` | Show the pending draft and report; do not produce another unit unless the user explicitly rejects, approves, or asks to revise. |
| `producing` | Resume or report the active run; do not start a second run. |
| `blocked` | Show the blocker and suggested recovery action. |

## Approval Boundary

Approval must be explicit. The AI must not convert `continue_next_unit`, `show_pending_review`, praise, silence, or ambiguous feedback into `approve_current_unit`.

Valid approval examples:

```text
通过
Approved
Approve chapter 12
可以，提交知识库
```

Invalid approval examples:

```text
Looks good so far
Continue
Show me the next version
No comments
```

If the user rejects or asks for revision, the AI should preserve the staged draft and staged facts separately until a later explicit approval.

## Adapter Contract

Adapters should expose these intents to the user as natural language, not as a required command chain. Internally, adapters may call CLI commands, but user-facing daily work should look like:

```text
User: Continue writing the next chapter.
AI: Chapter 0012 is complete. Here is the draft and quality report. Approve it?
```

The intent protocol is a routing layer only. It does not implement `storymaker continue`, run production, or change workflow state by itself.
