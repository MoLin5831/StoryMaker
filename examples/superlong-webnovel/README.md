# 《镜城雨线》StoryMaker 示例

这个目录是 StoryMaker 的产品级示例项目。它展示 AI agent 在用户说“继续写下一章”之后，如何产出待审正文、质量报告和待确认知识更新，然后停在用户验收关口。

## 日常体验

```text
用户：继续写下一章。

StoryMaker Agent：第 0001 章《镜城雨线》已生产完成。
正文：outputs/chapters/第 0001 章 镜城雨线.md
质量报告：reviews/run-2026-06-28T13-02-50.868Z-chapter-0001.md
是否通过？
```

用户只需要回答：

```text
通过
```

或：

```text
打回：开头钩子还不够强，沈砚出场可以更早。
```

## 包含内容

- `00-项目企划案.md`：题材、读者、主线承诺和阶段规划。
- `00-项目假设.md`：已确认设定、待验证假设和风险。
- `knowledge/canon/story-world.md`：可被默认搜索的正式背景知识。
- `outputs/chapters/第 0001 章 镜城雨线.md`：一章真实的待审正文测试样例。
- `reviews/run-2026-06-28T13-02-50.868Z-chapter-0001.md`：面向作者的质量报告。
- `.storyos/pending-knowledge-updates/*.json`：本章生成后的待确认知识更新。

## 验证命令

在仓库根目录运行：

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

这个示例故意停在 `awaiting_user_review`，因此不会自动通过正文，也不会把待确认事实提交为正式设定。
