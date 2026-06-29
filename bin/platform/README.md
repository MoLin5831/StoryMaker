# StoryMaker 平台启动器

由 `corepack pnpm package:binaries` 生成。该命令写入的是依赖 Node.js 的启动器，不是原生单文件二进制。

产物：

- `storyctl.exe`
- `storyctl-macos`
- `storyctl-linux`

这些文件保留 `storyctl` 文件名，用于兼容已有自动化。它们不内置 Node.js，也不包含 CLI 源码。运行时要求系统 `PATH` 中存在 Node.js 24 或更新版本，并执行 `packages/cli/dist/index.js`。
