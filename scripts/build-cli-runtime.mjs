import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const cliRuntimePackages = [
  "@storyos/core",
  "@storyos/schemas",
  "@storyos/workflow-engine",
  "@storyos/knowledge",
  "@storyos/indexer",
  "@storyos/adapters-codex",
  "@storyos/adapters-claude",
  "@storyos/exporters",
  "@storyos/prompts",
  "@storyos/quality-gates"
];

const run = (command, args) => {
  const executable = process.platform === "win32" ? "cmd.exe" : command;
  const executableArgs = process.platform === "win32" ? ["/d", "/s", "/c", command, ...args] : args;
  const result = spawnSync(executable, executableArgs, {
    encoding: "utf8",
    stdio: "inherit"
  });

  if (result.status !== 0 || result.error !== undefined) {
    const errorMessage = result.error ? `\n${result.error.message}` : "";

    throw new Error(`Command failed: ${command} ${args.join(" ")}${errorMessage}`);
  }
};

export const buildCliRuntime = () => {
  for (const packageName of cliRuntimePackages) {
    run("corepack", ["pnpm", "--filter", packageName, "build"]);
  }
};

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildCliRuntime();
}
