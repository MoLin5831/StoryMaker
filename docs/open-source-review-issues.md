# StoryMaker 陌生开源项目审查问题清单

日期：2026-06-29

审查视角：把当前仓库当作一个第一次接触的开源项目，从安装、运行、发布、维护、安全和贡献体验角度进行客观评估。

总体结论：核心测试、安全扫描和类型检查目前可以通过。首轮审查发现的阻塞项集中在 npm 安装、fresh clone 源码运行、发布包运行时资产和许可证。本轮已针对这些问题完成修复，并把关键路径固化为可重复验证命令。

## 本轮修复状态

| ID | 状态 | 修复摘要 |
| --- | --- | --- |
| ISSUE-001 | 已修复 | CLI 发布包改为自包含构建，安装包不再依赖私有 workspace 包，并新增真实 tarball 安装 smoke。 |
| ISSUE-002 | 已修复 | 源码仓库 `storymaker/storyctl` 脚本会自动补齐缺失 runtime 构建产物，CI 增加源码 CLI smoke。 |
| ISSUE-003 | 已修复 | CLI package 的 `dist/` 内包含模板和 Dashboard 运行时资产，package smoke 会验证这些文件存在。 |
| ISSUE-004 | 已修复 | 新增 MIT License，并更新 package metadata。 |
| ISSUE-005 | 已修复 | 发布文档改为使用真实 `corepack pnpm package:cli-smoke`，不再依赖 `npm pack --dry-run` 后的不存在 tarball。 |
| ISSUE-006 | 部分缓解 | 未做大规模 CLI 拆分，以免混入高风险结构调整；运行时资产路径逻辑已从 CLI 主入口抽出并增加测试。 |
| ISSUE-007 | 已修复 | platform launcher 改为生成产物并加入忽略，CI 和 `release:check` 会生成并验证启动器。 |
| ISSUE-008 | 已修复 | 用户可见 CLI、Dashboard、MCP 和适配器文案统一使用 StoryMaker；兼容接口名保持不变。 |

## 已执行验证

| 验证项 | 结果 | 说明 |
| --- | --- | --- |
| `corepack pnpm lint` | 通过 | 代码风格检查通过 |
| `corepack pnpm -r typecheck` | 通过 | 全仓类型检查通过 |
| `corepack pnpm test` | 通过 | 自动化测试通过 |
| `corepack pnpm security:audit` | 通过 | 未发现高危已知依赖漏洞 |
| `corepack pnpm scan:secrets` | 通过 | 未发现明显密钥泄露 |
| `corepack pnpm --filter @storyos/cli build` | 通过 | CLI 可构建 |
| `npm pack --dry-run` | 通过但有风险 | 打包内容只有 CLI dist 和 package.json |
| 本地 tarball 安装烟测 | 失败 | 安装时无法解析私有内部包 |
| fresh clone 后直接运行 `storymaker --help` | 失败 | 缺少各 workspace 包的 `dist/` 产物 |

## 问题总览

| ID | 严重级别 | 问题 | 建议优先级 |
| --- | --- | --- | --- |
| ISSUE-001 | High | npm 发布包无法被真实用户安装 | P0 |
| ISSUE-002 | High | fresh clone 后源码 CLI 直接运行失败 | P0 |
| ISSUE-003 | High | CLI 发布包缺少模板和 Dashboard 运行时资产 | P0 |
| ISSUE-004 | Medium | 缺少开源许可证 | P1 |
| ISSUE-005 | Medium | 发布文档中的本地验证命令不可靠 | P1 |
| ISSUE-006 | Medium | CLI 主入口过大，长期维护风险高 | P2 |
| ISSUE-007 | Low | 平台 launcher 的提交策略和可执行权限不清晰 | P2 |
| ISSUE-008 | Low | 用户可见文案仍有 旧品牌名遗留 | P3 |

## ISSUE-001：npm 发布包无法被真实用户安装

严重级别：High

影响：如果用户通过 npm tarball 或未来 npm registry 安装 CLI，安装会失败，项目无法作为正常 npm CLI 分发。

证据：

- `packages/cli/package.json` 将 CLI 标记为可发布包。
- 同一个 `package.json` 依赖多个内部 workspace 包，例如 `@storyos/core`、`@storyos/adapters-codex`、`@storyos/adapters-claude` 等，版本为 `0.0.0`。
- 这些内部包目前是 `private: true`，不会发布到 npm registry。
- 本地真实安装 tarball 时出现 `404 Not Found - GET https://registry.npmjs.org/@storyos%2fadapters-claude`。

建议修复：

1. 明确发布策略：发布所有运行时 workspace 包，或把 CLI 打包成单一自包含包。
2. 在 CI 中增加 tarball 安装烟测：`npm pack` 后进入临时目录执行 `npm install <tgz>`，再运行 `storymaker --help`。
3. 发布前不要只依赖 `npm pack --dry-run`，因为 dry-run 不能验证真实安装链路。

## ISSUE-002：fresh clone 后源码 CLI 直接运行失败

严重级别：High

影响：贡献者按 README 克隆仓库并安装依赖后，直接运行 `corepack pnpm storymaker --help` 会失败，降低首次贡献和试用体验。

证据：

- `packages/cli/src/index.ts` 从多个 workspace 包的 `dist/index.js` 导入运行时代码。
- `dist/` 目录是构建产物，不会出现在 fresh clone 中。
- README 当前展示了源码仓库内直接运行 `corepack pnpm storymaker --help` 的路径。
- 使用 `git archive` 模拟 clean checkout 后运行 `corepack pnpm storymaker --help`，失败原因为缺少 `packages/adapters-codex/dist/index.js`。

建议修复：

1. 让源码开发模式使用 workspace package exports、源码入口或 TypeScript loader，而不是直接指向 `dist/`。
2. 如果必须先构建，则在 README 和 quickstart 中明确要求先运行 `corepack pnpm -r build` 或更小范围的准备命令。
3. 在 CI 中增加 fresh clone smoke test，覆盖 `install -> storymaker --help`。

## ISSUE-003：CLI 发布包缺少模板和 Dashboard 运行时资产

严重级别：High

影响：即使依赖安装问题解决，真实安装后的 CLI 仍可能无法执行 `init` 或 `dashboard` 等核心命令。

证据：

- `packages/cli/package.json` 的 `files` 只包含 `dist` 和 `package.json`。
- `initializeProject` 会通过相对路径查找 `templates/base`。
- Dashboard 启动链路依赖仓库内 `apps/dashboard/dist/index.js`。
- `npm pack --dry-run` 显示 tarball 只有 CLI 的 dist 类型文件、运行文件和 package.json，没有模板、Dashboard 产物或相关资产。

建议修复：

1. 将模板文件和 Dashboard 运行时资产复制进 CLI 发布包，或拆分为明确的 runtime package。
2. 增加发布包内容检查，验证 tarball 中包含 `templates`、Dashboard 入口和必要静态资产。
3. 增加安装后 smoke test：`storymaker init`、`storymaker status`、`storymaker dashboard --once --port 0`。

## ISSUE-004：缺少开源许可证

严重级别：Medium

影响：仓库公开后，如果没有许可证，外部用户无法明确复制、修改、分发或贡献代码的法律边界。

证据：

- 仓库根目录未发现 `LICENSE`、`LICENSE.md` 或 `COPYING`。
- `packages/cli/package.json` 中许可证字段仍为 `UNLICENSED`。

建议修复：

1. 选择并添加明确许可证，例如 MIT、Apache-2.0 或其他符合目标的许可证。
2. 更新所有将来会发布的 package metadata。
3. 在 README 中加入许可证说明。

## ISSUE-005：发布文档中的本地验证命令不可靠

严重级别：Medium

影响：维护者可能误以为已经验证了发布包，但实际没有生成 tarball，也没有验证真实安装。

证据：

- README 中的发布前检查使用 `npm pack --dry-run` 后继续运行本地 tarball。
- `npm pack --dry-run` 不会生成可供下一步安装或运行的 tarball。
- `docs/publishing.md` 也偏向 dry-run 检查，缺少真实安装验证。

建议修复：

1. 将发布前验证改为：
   - `npm pack --pack-destination <tmp>`
   - 在全新临时目录中执行 `npm install <tgz>`
   - 运行 `storymaker --help`、`storymaker init`、`storymaker status`
2. 将该流程加入 CI 或 release checklist。

## ISSUE-006：CLI 主入口过大，长期维护风险高

严重级别：Medium

影响：当前 CLI 入口承担过多职责，后续继续增加命令、工作流和 Dashboard 集成时，回归风险和理解成本会快速上升。

证据：

- `packages/cli/src/index.ts` 约 6000 行以上。
- `packages/cli/src/index.test.ts` 约 3800 行以上。
- 同一文件混合了参数解析、命令分发、项目初始化、workflow、导出、适配器调用、Dashboard 启动和输出格式化等职责。

建议修复：

1. 按命令拆分到 `commands/*`。
2. 将项目路径解析、输出格式化、workflow orchestration、Dashboard launcher 等提取为独立模块。
3. 先做无行为变化的结构性拆分，并保留现有测试作为回归保护。

## ISSUE-007：平台 launcher 的提交策略和可执行权限不清晰

严重级别：Low

影响：Unix 用户直接运行 launcher 可能失败；开源审查者也可能质疑仓库中提交生成二进制的必要性和来源。

证据：

- `bin/platform/storyctl-linux` 和 `bin/platform/storyctl-macos` 在 Git 中是普通文件权限，不是可执行权限。
- `bin/platform/storyctl.exe` 是已提交的生成二进制。
- 文档说明它们不是 native binary，但缺少更完整的生成和验证说明。

建议修复：

1. 如果保留 launcher，给 Unix launcher 设置可执行权限并在 CI 中验证。
2. 如果不希望提交生成产物，则改为 release workflow 生成。
3. 为 Windows launcher 增加来源、生成命令和校验说明。

## ISSUE-008：用户可见文案仍有 旧品牌名遗留

严重级别：Low

影响：品牌已统一为 StoryMaker 后，用户可见位置仍出现旧名会造成认知混乱，尤其是在 README 已经尽量避免旧名的情况下。

证据：

- `packages/cli/package.json` 的描述仍包含 `旧品牌 CLI 描述`。
- `packages/cli/src/index.ts` 中仍有 `Initialized <旧品牌> project`、`<旧品牌>-managed template files`、`Not a <旧品牌> project` 等用户可见文案。

说明：

- `.storyos`、`STORYOS_CWD`、`@storyos/cli`、`storyctl` 等属于内部兼容命名，不建议贸然修改。
- 本问题只针对用户可见标题、help、错误提示和文档中的品牌表达。

建议修复：

1. 将用户可见文案统一为 StoryMaker。
2. 对兼容命名保留一段简短解释，避免用户误以为项目仍叫 旧品牌。

## 建议修复顺序

1. 修复 ISSUE-001、ISSUE-002、ISSUE-003，确保真实用户可以安装、运行和使用核心命令。
2. 修复 ISSUE-004、ISSUE-005，补齐开源发布和维护者验证底线。
3. 处理 ISSUE-007、ISSUE-008，降低公开仓库的信任和品牌摩擦。
4. 将 ISSUE-006 拆成独立的重构任务，避免在发布阻塞修复中混入大规模结构调整。

## 可作为下一轮任务的拆分

| 任务 ID | 目标 | 依赖 |
| --- | --- | --- |
| TASK-OSS-001 | 修复 npm 包真实安装链路 | 无 |
| TASK-OSS-002 | 修复 fresh clone 源码 CLI 运行链路 | 无 |
| TASK-OSS-003 | 补齐 CLI 发布包运行时资产 | TASK-OSS-001 |
| TASK-OSS-004 | 增加开源许可证和 package metadata | 无 |
| TASK-OSS-005 | 修正发布文档和 tarball install smoke | TASK-OSS-001, TASK-OSS-003 |
| TASK-OSS-006 | 统一剩余用户可见品牌文案 | 无 |
| TASK-OSS-007 | 明确平台 launcher 策略和权限 | 无 |
| TASK-OSS-008 | 拆分 CLI 主入口的无行为变化重构 | TASK-OSS-001, TASK-OSS-002, TASK-OSS-003 |

## 暂不作为问题处理

- 内部兼容命名 `.storyos`、`STORYOS_CWD`、`@storyos/cli` 和 `storyctl` 可以继续存在。
- 依赖扫描和密钥扫描当前没有发现需要立刻阻塞推送的高危问题。
- 现有单元测试、类型检查和 lint 可以通过，说明主要风险集中在安装、分发和首次使用链路，而不是当前测试覆盖内的核心逻辑。
