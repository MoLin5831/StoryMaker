# StoryMaker

StoryMaker 是一个本地优先的叙事工程运行时，适合长篇小说、短篇、剧本、互动叙事和游戏叙事等复杂创作项目。它以 CLI 作为稳定底座，让 Codex、Claude Code 等 AI agent 在后台推进写作流程；正文和设定仍然以 Markdown 保存，SQLite 负责索引、检索和上下文召回。

## 核心体验

StoryMaker 希望把日常写作简化成一句自然语言：

```text
用户：继续写下一章。
StoryMaker Agent：第 0001 章已完成。这是正文和质量报告。是否通过？
```

底层命令由 AI agent 执行。作者只需要检查正文、查看质量报告，然后明确选择通过、打回或要求修改。

真实创作时，agent 会先向 StoryMaker 获取工作包，再基于工作包和上下文写出正文，并提交到待审流程：

```bash
storymaker produce packet --unit next --json
storymaker draft submit --unit chapter-0001 --from path/to/draft.md --title "章节标题"
```

`storymaker produce next --placeholder` 只是开发和测试用的确定性兜底，不是推荐的日常写作入口。

## 从这里开始

- [快速开始](docs/quickstart.md)
- [日常使用](docs/daily-usage.md)
- [示例项目](examples/README.md)
- [命名与兼容约定](docs/branding.md)
- [发布策略](docs/publishing.md)

在源码仓库中试跑某个 StoryMaker 项目：

```powershell
$env:STORYOS_CWD = (Resolve-Path "path/to/your-story-project").Path
corepack pnpm storymaker status
corepack pnpm storymaker resume
Remove-Item Env:STORYOS_CWD
```

## 命名与兼容

- `StoryMaker` 是产品名称。
- `storymaker` 是推荐使用的命令。
- `storyctl` 是兼容命令，仍然可用。
- `.storyos/` 是当前本地运行状态目录，请不要手动改名。
- `STORYOS_CWD` 是当前 CLI 支持的项目路径环境变量。
- `storymaker` 是计划发布的 npm 包名；安装后仍提供 `storymaker` 与 `storyctl` 两个命令。

这些名称属于当前兼容接口。没有专门的迁移任务时，不建议自行重命名。

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

构建并类型检查：

```bash
corepack pnpm build
```

运行测试：

```bash
corepack pnpm test
```

`build` 和 `test` 会先准备 workspace 中 CLI、Dashboard 和内部包依赖的 `dist` 产物，因此干净 clone 后可以直接运行。验证“干净源码副本也能安装、测试、构建”：

```bash
corepack pnpm verify:clean-source
```

从源码运行 CLI：

```bash
corepack pnpm storymaker --help
corepack pnpm storyctl --help
```

构建 Dashboard 及其依赖：

```bash
corepack pnpm build:dashboard
```

启动本地 Dashboard：

```powershell
$env:STORYOS_CWD = (Resolve-Path "path/to/your-story-project").Path
corepack pnpm storymaker dashboard --once --port 0
Remove-Item Env:STORYOS_CWD
```

Dashboard 依赖 workspace 中的 `dist` 构建产物。`corepack pnpm build`、`corepack pnpm test` 和 `corepack pnpm build:dashboard` 都会刷新这些产物。

## npm 包

计划发布包名是：

```text
storymaker
```

它提供两个命令：

- `storymaker`：推荐给用户、新文档和新自动化使用。
- `storyctl`：兼容命令，用于已有脚本和自动化。

正式发布前请按 [发布策略](docs/publishing.md) 验证 npm registry 权限、tarball 内容和安装后 smoke test。

## Node.js 版本

当前要求 Node.js 24 或更新版本。索引模块使用 Node 内置 `node:sqlite`，这是 StoryMaker 暂时不能降到 Node 20 的主要原因。仓库提供 `.nvmrc`、`.node-version` 和 Volta 配置，方便贡献者自动切换到推荐版本。更多说明见 [Node.js 版本要求](docs/node-requirements.md)。

发布前本地检查：

```bash
corepack pnpm release:check
```

该检查会执行 lint、类型检查、测试、构建、真实 `npm pack` 临时安装、密钥扫描、依赖审计和平台启动器 smoke。只验证 npm 包时可运行 `corepack pnpm package:cli-smoke`。

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

这些文件是可再生成的 Node.js 启动器，不是原生单文件二进制，也不内置 Node.js 或 CLI 源码。运行它们需要系统 `PATH` 中存在 Node.js 24 或更新版本；Unix 版本由生成脚本写入可执行权限。生成产物默认不提交到源码仓库。

## 导出格式

稳定可用：

- `storymaker export --format md`
- `storymaker export --format txt`

当前占位实现：

- `storymaker export --format docx`
- `storymaker export --format epub`

`docx` 和 `epub` 目前会生成确定性的占位产物，用于保持章节顺序和测试交接；它们还不是完整的 Word 或 EPUB 文件。正式交付内容请优先使用 `md` 或 `txt`。

## 开发说明

- 普通用户和新文档优先使用 `storymaker`。
- `storyctl`、`.storyos/`、`STORYOS_CWD` 是当前兼容接口。
- `.dev/` 保存本地接力开发状态，已加入 `.gitignore`，不会默认推送。

## 参与贡献

提交 issue 或 PR 前请阅读 [贡献指南](CONTRIBUTING.md)。安全问题请按 [安全政策](SECURITY.md) 私下报告，避免在公开 issue 中披露利用细节。

## 许可证

本项目使用 [MIT License](LICENSE)。
