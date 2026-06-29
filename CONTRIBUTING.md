# 贡献指南

感谢你愿意参与 StoryMaker。这个项目仍处在早期阶段，最有价值的贡献通常是：复现实用问题、补充测试、改进文档、收敛 CLI 与 Dashboard 的体验。

## 开发环境

请使用 Node.js 24 或更新版本。当前索引模块依赖 Node 内置的 `node:sqlite`，因此暂时不能降到 Node 20。

```bash
corepack enable
corepack pnpm install
corepack pnpm -r typecheck
corepack pnpm test
```

如果你修改了 Dashboard 或 CLI 打包链路，请额外运行：

```bash
corepack pnpm build:dashboard
corepack pnpm package:cli-smoke
```

## 提交代码前

1. 先确认变更范围足够小，避免把无关重构和功能改动混在一起。
2. 为行为变化补充测试；文档或脚本类改动至少要有可复现的验证命令。
3. 运行与改动相关的检查。准备发布前运行 `corepack pnpm release:check`。
4. 不要提交 `.dev/`、产品级示例、生成的启动器、`dist/`、`node_modules/` 或本地数据库。

## Issue 与 Pull Request

提交 bug 时请包含：

- StoryMaker 版本或 commit。
- Node.js 与 pnpm 版本。
- 操作系统。
- 复现步骤和实际输出。
- 你期望看到的结果。

提交 PR 时请说明：

- 改了什么。
- 为什么需要这样改。
- 跑过哪些验证命令。
- 是否影响 CLI、Dashboard、导出、索引或发布流程。

## 命名约定

用户可见产品名使用 `StoryMaker`，npm 包路线使用 `storymaker`，推荐命令也是 `storymaker`。`storyctl`、`.storyos/`、`STORYOS_CWD` 保留为兼容接口，请不要在没有迁移方案的情况下移除。
