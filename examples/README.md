# StoryMaker 示例

这些目录是用于测试、演示和产品验收的 StoryMaker 项目示例。`superlong-webnovel` 是产品级日常写作演示项目。

## 项目列表

```text
superlong-webnovel/
short-story/
screenplay/
```

你可以用它们查看 StoryMaker 项目结构、工作流状态、待审章节、质量报告、待确认知识更新，以及索引和搜索行为。

## 产品演示

`superlong-webnovel/` 包含演示故事《镜城雨线》。

```text
用户：继续写下一章。
StoryMaker Agent：第 0001 章已完成。这是正文和质量报告。是否通过？
```

这个示例故意停在 `awaiting_user_review` 状态，并包含：

- 项目企划与假设；
- 一章真实的待审正文测试样例；
- 一份质量报告；
- 一份待确认知识更新；
- 一个可用于默认搜索的正式背景知识文件。

从仓库根目录试用：

```powershell
$env:STORYOS_CWD = (Resolve-Path "examples/superlong-webnovel").Path
corepack pnpm storymaker doctor
corepack pnpm storymaker status
corepack pnpm storymaker resume
corepack pnpm storymaker index rebuild --include-staged
corepack pnpm storymaker search "镜城"
corepack pnpm storymaker search --include-staged "白伞会"
corepack pnpm storymaker export --format md --include-staged
Remove-Item Env:STORYOS_CWD
```

日常创作请创建独立项目：

```bash
mkdir my-story
cd my-story
storymaker init --type superlong_webnovel --profile production
storymaker adapter install codex --cli-only
```

然后用自然语言和 AI agent 协作：

```text
继续写下一章。
通过。
打回：结尾没有钩住下一章。
```

真实流程演示时，让 agent 运行 `storymaker produce packet --unit next --json`，写出 Markdown 正文，再用 `storymaker draft submit` 提交。只有在确定性 CLI 测试或刷新测试样例时，才显式使用 `storymaker produce next --placeholder`。

`storyctl` 仍可作为兼容命令使用。
