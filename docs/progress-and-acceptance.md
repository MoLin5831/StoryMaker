# 进度与验收展示

StoryMaker 的日常生产包含两个用户可见阶段：

1. 管线运行中的进度事件。
2. 一个工作单元进入 `awaiting_user_review` 后的最终验收摘要。

## 进度事件结构

CLI 进度行来自以下事件结构：

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

普通文本命令会为每个完成步骤打印一行：

```text
[1/12] completed: Load project configuration (load-project-config)
```

JSON 命令会抑制进度文本，只返回最终命令结果。

## 最终验收摘要

生产完成后，或已有草稿等待审阅时，StoryMaker 会输出：

```text
最终验收
工作单元：chapter-0001
正文路径：outputs/chapters/Placeholder Chapter.md
质量报告路径：reviews/run-...md
问题：是否通过这一章？
```

同一数据在 JSON 中暴露为 `acceptance`：

```json
{
  "acceptance": {
    "unitId": "chapter-0001",
    "draftPath": "outputs/chapters/Placeholder Chapter.md",
    "qualityReportPath": "reviews/run-...md",
    "question": "是否通过这一章？"
  }
}
```

## 适配器转述规则

AI 适配器应在任务运行时简要总结进度。真实日常写作路径中，适配器应生成工作包，自己写 Markdown 草稿，用 `storymaker draft submit` 提交，然后展示正文路径、质量报告路径和是否通过的问题。

到达 `awaiting_user_review` 后，适配器不应自动开始下一个工作单元。

占位生产结果只用于测试或无模型兜底，不是默认写作路径。
