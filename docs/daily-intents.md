# StoryMaker 日常意图

日常意图用于把作者的自然语言请求映射成稳定、安全的动作，方便适配器和未来 UI 复用。

## 意图值

```text
continue_next_unit
approve_current_unit
reject_current_unit
revise_current_unit
show_status
show_pending_review
stop_auto_production
```

## 说法映射

| 用户说法示例 | 意图 | 必要信息 |
| --- | --- | --- |
| “继续写下一章”“继续” | `continue_next_unit` | 无 |
| “通过”“批准这一章” | `approve_current_unit` | 明确通过 |
| “打回，原因是主角动机不可信” | `reject_current_unit` | 打回原因 |
| “修改后再给我看”“钩子再强一点” | `revise_current_unit` | 修改方向 |
| “现在进度如何”“状态” | `show_status` | 无 |
| “给我看待审章节”“我现在要审什么？” | `show_pending_review` | 无 |
| “先停一下”“这一章之后暂停” | `stop_auto_production` | 无 |

## 路由规则

执行任何意图前，AI 必须先恢复当前状态，通常等价于运行：

```text
storymaker status
storymaker resume
```

恢复出的工作流状态决定安全路径：

| 工作流状态 | 安全行为 |
| --- | --- |
| `idle` 或 `ready_to_produce` | `continue_next_unit` 可以启动下一工作单元。 |
| `awaiting_user_review` | 展示待审草稿和报告；除非用户明确通过、打回或要求修改，否则不要生成新单元。 |
| `producing` | 恢复或汇报正在运行的任务；不要启动第二个任务。 |
| `blocked` | 展示阻塞原因和建议恢复动作。 |

## 通过边界

通过必须明确。AI 不得把“继续”“看看下一版”“还行”“没意见”或沉默理解为 `approve_current_unit`。

有效通过示例：

```text
通过
批准
通过第 12 章
可以，提交知识库
```

无效通过示例：

```text
看起来还不错
继续
给我看下一版
暂时没意见
```

如果用户打回或要求修改，AI 应保留当前草稿和待确认事实，直到后续明确通过。

## 适配器契约

适配器应把这些意图包装成自然语言体验，而不是要求用户记住命令链。内部可以调用 CLI，但面向用户的日常工作应类似：

```text
用户：继续写下一章。
AI：第 0012 章已完成。这是正文和质量报告。是否通过？
```

意图协议只是路由层，本身不实现 `storymaker continue`，不运行生产任务，也不改变工作流状态。
