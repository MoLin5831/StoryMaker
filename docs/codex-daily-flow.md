# Codex 日常流程

Codex 应该把 StoryMaker 包装成日常写作协作者，而不是把一张命令清单抛给用户。

## 面向用户的循环

```text
用户：继续写下一章。
Codex：第 0012 章已完成。这是正文和质量报告。是否通过？
```

用户不需要手动运行 `status`、`resume`、`context`、`produce`、`draft submit`、`approve`、`reject`。Codex 在后台调用 StoryMaker，并把可审阅结果交给用户。

## 意图路由

| 用户说 | Codex 应该做 |
| --- | --- |
| “继续”“继续写下一章” | 恢复状态；如果没有待审章节，运行 `storymaker produce packet --unit next --json`；根据工作包写出真实 Markdown 正文；再运行 `storymaker draft submit --unit <unit> --from <file> --title <title> --json`。 |
| “现在进度如何”“状态” | 运行 `storymaker status --json` 或 `storymaker resume --json`，然后用自然语言总结。 |
| “通过”“批准” | 对当前待审单元运行 `storymaker approve --unit <unit>`。 |
| “打回：<原因>” | 运行 `storymaker reject --unit <unit> --reason <reason>`。 |
| “按……修改” | 如有必要先打回，再运行 `storymaker revise --unit <unit> --mode <mode>`。 |

## 安全规则

- 每次行动前都先恢复当前状态。
- 没有用户明确确认，不得通过章节。
- 有章节等待审阅时，不得开始新章节。
- 被打回的草稿和待确认知识必须保留到后续明确处理。
- 优先使用 `storymaker`；`storyctl` 仅作为兼容命令。
- Codex 必须根据工作包和上下文自己写出真实 Markdown 正文。
- 占位产物只用于测试或无模型兜底，不是日常写作路径。

## 真实生成步骤

处理“继续写下一章”时，Codex 应该：

1. 运行 `storymaker status --json` 或 `storymaker resume --json`。
2. 如果没有待审章节，运行 `storymaker produce packet --unit next --json`。
3. 使用 `data.generation.prompt`、上下文来源、缺口、约束和输出目标写完整 Markdown 草稿。
4. 如果草稿建立了新事实，加入 `storymaker-facts` 块，格式见 [事实草稿协议](fact-draft-protocol.md)。
5. 把草稿保存到临时 Markdown 文件。
6. 运行 `storymaker draft submit --unit <unit> --from <file> --title <title> --json`。
7. 展示正文路径、质量报告路径和是否通过的问题。
8. 停在用户的通过/打回决定点。

## Codex 汇报内容

生产完成后，Codex 应展示：

```text
必要的进度信息
正文路径
质量报告路径
简短质量摘要
已知阻塞或连续性风险
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

进度事件和最终验收结构见 [进度与验收展示](progress-and-acceptance.md)。
