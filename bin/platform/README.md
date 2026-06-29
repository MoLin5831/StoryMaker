# StoryMaker 平台启动器

由 `corepack pnpm package:binaries` 生成。该命令写入的是依赖 Node.js 的启动器，不是原生单文件二进制。

产物：

- `storyctl.exe`
- `storyctl-macos`
- `storyctl-linux`

这些文件保留 `storyctl` 文件名，用于兼容已有自动化。它们不内置 Node.js，也不包含 CLI 源码。运行时要求系统 `PATH` 中存在 Node.js 24 或更新版本，并执行 `packages/cli/dist/index.js`。

生成的 `storyctl.exe`、`storyctl-macos`、`storyctl-linux` 不进入源码仓库；发布或本地验证时重新运行生成命令即可。

Unix 启动器由生成脚本以可执行权限写入；如果通过压缩包或非 Git 渠道复制后权限丢失，请重新运行 `corepack pnpm package:binaries`。
