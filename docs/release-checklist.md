# StoryMaker 发布成熟度清单

本清单用于公开发布前的最后确认，目标是确保源码仓库、npm tarball、平台启动器和文档说明保持一致。

## 1. 发布前质量门

发布前在仓库根目录运行：

```bash
corepack pnpm release:check
```

该命令会顺序执行：

- `git diff --check`
- `corepack pnpm lint`
- `corepack pnpm -r typecheck`
- `corepack pnpm test`
- `corepack pnpm build:dashboard`
- `corepack pnpm package:cli-smoke`
- `corepack pnpm scan:secrets`
- `corepack pnpm security:audit`
- `corepack pnpm package:binaries`
- 平台启动器 `--version` smoke

如果其中任一命令失败，不要发布。

## 2. npm 包检查

当前 npm 包名仍为 `@storyos/cli`，安装后推荐使用 `storymaker` 命令。

发布包必须满足：

- 不依赖私有 workspace 包。
- 包内包含 `dist/index.js`。
- 包内包含 `dist/index.d.ts`，且声明文件不引用私有 workspace 路径。
- 包内包含 `dist/templates/base/project.yaml`。
- 包内包含 `dist/dashboard/index.js`。
- 安装后的 `storymaker --help`、`storymaker init`、`storymaker status`、`storymaker dashboard --once --port 0` 可运行。

这些检查由 `corepack pnpm package:cli-smoke` 自动覆盖。

## 3. 平台启动器策略

`bin/platform/storyctl.exe`、`bin/platform/storyctl-linux`、`bin/platform/storyctl-macos` 是生成产物，不进入源码仓库。

需要平台启动器时运行：

```bash
corepack pnpm package:binaries
```

这些启动器不是原生单文件二进制，不内置 Node.js，也不内置 CLI 源码。运行环境必须有 Node.js 24 或更新版本。

## 4. 版本与发布顺序

1. 更新版本号和 `CHANGELOG.md`。
2. 运行 `corepack pnpm release:check`。
3. 生成 npm tarball 并检查内容：

```bash
cd packages/cli
npm pack --dry-run
```

4. 确认 tarball 内容无示例项目、无 `.dev/`、无 `.storyos/story.db`、无本地密钥或环境文件。
5. 发布 `@storyos/cli`。
6. 发布后用全新临时目录安装并运行：

```bash
npm install -g @storyos/cli
storymaker --help
storymaker init --type superlong_webnovel --profile production
storymaker status
```

## 5. 回滚建议

如果发布后发现安装或启动问题：

1. 在 npm 上弃用问题版本，并在说明中指向最近可用版本。
2. 不要直接删除版本，除非确认符合 npm 删除政策且不会影响用户锁文件。
3. 修复后发布 patch 版本。
4. 在 `CHANGELOG.md` 中记录问题、影响范围和修复方式。
