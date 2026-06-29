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

完整发布前检查：

```bash
corepack pnpm release:check
```

该命令会覆盖 lint、类型检查、测试、Dashboard 构建、npm tarball 安装 smoke、密钥扫描、依赖审计和平台启动器 smoke。详细清单见 [发布成熟度清单](release-checklist.md)。

如果只需要验证 npm 包本身，可运行：

发布 `@storyos/cli` 前运行：

```bash
corepack pnpm package:cli-smoke
```

该命令会构建自包含 CLI 包，执行真实 `npm pack`，在临时目录安装生成的 tarball，并验证：

- 安装后的 package 不依赖私有 `@storyos/*` workspace 包。
- `dist/templates/base/project.yaml` 存在。
- `dist/dashboard/index.js` 存在。
- `storymaker --help`、`storymaker init`、`storymaker status`、`storymaker dashboard --once --port 0` 可以从安装包运行。

如果未来增加 `@storymaker/cli`，对应任务必须包含同等级别的真实 tarball 安装验证，并说明 `storymaker` 与 `storyctl` 两个命令如何暴露。

## 平台启动器

`bin/platform/storyctl.exe`、`bin/platform/storyctl-linux`、`bin/platform/storyctl-macos` 是生成产物，不进入源码仓库。需要它们时运行：

```bash
corepack pnpm package:binaries
```

这些启动器依赖系统 `PATH` 中的 Node.js 24 或更新版本，不是原生单文件二进制，也不包含 CLI 源码。
