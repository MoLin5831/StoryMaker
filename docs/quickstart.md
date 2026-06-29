# StoryMaker 快速开始

这份指南面向通过 Codex 或 Claude Code 使用 StoryMaker 的作者。

## 安装说明

当前 npm 包名是 `@storyos/cli`，它提供推荐命令 `storymaker` 和兼容命令 `storyctl`。`@storymaker/cli` 尚未发布。

## 1. 创建项目

请创建一个独立的故事目录，不要把小说正文写在 StoryMaker 源码仓库里。

```bash
mkdir my-novel
cd my-novel
storymaker init --type superlong_webnovel --profile production
```

然后补充项目起始文件：

```text
project.yaml
00-项目企划案.md
00-项目假设.md
```

## 2. 安装一个 AI 适配器

Codex：

```bash
storymaker adapter install codex --cli-only
```

Claude Code：

```bash
storymaker adapter install claude-code --cli-only
```

建议先让一个 agent 负责当前项目。之后可以同时保留多个适配器，但日常写作最好由一个 agent 接管同一轮上下文。

## 3. 日常使用

前期设定完成后，日常交互应尽量自然：

```text
用户：继续写下一章。
AI：第 0001 章已生产完成。这是正文和质量报告。是否通过？
```

通过：

```text
用户：通过。
```

打回：

```text
用户：打回。开头钩子不够强，节奏也太慢。
```

AI agent 会在后台调用 StoryMaker 命令。普通用户不需要手动串起 `status`、`context`、`produce`、`index`、`approve`、`resume` 等命令链。

## 4. 常用手动命令

高级用户仍然可以直接检查项目状态：

```bash
storymaker status
storymaker resume
storymaker search "主角"
storymaker export --format md
```

`storyctl` 对同一批命令仍然可用。

## 5. 从源码启动 Dashboard

如果你在这个 monorepo 中运行 StoryMaker，而不是使用已安装包，请先构建 Dashboard 运行时：

```bash
corepack pnpm build:dashboard
```

然后指定一个 StoryMaker 项目并启动：

```powershell
$env:STORYOS_CWD = (Resolve-Path "examples/superlong-webnovel").Path
corepack pnpm storymaker dashboard --once --port 0
Remove-Item Env:STORYOS_CWD
```

Dashboard 使用 workspace 中构建出的 `dist` 文件。修改 Dashboard、CLI 或 package 源码后，请重新运行 `corepack pnpm build:dashboard`。
