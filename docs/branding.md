# StoryMaker 命名与兼容约定

## 产品名称

用户看到的产品名称统一为 `StoryMaker`。

StoryMaker 的理想日常体验是：作者说“继续写下一章”，AI agent 自动推进工作流，生成章节、质量报告和待确认知识更新，然后停在用户审阅关口。

## CLI 命令

推荐命令：

```text
storymaker
```

兼容命令：

```text
storyctl
```

新文档、新适配器和日常提示词应优先使用 `storymaker`。`storyctl` 只作为兼容入口保留。

## npm 包名

npm 包名是：

```text
@molin05831/storymaker
```

这个包会暴露 `storymaker` 和 `storyctl` 两个命令。安装说明应优先引导用户使用 `storymaker` 命令，`storyctl` 只作为兼容入口出现。

## 本地运行状态目录

当前项目运行状态目录是：

```text
.storyos/
```

这是现有 CLI、示例项目和测试使用的实际目录名。用户不需要手动创建、移动或重命名它。

如果 `storymaker doctor` 提到 `.storyos/` 或 `.storymaker/`，请按命令输出理解为本地状态目录兼容检查，不要把它当成需要用户手动迁移的步骤。

## 用户体验原则

用户不应该记住底层命令链。推荐的日常交互是：

```text
用户：继续写下一章。
StoryMaker：第 0012 章已完成。这是正文和质量报告。是否通过？
```

CLI 是 Codex、Claude Code、Dashboard、测试和高级用户使用的确定性底座；普通作者只需要审阅结果并给出明确决定。
