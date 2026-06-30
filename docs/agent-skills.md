# StoryMaker 推荐 Agent Skill

StoryMaker 提供一个可选的中文网文创作 skill 模板：

```text
skills/storymaker-chinese-webnovel/
```

它适合中文网络小说项目，覆盖前期设定引导、章节规划、正文写作和质量审查。这个 skill 不替代 StoryMaker CLI；它让 Codex 或 Claude Code 在调用 `storymaker produce packet`、`storymaker draft submit`、`storymaker approve`、`storymaker reject`、`storymaker revise` 时更懂中文网文节奏。

## Codex 安装

在 StoryMaker 源码仓库根目录运行：

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.codex\skills" | Out-Null
Copy-Item -Recurse -Force ".\skills\storymaker-chinese-webnovel" "$env:USERPROFILE\.codex\skills\"
```

macOS 或 Linux：

```bash
mkdir -p ~/.codex/skills
cp -R skills/storymaker-chinese-webnovel ~/.codex/skills/
```

重开 Codex 会话后，在你的 StoryMaker 小说项目目录里使用：

```text
使用 $storymaker-chinese-webnovel，引导我完成前期设定。
```

或：

```text
使用 $storymaker-chinese-webnovel，继续写下一章。
```

## Claude Code 安装

先在你的小说项目目录中安装 Claude Code 适配器：

```bash
storymaker adapter install claude-code --cli-only
```

然后把推荐 skill 复制到该小说项目的 `.claude/skills/`：

```powershell
New-Item -ItemType Directory -Force ".\.claude\skills" | Out-Null
Copy-Item -Recurse -Force "D:\path\to\StoryMaker\skills\storymaker-chinese-webnovel" ".\.claude\skills\"
```

macOS 或 Linux：

```bash
mkdir -p .claude/skills
cp -R /path/to/StoryMaker/skills/storymaker-chinese-webnovel .claude/skills/
```

在 Claude Code 中可以这样使用：

```text
使用 storymaker-chinese-webnovel skill，引导我完成前期设定。
```

或：

```text
使用 storymaker-chinese-webnovel skill，继续写下一章。
```

## 使用边界

- 这个 skill 是创作风格和流程协作层，不负责保存运行状态。
- StoryMaker CLI 仍然是工作流权威。
- `approve` 和 `reject` 必须由用户明确决定后再执行。
- 不要用 `storymaker produce next --placeholder` 做真实写作，它只适合测试或无模型兜底。
