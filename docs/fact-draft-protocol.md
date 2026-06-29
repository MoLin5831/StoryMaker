# Fact Draft Protocol

AI agents may include a `storymaker-facts` JSON block in a submitted draft. StoryMaker extracts the block into the staged `PendingKnowledgeUpdate` and removes it from the reader-facing chapter Markdown.

Use this shape:

````markdown
```storymaker-facts
{
  "factDrafts": [
    {
      "type": "character_state",
      "subject": "Mara",
      "key": "location",
      "value": "archive",
      "summary": "Mara moves from the market to the archive.",
      "confidence": "high"
    }
  ]
}
```
````

Supported `type` values:

- `character_state`
- `location_change`
- `item_location`
- `ability_rule`
- `timeline_event`
- `new_foreshadowing`
- `recovered_foreshadowing`
- `unconfirmed_assumption`

Required fields:

- `type`
- `summary`

Optional fields:

- `subject`
- `key`
- `value`
- `note`
- `sourceRef`
- `confidence`: `low`, `medium`, or `high`

Facts remain staged until the user approves the chapter. If the chapter is rejected, the pending knowledge update is rejected with it and does not become canon.
