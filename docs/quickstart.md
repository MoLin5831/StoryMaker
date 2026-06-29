# StoryMaker 快速开始

这份指南面向准备通过 Codex 或 Claude Code 使用 StoryMaker 的作者。目标是帮你完成一次项目初始化，并理解日常写作应该如何交给 AI agent 推进。

## 安装说明

npm 包名是 `@molin05831/storymaker`。它提供推荐命令 `storymaker`，也保留兼容命令 `storyctl`。

安装：

```bash
npm install -g @molin05831/storymaker
```

StoryMaker 当前要求 Node.js 24 或更新版本。源码仓库提供 `.nvmrc`、`.node-version` 和 Volta 配置；如果你使用 nvm、fnm、asdf 或 Volta，可以直接切换到仓库声明的版本。版本要求的原因见 [Node.js 版本要求](node-requirements.md)。

## 1. 创建项目

请在独立目录中创建故事项目，不要把正文写进 StoryMaker 源码仓库。

```bash
mkdir my-novel
cd my-novel
storymaker init --type superlong_webnovel --profile production
```

初始化后，请先补充项目基础文件：

```text
project.yaml
00-项目企划案.md
00-项目假设.md
```

这些文件决定题材、读者、主线承诺、世界观边界和早期风险。前期信息越清楚，后续自动写作越稳定。

## 2. 安装一个 AI 适配器

Codex：

```bash
storymaker adapter install codex --cli-only
```

Claude Code：

```bash
storymaker adapter install claude-code --cli-only
```

建议一个项目先由一个 agent 接管。多个适配器可以共存，但同一轮写作最好由同一个 agent 负责上下文。

## 3. 日常写作

完成前期设定后，日常使用应尽量像正常对话：

```text
用户：继续写下一章。
AI：第 0001 章已完成。这是正文和质量报告。是否通过？
```

通过：

```text
用户：通过。
```

打回：

```text
用户：打回。开头钩子不够强，节奏也太慢。
```

AI agent 会在后台调用 StoryMaker。普通用户不需要手动串起 `status`、`context`、`produce`、`index`、`approve`、`resume` 等命令。

## 4. 常用手动命令

高级用户可以直接检查项目状态：

```bash
storymaker status
storymaker resume
storymaker search "主角"
storymaker export --format md
```

`storyctl` 对同一批命令仍然可用。

## 5. 从源码启动 Dashboard

如果你在 monorepo 中运行 StoryMaker，而不是使用已安装包，请先构建 Dashboard 运行时：

```bash
corepack pnpm build:dashboard
```

然后指定一个 StoryMaker 项目并启动：

```powershell
$env:STORYOS_CWD = (Resolve-Path "path/to/your-story-project").Path
corepack pnpm storymaker dashboard --once --port 0
Remove-Item Env:STORYOS_CWD
```

Dashboard 使用 workspace 中构建出的 `dist` 文件。修改 Dashboard、CLI 或 package 源码后，请重新运行 `corepack pnpm build:dashboard`。
