# StoryMaker 最终产品验收与全量测试报告

日期：2026-06-29
项目：StoryMaker
结论：**有条件可交付**

说明：本报告验收时使用的 `examples/superlong-webnovel` 是本地产品级演示资产，不随公开仓库分发。

StoryMaker 以 CLI 为底座的核心链路、产品级示例、索引、搜索、导出、待确认知识、通过/打回/修订状态转移和发布限制说明基本成立。它已经可以支撑受控的 AI agent 写作试用：用户通过 Codex 或 Claude 说“继续写下一章”，agent 按工作包写稿并提交，用户审阅后决定通过或打回。

但本轮发现 3 个 P1 问题，主要影响 Dashboard 和修订后的质量报告可信度。因此不建议直接面向真实用户公开试用；建议先修复 P1，再进入小范围真实用户试用。

## 测试环境

| 项 | 结果 |
| --- | --- |
| OS | Microsoft Windows 11 专业版 10.0.26200, 64-bit |
| Node.js | v24.18.0 |
| pnpm | 10.17.1 |
| 包管理器 | `pnpm@10.17.1` |
| `.dev` 状态 | 78 个任务全部 `done`，`activeTask: null`，`locks: {}` |

## 使用的 Skills

| Skill | 用途 |
| --- | --- |
| `using-agent-skills` | 自动发现本机可用 skill，并选择验收组合 |
| `relay-development` | 核对 `.dev/state.json`、task board、active task 和文件锁 |
| `qa-only` | 按“只报告不修复”方式执行验收 |
| `devex-review` | 验证安装、CLI、文档、发布和 launcher 开发者体验 |
| `code-review-and-quality` | 按 P0/P1/P2/P3 做风险分级 |
| `control-in-app-browser` | 启动浏览器检查 Dashboard DOM、表单、控制台错误和截图 |

## 命令执行结果

| 命令 | 结果 | 备注 |
| --- | --- | --- |
| `corepack pnpm install --frozen-lockfile` | PASS | lockfile up to date |
| `corepack pnpm -r typecheck` | PASS | 13 个 workspace 项目通过 |
| `corepack pnpm test` | PASS | CLI 85 项、schemas 13 项、workflow 18 项等通过 |
| `corepack pnpm storymaker --help` | PASS | `storymaker` 用户入口可用 |
| `corepack pnpm storyctl --help` | PASS | `storyctl` 兼容 alias 可用 |
| `STORYOS_CWD=examples/superlong-webnovel corepack pnpm storymaker doctor` | PASS | project/db/workflow/index 均 ok |
| `... storymaker status` | PASS | 显示 `awaiting_user_review` 和 pending chapter |
| `... storymaker resume` | PASS | 显示待审输出、最新运行和报告文件 |
| `... storymaker continue --json` | PASS | 返回 draft/report/acceptance/12 步进度结构 |
| `... storymaker index rebuild --include-staged` | PASS | 扫描 2 个 Markdown，索引 2 个 |
| `... storymaker search "镜城"` | PASS | 默认返回正式设定背景知识 |
| `... storymaker search --include-staged "白伞会"` | PASS | 返回待审事实、章节和正式设定 |
| `... storymaker export --format md --include-staged` | PASS | 实际导出 1 章 |
| `... storymaker export --format txt --include-staged` | PASS | 实际导出 1 章 |
| `... storymaker export --format docx --include-staged` | PASS | 占位产物提示清楚 |
| `... storymaker export --format epub --include-staged` | PASS | 占位产物提示清楚 |
| `corepack pnpm package:binaries` | PASS | 生成依赖 Node.js 的平台启动器 |
| `bin\platform\storyctl.exe --version` | PASS | 输出 `0.0.0` |
| `... storymaker dashboard --once --port 0` | FAIL initially | 缺少 built dist dependency，见 P1-001 |
| build `@storyos/core`, `@storyos/schemas`, `@storyos/dashboard` 后重试 dashboard | PASS | one-shot 输出 URL |
| Dashboard browser DOM check | PARTIAL | 页面打开、状态、待审内容、进度、知识库和表单可见；质量报告摘要缺失 |

## 产品体验验收

核心体验目标是：用户只说“继续写下一章”，AI 自动推进，用户只审阅结果。

验收结果：**部分达到**。

已满足：

- 文档、Codex 适配器、Claude Code skill 都明确要求 agent 不让用户手动跑命令链。
- `storymaker produce packet --unit next --json` 能生成完整工作包，包括生成提示、上下文缺口、输出路径、质量门和待确认知识路径。
- `storymaker draft submit` 能把 AI 写出的真实 Markdown 草稿放入 `awaiting_user_review`，并生成质量报告和待确认知识。
- `storymaker continue --json` 在示例项目中能返回草稿路径、质量报告路径、验收问题和生产步骤，适合 AI agent 汇报给用户。

不足：

- `storymaker continue` 在 idle/ready 状态只给出下一步命令指导，不会自己完成“写正文 -> 提交”。这是合理的安全边界，但产品层需要依赖 Codex 或 Claude agent 严格执行适配器规则。
- 当前缺少一个端到端的“模拟用户说继续，agent 自动写稿并提交”的验收脚本或产品演示级测试样例。

## CLI 验收

验收结果：**通过，带少量体验问题**。

通过项：

- `storymaker` / `storyctl` 两个入口可用。
- `init`、`adapter install codex`、`adapter install claude-code` 在临时项目中可用。
- `produce packet`、`draft submit`、`approve`、`reject`、`revise` 均跑通。
- `approve` 会把待确认知识提交为正式设定，并创建检查点。
- `reject` 会保留被打回的修订记录，并把待确认知识标记为 `rejected`。
- `revise` 会生成新的待审知识更新，状态回到 `awaiting_user_review`。

主要问题：

- `revise` 后没有新的质量报告，`continue` 仍显示旧的 `draft submit` 报告，见 P1-003。
- 旧验收中曾发现多个用户可见 CLI 标题品牌不一致，后续已纳入修复任务。
- `draft submit` 只有 P3 建议时仍显示 `Quality status: failed`，容易让用户误解为阻塞失败。

## Dashboard 验收

验收结果：**未通过完整验收**。

浏览器检查结果：

- 首页可打开：通过。
- 当前项目状态：通过，显示 `AWAITING_USER_REVIEW`、`chapter-0001`。
- 待审阅章节：通过，显示章节正文和待审输出路径。
- 生产进度：通过，显示 latest run 和 12 个 completed steps。
- 知识库浏览：通过，搜索 `白伞会` 能返回正式设定和待审内容。
- approve/reject 表单：基本通过；Approve 指向当前单元，Reject reason 为必填。
- 质量报告摘要：失败；页面显示 `No quality report available`，但项目存在 `reviews/run-2026-06-28T13-02-50.868Z-chapter-0001.md`。

## 示例项目验收

验收结果：**通过，适合作为产品级测试样例**。

`examples/superlong-webnovel` 当前停在 `awaiting_user_review`，符合设计中的用户验收关口。它包含：

- 项目企划和项目假设。
- 真实待审正文章节 `第 0001 章 镜城雨线`。
- 面向用户的质量报告。
- 待审知识更新。
- 正式设定背景知识。
- 可重建 SQLite 索引。
- `resume` / `continue --json` 可展示用户下一步。

## 文档与发布验收

验收结果：**基本通过**。

通过项：

- README、quickstart、daily usage 都明确：普通用户不应手动执行长命令链，AI agent 负责后台推进。
- `StoryMaker` 是用户可见产品名；文档统一说明实际包名、命令和运行目录。
- `@storyos/cli` 仍是当前 npm 包名，`@storymaker/cli` 未发布，文档表达清楚。
- docx/epub 占位产物限制在 README、CLI 提示和导出产物中都表达清楚。
- `package:binaries` 生成的不是原生二进制，平台启动器依赖 Node.js 24+，README 和 `bin/platform/README.md` 表达清楚。

不足：

- 旧验收中曾发现用户可见 CLI 品牌文案不一致。
- Dashboard 启动需要额外构建依赖，但 README/quickstart 没有给出 Dashboard 本地运行前置步骤。

## 问题分级

### P0

无。

### P1

1. **P1-001 Dashboard 源码路径默认启动失败**
   - 复现：`STORYOS_CWD=examples/superlong-webnovel corepack pnpm storymaker dashboard --once --port 0`
   - 结果：找不到 `packages\schemas\node_modules\@storyos\core\dist\index.js`。
   - 影响：用户按源码仓库说明直接运行 Dashboard 会失败。
   - 观察：手动构建 `@storyos/core`、`@storyos/schemas`、`@storyos/dashboard` 后 Dashboard 可启动。

2. **P1-002 Dashboard 质量报告摘要缺失**
   - 复现：启动 Dashboard 后打开 `http://127.0.0.1:4319/`。
   - 结果：Quality Report 区域显示 `No quality report available`。
   - 预期：应读取并展示 `reviews/run-2026-06-28T13-02-50.868Z-chapter-0001.md` 的摘要。
   - 影响：Dashboard 不满足“用户只查看正文和质量报告”的核心体验。

3. **P1-003 revise 后质量报告过期**
   - 复现：临时项目中 `draft submit chapter-0002` -> `reject` -> `revise --mode add_hook` -> `continue`。
   - 结果：`revise` 生成新的待审输出和待确认知识，但没有生成新的质量报告；`continue` 仍指向打回前的旧报告。
   - 影响：用户审阅修订稿时看到的是旧质量结论，可能误导通过/打回判断。

### P2

1. **P2-001 `continue` 仍是 agent 协议入口，不是完整本地自动编排器**
   - CLI 在 ready/idle 状态给出工作包流程指导；真正写稿依赖 Codex 或 Claude agent 执行适配器规则。
   - 建议补一个端到端 agent 冒烟测试或演示框架，证明“用户说继续”可以自动产出正文和报告。

2. **P2-002 P3 建议导致质量状态显示 failed**
   - `draft submit` 在最高等级仅 P3 且 `Blocks batch continue: no` 时仍显示 `Quality status: failed`。
   - 建议改为 `passed_with_notes` 或 `needs_attention`，减少用户误解。

3. **P2-003 CLI 用户可见品牌文案不一致**
   - `doctor/status/index/search/approve/reject/revise/export` 等标题需要统一为 StoryMaker。
   - 建议用户面输出统一为 StoryMaker，实际包名和运行目录按当前命令保持兼容。

### P3

1. **P3-001 部分 package 测试为 0 项**
   - `adapters-codex`、`adapters-claude`、`core` 目前测试输出为 0。
   - CLI 集成测试已覆盖部分行为，但包级测试仍可补强。

2. **P3-002 Dashboard 章节正文展示过长**
   - 首页一次性展开较长章节正文，质量报告和操作区需要滚动很久才到。
   - 建议加摘要/折叠/锚点导航。

## 建议新增下一轮任务清单

1. **TASK-FINAL-001 修复 Dashboard 源码启动链路**
   - 目标：`corepack pnpm storymaker dashboard --once --port 0` 在全新安装和类型检查后可直接运行，或文档明确必须先构建。
   - 验收：不手动补建 dist 也能启动，或 quickstart/README 给出可复制命令。

2. **TASK-FINAL-002 Dashboard 展示质量报告摘要**
   - 目标：读取 latest run `reportFile`，展示 Overall、Quality Gates、Pending Knowledge Summary 和 approval prompt。
   - 验收：`examples/superlong-webnovel` 页面不再显示 `No quality report available`。

3. **TASK-FINAL-003 revise 生成并绑定新质量报告**
   - 目标：`revise` 后重新运行质量门，生成修订报告，并让 `continue/resume/dashboard` 指向新报告。
   - 验收：reject -> revise -> continue 显示新的草稿路径和质量报告路径。

4. **TASK-FINAL-004 端到端 agent 日常流程冒烟测试**
   - 目标：模拟“用户：继续写下一章”，由测试 agent 读取工作包、写临时草稿、提交，并输出最终验收信息。
   - 验收：无需人工串命令即可得到待审章节、质量报告和待确认知识。

5. **TASK-FINAL-005 CLI 品牌与质量状态文案收敛**
   - 目标：用户面标题统一 StoryMaker；仅 P3 时输出 `passed_with_notes`。
   - 验收：help、doctor、status、approve/reject/revise/export 的用户输出符合 branding 文档。

6. **TASK-FINAL-006 Dashboard 可用性打磨**
   - 目标：章节正文折叠、质量报告摘要优先、操作区固定或锚点化。
   - 验收：用户首屏或短滚动内能看到状态、报告摘要和通过/打回操作。

## 最终建议

StoryMaker 当前适合进入**内部试用 / 受控陪跑试用**，尤其是 CLI + Codex/Claude agent 路径。它不建议直接进入开放真实用户试用，因为 Dashboard 和 revise 质量报告这两个 P1 会影响用户判断是否通过章节。

建议先完成 P1-001、P1-002、P1-003，再邀请 1-3 位真实作者按 `examples/superlong-webnovel` 模式试用。
