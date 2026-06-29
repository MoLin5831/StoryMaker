# 事实草稿协议

AI agent 可以在提交的草稿中包含 `storymaker-facts` JSON 块。StoryMaker 会把这些内容提取为待确认知识更新，并从读者可见的章节 Markdown 中移除。

格式如下：

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

支持的 `type`：

- `character_state`
- `location_change`
- `item_location`
- `ability_rule`
- `timeline_event`
- `new_foreshadowing`
- `recovered_foreshadowing`
- `unconfirmed_assumption`

必填字段：

- `type`
- `summary`

可选字段：

- `subject`
- `key`
- `value`
- `note`
- `sourceRef`
- `confidence`：`low`、`medium` 或 `high`

这些事实会保持待确认状态，直到用户通过对应章节。如果章节被打回，对应的待确认知识更新也会随之打回，不会进入正式设定。
