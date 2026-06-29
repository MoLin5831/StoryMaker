# Claude Code 日常流程

Claude Code 应把 StoryMaker 作为内部工作流底座使用。用户只需要自然表达意图并审阅结果。

## 日常循环

```text
用户：继续写下一章。
Claude Code：第 0012 章已完成。这是正文和质量报告。是否通过？
```

用户不需要手动调用 `story-brief`、`story-produce`、`story-review`，也不需要自己串起底层 CLI 命令。

## 主要入口

日常工作优先使用生成的 `story-produce` skill：

| 用户说 | Claude Code 应该做 |
| --- | --- |
| “继续”“继续写下一章” | 恢复状态；如果没有待审章节，运行 `storymaker produce packet --unit next --json`；根据工作包写出真实 Markdown 正文；再运行 `storymaker draft submit --unit <unit> --from <file> --title <title> --json`。 |
| “通过”“批准” | 对当前待审单元运行 `storymaker approve --unit <unit>`。 |
| “打回：<原因>” | 运行 `storymaker reject --unit <unit> --reason <reason>`。 |
| “按……修改” | 对已打回单元运行 `storymaker revise --unit <unit> --mode <mode>`。 |
| “现在进度如何”“状态” | 使用 `storymaker status --json` 或 `storymaker resume --json`，然后总结。 |

## 安全规则

- 每次行动前都恢复当前工作流状态。
- 没有用户明确确认，不得通过章节。
- 有章节等待审阅时，不得开始新章节。
- 不要求用户手动调用多个 StoryMaker skill。
- 优先使用 `storymaker`；`storyctl` 仅作为兼容命令。
- Claude Code 必须根据工作包和上下文自己写出真实 Markdown 正文。
- 占位产物只用于测试或无模型兜底，不是日常写作路径。

## 真实生成步骤

处理“继续写下一章”时，Claude Code 应该：

1. 运行 `storymaker status --json` 或 `storymaker resume --json`。
2. 如果没有待审章节，运行 `storymaker produce packet --unit next --json`。
3. 使用 `data.generation.prompt`、上下文来源、缺口、约束和输出目标写完整 Markdown 草稿。
4. 如果草稿建立了新事实，加入 `storymaker-facts` 块，格式见 [事实草稿协议](fact-draft-protocol.md)。
5. 把草稿保存到临时 Markdown 文件。
6. 运行 `storymaker draft submit --unit <unit> --from <file> --title <title> --json`。
7. 展示正文路径、质量报告路径和是否通过的问题。
8. 停在用户的通过/打回决定点。

## 审阅回复

生产完成后，Claude Code 应展示：

```text
必要的进度信息
正文路径
质量报告路径
简短摘要或已知阻塞
是否通过的问题
```

推荐结尾：

```text
最终验收
工作单元：chapter-0012
正文路径：outputs/chapters/0012.md
质量报告路径：reviews/run-0012.md
问题：是否通过这一章？
```

进度事件和最终验收结构见 [进度与验收展示](progress-and-acceptance.md)。一次回复应停在用户决策点，而不是自动继续下一章。
