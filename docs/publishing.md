# StoryMaker 发布策略

## 当前包名

当前 npm 包名是：

```text
@storyos/cli
```

它提供两个命令：

```text
storymaker
storyctl
```

`storymaker` 是推荐给用户的命令。`storyctl` 是兼容命令，保留给已有脚本、适配器和自动化。

## 当前限制

`@storymaker/cli` 尚未发布。用户暂时不要运行：

```bash
npm install -g @storymaker/cli
```

在正式增加并验证 `@storymaker/cli` 之前，请安装或打包 `@storyos/cli`，并使用其中的 `storymaker` 命令。

## 发布规则

1. 当前里程碑继续发布 `@storyos/cli`。
2. 所有用户文档、适配器和日常流程优先使用 `storymaker`。
3. 保留 `storyctl` 作为兼容命令。
4. 不在没有迁移方案的情况下移除 `storyctl`。
5. 如果未来增加 `@storymaker/cli`，需要单独验证包内容、bin 暴露方式和迁移说明。

## 发布前检查

发布 `@storyos/cli` 前运行：

```bash
corepack pnpm --filter @storyos/cli build
cd packages/cli
npm pack --dry-run
```

如果未来增加 `@storymaker/cli`，对应任务必须包含自己的 `npm pack --dry-run` 结果，并说明 `storymaker` 与 `storyctl` 两个命令如何暴露。
