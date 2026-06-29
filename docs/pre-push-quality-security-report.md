# StoryMaker 推送前代码质量与安全审查报告

日期：2026-06-29
项目：StoryMaker
目标仓库：`https://github.com/MoLin5831/StoryMaker.git`

## 总体结论

结论：建议推送，有少量非阻塞剩余风险。

本轮修复了一个发布入口阻塞问题、一个 Dashboard 本地操作安全问题，并补齐了推送到 GitHub 前最基础的 CI、依赖审计和密钥扫描防线。当前 lint、类型检查、测试、构建、依赖审计、密钥扫描、示例项目基础冒烟检查、Windows 启动器冒烟检查均通过。

## 使用的 Skills

- `code-review-and-quality`：识别架构、入口、脚本、测试面和可维护性问题。
- `code-simplification`：在不改变行为的前提下收敛 lint 失败和可读性问题。
- `find-bugs`：用命令和静态检索定位真实发布入口 bug。
- `security-review`：按输入校验、XSS、CSRF、路径处理、命令执行、数据保护和供应链做审查。
- `dependency-scanning`：检查 pnpm lockfile、audit、许可证和依赖风险。
- `secrets-management`：检查 `.env`、token、私钥和高置信密钥模式。
- `gha-security-review`：审查 GitHub Actions 触发器、权限、secrets 和 action pinning。
- `pipeline-security`：审查 CI/CD 最小权限、锁文件安装和供应链控制。
- `test-driven-development`：先写 Dashboard CSRF 回归测试并确认失败，再实现修复。
- `ci-cd-and-automation`：新增可重复 CI 质量门和 Dependabot。
- `shipping-and-launch`：补做 launcher、示例项目和发布前 smoke。

## 项目识别

- 技术栈：TypeScript、Node.js、pnpm workspace、Biome、tsc、node:test、tsx。
- 运行要求：`package.json` 声明 Node.js `>=24.0.0`，pnpm `10.17.1`。
- Monorepo 结构：`packages/*` 和 `apps/dashboard`。
- 主要入口：
  - CLI 源码：`packages/cli/src/index.ts`
  - Dashboard 源码：`apps/dashboard/src/index.ts`
  - 兼容 bin：`bin/storymaker`、`bin/storyctl`
  - 平台 launcher：`bin/platform/storyctl.exe`、`storyctl-macos`、`storyctl-linux`
- 关键脚本：
  - `corepack pnpm lint`
  - `corepack pnpm -r typecheck`
  - `corepack pnpm test`
  - `corepack pnpm build:dashboard`
  - `corepack pnpm package:binaries`
  - `corepack pnpm scan:secrets`
  - `corepack pnpm security:audit`
- CI：本轮新增 `.github/workflows/ci.yml` 和 `.github/dependabot.yml`。

## Git 状态限制

`git status --short` 返回 `fatal: not a git repository`。因此本轮无法使用 git diff 区分已有改动和本轮改动，也无法扫描 git 历史中的旧密钥。报告中的修改清单基于本轮实际编辑和生成文件记录。

推送前需要先确认当前目录是否应初始化为 Git 仓库，或是否应放入已有仓库工作树。

## 已修复问题

### High：Windows 平台 launcher 无法启动 CLI

现象：`bin\platform\storyctl.exe --version` 失败，Node 试图加载带引号的路径：

`<本地项目路径>\"<本地项目路径>\packages\cli\dist\index.js"`

根因：`scripts/package-binaries.mjs` 生成的 C# `Quote()` 输出了反斜杠加引号，导致 Node 收到错误的入口路径。

修复：

- 重写 Windows launcher 参数 quoting 逻辑。
- 重新生成 `bin/platform/storyctl.exe`。
- 验证 `bin\platform\storyctl.exe --version` 和 `--help` 均通过。

### Medium：Dashboard approve/reject POST 缺少 CSRF 防护

风险：Dashboard 绑定本机地址，但打开期间其他网页仍可能尝试向本机端口发起表单 POST，误触发 approve/reject。

修复：

- Dashboard 启动时生成进程级 CSRF token。
- approve/reject 表单带隐藏 token。
- POST `/actions/approve` 和 `/actions/reject` 校验 token，失败返回 403。
- 增加回归测试覆盖缺失 token 时 runner 不会被调用。

### Medium：缺少 GitHub 推送后的基础质量门

修复：

- 新增 `.github/workflows/ci.yml`。
- 使用 `permissions: contents: read`。
- 仅使用 `pull_request`、`push`、`workflow_dispatch`，未使用 `pull_request_target`。
- 官方 actions 固定到 commit SHA。
- CI 覆盖安装、密钥扫描、lint、类型检查、测试、构建和高危依赖审计。

### Medium：缺少自动化密钥扫描

修复：

- 新增 `scripts/scan-secrets.mjs`。
- 新增 `corepack pnpm scan:secrets`。
- CI 中加入 secret scan。
- `.gitignore` 增加 `.env`、`.env.*`，保留 `!.env.example`。

### Low：Lint 可维护性问题

修复：

- 移除无用字符串转义和未使用 import。
- 将 assignment-in-expression 循环改为显式循环。
- 将控制字符正则改为更可读的字符检测 helper。
- 保持原有行为不变。

## 主要修改文件

- `.github/workflows/ci.yml`
- `.github/dependabot.yml`
- `.gitignore`
- `package.json`
- `scripts/scan-secrets.mjs`
- `scripts/package-binaries.mjs`
- `bin/platform/storyctl.exe`
- `bin/platform/storyctl-linux`
- `bin/platform/storyctl-macos`
- `bin/platform/README.md`
- `apps/dashboard/src/index.ts`
- `apps/dashboard/src/index.test.mjs`
- `apps/dashboard/src/node-builtins.d.ts`
- `apps/dashboard/dist/*`
- `packages/cli/src/index.ts`
- `packages/cli/src/index.test.ts`
- `packages/mcp/src/index.ts`
- `packages/mcp/src/index.test.mjs`
- `packages/workflow-engine/src/index.ts`
- `packages/workflow-engine/src/work-unit.ts`
- `packages/quality-gates/src/index.ts`

`corepack pnpm build:dashboard` 也刷新了若干 `dist` 输出。

## 执行命令与结果

| 命令 | 结果 | 备注 |
|---|---:|---|
| `git status --short` | 失败 | 当前目录不是 Git 仓库 |
| `corepack pnpm install --frozen-lockfile --ignore-scripts` | 通过 | lockfile 一致 |
| `corepack pnpm lint` | 通过 | Biome lint 79 files |
| `corepack pnpm -r typecheck` | 通过 | 13 workspace projects |
| `corepack pnpm test` | 通过 | CLI 88/88，Dashboard 12/12，其他包通过 |
| `corepack pnpm build:dashboard` | 通过 | 所有依赖包和 Dashboard 构建通过 |
| `corepack pnpm package:binaries` | 通过 | 平台 launcher 重新生成 |
| `bin\platform\storyctl.exe --version` | 通过 | 输出 `0.0.0` |
| `bin\platform\storyctl.exe --help` | 通过 | Help 正常显示 |
| `corepack pnpm storymaker --help` | 通过 | StoryMaker help 正常 |
| `corepack pnpm storyctl --help` | 通过 | 兼容 alias 正常 |
| `corepack pnpm scan:secrets` | 通过 | 未发现高置信密钥 |
| `corepack pnpm security:audit` | 通过 | 无 high 及以上已知漏洞 |
| `corepack pnpm licenses list --json` | 通过 | 未发现 GPL/AGPL；存在 MPL-2.0 transitive `lightningcss` |
| `STORYOS_CWD=examples/superlong-webnovel corepack pnpm storymaker doctor` | 通过 | 示例项目健康 |
| `STORYOS_CWD=examples/superlong-webnovel corepack pnpm storymaker status` | 通过 | 能显示 pending review |
| `STORYOS_CWD=examples/superlong-webnovel corepack pnpm storymaker resume` | 通过 | 能显示 latest run report |
| `STORYOS_CWD=examples/superlong-webnovel corepack pnpm storymaker dashboard --once --port 0` | 通过 | one-shot URL 正常输出 |
| `corepack pnpm exec biome format .` | 未通过 | 发现约 50 个既有格式差异；未全仓格式化以避免大范围 churn |
| `corepack pnpm exec biome format --write <touched files>` | 通过 | 本轮触及文件已格式化 |

## 安全审查结果

### 输入与路径

- CLI 和 Dashboard 以本地文件系统项目为主，主要路径由项目根目录和已知运行目录派生。
- 本轮未发现明显任意远程 URL 读取、SSRF、反序列化或动态代码执行入口。
- `scripts/package-binaries.mjs` 使用 `spawnSync` 调用 PowerShell 编译 C# launcher，输入来自仓库内确定路径，并对单引号做转义。风险可接受。

### XSS

- Dashboard 渲染路径使用 `escapeHtml` 保护用户可见内容。
- 未发现 `innerHTML`、`dangerouslySetInnerHTML`、`eval` 或 `new Function`。

### CSRF

- 已为 Dashboard approve/reject POST 增加 token 校验。
- reject reason 仍保持 required 和服务端校验。

### 密钥

- 未发现 `.env*` 文件。
- `corepack pnpm scan:secrets` 未发现高置信密钥。
- 因当前目录不是 Git 仓库，未扫描历史提交。

### 依赖与供应链

- `corepack pnpm audit --audit-level high` 通过。
- lockfile 一致，`pnpm install --frozen-lockfile --ignore-scripts` 通过。
- 许可证未发现 GPL/AGPL 阻塞；`lightningcss` 为 MPL-2.0 transitive 依赖，通常可接受，但发布前可按你的许可证政策再次确认。

### GitHub Actions

- 未使用 `pull_request_target`。
- Workflow 权限为 `contents: read`。
- 官方 actions 使用 SHA pin。
- 未在 workflow 中读取或回显 secrets。
- 尚未配置 artifact signing、SBOM 或 SLSA provenance。

## 剩余风险

### Medium

- 当前目录不是 Git 仓库，无法做 git 历史密钥扫描，也无法用 diff 精准区分历史改动。首次推送前建议在初始化仓库后再运行一次 `git status` 和 secret scan。
- GitHub 仓库设置无法本地验证。推送后建议开启 branch protection、required CI checks、Dependabot alerts、secret scanning 和 private vulnerability reporting。

### Low

- 全仓 `biome format .` 仍会报告既有格式差异。本轮没有进行全仓格式化，避免在推送前制造大量无关 churn。
- 当前 CI 未生成 SBOM、未做 provenance attestation，也未做 release artifact signing。对早期项目不阻塞，但正式发布 npm 或二进制包前建议补齐。
- `.dev/` 接力开发记录是否推送到公开 GitHub 需要产品侧决定。它不是密钥风险，但可能包含内部开发过程噪音。

## 最终建议

建议可以进入 GitHub 首次推送准备。推送前请先确认仓库初始化策略：

1. 如果当前 StoryMaker 工作区应直接成为仓库根目录，先执行 `git init`，添加 remote 到 `https://github.com/MoLin5831/StoryMaker.git`。
2. 运行 `git status --short` 复核将要提交的文件，尤其决定是否保留 `.dev/` 接力记录。
3. 首次 commit 前再跑一次 `corepack pnpm scan:secrets`。
4. 推送到 GitHub 后开启 branch protection 和 required CI checks。

当前没有发现 Critical 或 High 剩余阻塞问题。
