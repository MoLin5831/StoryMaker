# Node.js 版本要求

StoryMaker 当前要求 Node.js 24 或更新版本。

## 为什么不是 Node 20

索引模块使用 Node 内置的 `node:sqlite`，用于本地 Markdown 索引、搜索和上下文召回。这个能力让 StoryMaker 不必在首发阶段引入额外 SQLite 原生依赖，但也意味着运行环境必须是支持 `node:sqlite` 的 Node 版本。

在不替换索引存储实现的情况下，把 `engines.node` 降到 Node 20 会让安装看似成功、运行时却失败。因此当前选择是明确要求 Node 24，并把安装引导做清楚。

## 如何降低试用成本

仓库提供以下版本声明：

- `.nvmrc`
- `.node-version`
- `package.json` 中的 `volta`

常见用法：

```bash
corepack enable
nvm use
corepack pnpm install
```

或使用 Volta：

```bash
volta install node@24.18.0 pnpm@10.17.1
corepack pnpm install
```

## 未来降级路线

如果要支持 Node 20，需要新增独立任务替换 `node:sqlite` 依赖，例如改用可发布、可安装、跨平台稳定的 SQLite 依赖或可选索引后端。这个改动会影响索引、搜索、安装包体积和发布验证，不应作为文档改动顺手完成。
