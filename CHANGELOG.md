# 更新日志

这里记录 StoryMaker CLI 包的重要变化。

当前以 `packages/cli/package.json` 作为 npm 包版本来源。任何版本号调整都应在同一变更中同步更新本文件。

## 0.1.0

- 统一用户可见产品名称为 `StoryMaker`。
- 将 `storymaker` 作为推荐 CLI 命令，并保留 `storyctl` 作为兼容命令。
- 明确当前本地运行状态目录为 `.storyos/`，用户不需要手动重命名。
- 准备首次发布 npm 包 `storymaker`，暴露 `storymaker` 和 `storyctl` 两个命令。

## 0.0.0

- 准备首个未发布的 `@storyos/cli` 包。
- 包含 CLI 初始化、工作流命令、适配器、索引、导入导出、MCP 开关、Dashboard 和测试脚手架。
