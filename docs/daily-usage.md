# StoryMaker Daily Usage

StoryMaker is designed so the author reviews creative results while the AI agent handles the workflow machinery.

## The Ideal Loop

```text
User: Continue writing the next chapter.

StoryMaker Agent:
1. Restores workflow state.
2. Retrieves focused context.
3. Produces the next work unit.
4. Runs quality checks.
5. Prepares pending knowledge updates.
6. Shows the chapter and quality report.
7. Waits for approval or rejection.
```

The user sees the result, not the command chain.

## User Phrases

Use short natural language:

```text
Continue.
Continue writing the next chapter.
Show current progress.
Approved.
Approve and continue.
Reject it: the protagonist choice is not believable.
Revise with a stronger hook.
Rename this chapter to Rain Guest.
```

## Agent Responsibilities

The agent should:

- Run `storymaker status` or `storymaker resume` before deciding what to do.
- Avoid starting a new chapter when a staged chapter is already awaiting review.
- Use focused context before writing.
- Stop after each generated chapter and ask for user approval.
- Commit canon only after user approval.
- Keep rejected drafts and staged facts isolated.

The agent should not:

- Ask the user to manually execute a long chain of StoryMaker commands.
- Mark unreviewed output as final.
- Silently overwrite story files or project settings.
- Treat assumptions as canon.

## What The User Reviews

Each chapter review should include:

```text
chapter draft path
quality report path
short quality summary
known risks or continuity gaps
approval question
```

Example:

```text
Chapter 0007 is complete.

Draft: outputs/chapters/第 0007 章 雨夜来客.md
Report: reviews/run-...-chapter-0007.md

Summary:
- Continuity: no blocking conflict found.
- Style: one stock phrase was revised.
- Knowledge: 3 pending facts are waiting for approval.

Approve this chapter?
```
