# StoryMaker

StoryMaker 是一个本地优先、CLI 优先的叙事工程运行时，用于长篇小说、短篇、剧本、互动叙事和游戏叙事等复杂创作项目。它的目标是让 Codex、Claude Code 等 AI agent 自动推进写作流程，而 Markdown 仍然是内容源文件，SQLite 负责索引和检索。

## 日常体验

理想的日常使用方式是自然语言交互：

```text
用户：继续写下一章。
StoryMaker Agent：第 0001 章已生产完成。这是正文和质量报告。是否通过？
```

AI agent 会在后台调用 StoryMaker 命令。用户通常只需要审阅结果，然后选择通过、打回或要求修改。

真实生产流程中，agent 会先获取工作包，自己写出正文，再把正文提交回 StoryMaker：

```bash
storymaker produce packet --unit next --json
storymaker draft submit --unit chapter-0001 --from path/to/draft.md --title "章节标题"
```

`storymaker produce next --placeholder` 只用于开发、测试和无模型兜底，不是日常创作默认路径。

推荐从这里开始：

- [快速开始](docs/quickstart.md)
- [日常使用](docs/daily-usage.md)
- [产品级示例](examples/superlong-webnovel/README.md)
- [命名与兼容约定](docs/branding.md)
- [发布策略](docs/publishing.md)

体验示例项目：

```powershell
$env:STORYOS_CWD = (Resolve-Path "examples/superlong-webnovel").Path
corepack pnpm storymaker status
corepack pnpm storymaker resume
Remove-Item Env:STORYOS_CWD
```

## 命名约定

- `StoryMaker` 是产品名称。
- `storymaker` 是推荐使用的 CLI 命令。
- `storyctl` 是兼容命令，仍然可用。
- `.storyos/` 是当前本地运行状态目录名。它是现有命令和示例项目使用的实际路径，请不要手动改名。
- `STORYOS_CWD` 是当前 CLI 支持的项目路径环境变量名。
- `@storyos/cli` 是当前 npm 包名；安装后优先使用其中的 `storymaker` 命令。

## 工作区结构

```text
apps/
packages/
templates/
docs/
examples/
scripts/
```

## 常用开发命令

安装依赖：

```bash
corepack pnpm install
```

运行类型检查：

```bash
corepack pnpm -r typecheck
```

运行测试：

```bash
corepack pnpm test
```

从源码运行 CLI：

```bash
corepack pnpm storymaker --help
corepack pnpm storyctl --help
```

构建 Dashboard 及其依赖包：

```bash
corepack pnpm build:dashboard
```

启动本地 Dashboard：

```powershell
$env:STORYOS_CWD = (Resolve-Path "examples/superlong-webnovel").Path
corepack pnpm storymaker dashboard --once --port 0
Remove-Item Env:STORYOS_CWD
```

Dashboard 依赖 workspace 里的 `dist` 构建产物。如果源码变更后无法启动，请先重新运行 `corepack pnpm build:dashboard`。

## npm 包

当前包名是：

```text
@storyos/cli
```

它提供两个命令：

- `storymaker`：推荐给用户和新文档使用。
- `storyctl`：兼容命令，用于已有脚本和自动化。

`@storymaker/cli` 目前尚未发布。正式发布或本地打包前，请以 `packages/cli/package.json` 和 [发布策略](docs/publishing.md) 为准。

发布前本地检查：

```bash
corepack pnpm --filter @storyos/cli build
cd packages/cli
npm pack --dry-run
npx --yes ./storyos-cli-0.0.0.tgz --help
```

## 平台启动器

生成依赖 Node.js 的平台启动器：

```bash
corepack pnpm package:binaries
```

产物位置：

```text
bin/platform/storyctl.exe
bin/platform/storyctl-macos
bin/platform/storyctl-linux
```

这些文件不是原生单文件二进制，也不包含 Node.js 或 CLI 源码。它们要求系统 `PATH` 中存在 Node.js 24 或更新版本，并执行 `packages/cli/dist/index.js`。

## 导出格式

稳定可用：

- `storymaker export --format md`
- `storymaker export --format txt`

当前占位实现：

- `storymaker export --format docx`
- `storymaker export --format epub`

`docx` 和 `epub` 目前会生成确定性的占位文本产物，用于保持章节顺序和测试交接；它们还不是完整的 Word 或 EPUB 包。正式交付内容请优先使用 `md` 或 `txt`。

## 开发说明

- 普通用户和新文档优先使用 `storymaker`。
- `storyctl`、`.storyos/`、`STORYOS_CWD`、`@storyos/cli` 是当前兼容接口，只有在专门迁移任务中才应调整。
- `.dev/` 保存本地接力开发状态，已加入 `.gitignore`，不会默认推送。
