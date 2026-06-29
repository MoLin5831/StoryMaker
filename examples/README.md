# StoryMaker 示例

这些目录是用于查看项目结构和轻量测试的 StoryMaker 示例。完整的产品级演示项目可以保留在本地，但不随公开仓库分发。

## 项目列表

```text
short-story/
screenplay/
```

你可以用它们查看 StoryMaker 项目结构、基础配置和不同内容类型的起始文件。

## 日常体验

真实创作项目中的日常体验应类似：

```text
用户：继续写下一章。
StoryMaker Agent：第 0001 章已完成。这是正文和质量报告。是否通过？
```

产品级演示通常会包含：

- 项目企划与假设；
- 待审正文；
- 质量报告；
- 待确认知识更新；
- 可用于索引和搜索的正式设定文件。

这些完整演示资产更适合留在本地或单独发布，避免公开仓库携带过多正文、运行状态和导出产物。

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
