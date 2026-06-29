import { spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const run = (command, args, options = {}) => {
  const executable = process.platform === "win32" ? "cmd.exe" : command;
  const executableArgs = process.platform === "win32" ? ["/d", "/s", "/c", command, ...args] : args;
  const result = spawnSync(executable, executableArgs, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: "inherit",
    ...options
  });

  if (result.status !== 0 || result.error !== undefined) {
    const errorMessage = result.error ? `\n${result.error.message}` : "";

    throw new Error(`Command failed: ${command} ${args.join(" ")}${errorMessage}`);
  }
};

const assertFileExists = async (relativePath) => {
  await access(join(rootDir, relativePath));
};

const runNodeLauncher = (relativePath) => {
  run(process.execPath, [join(rootDir, relativePath), "--version"]);
};

run("git", ["diff", "--check"]);
run("corepack", ["pnpm", "lint"]);
run("corepack", ["pnpm", "-r", "typecheck"]);
run("corepack", ["pnpm", "test"]);
run("corepack", ["pnpm", "build:dashboard"]);
run("corepack", ["pnpm", "package:cli-smoke"]);
run("corepack", ["pnpm", "scan:secrets"]);
run("corepack", ["pnpm", "security:audit"]);
run("corepack", ["pnpm", "package:binaries"]);

await assertFileExists("bin/platform/storyctl-linux");
await assertFileExists("bin/platform/storyctl-macos");
await assertFileExists("bin/platform/storyctl.exe");

runNodeLauncher("bin/platform/storyctl-linux");
runNodeLauncher("bin/platform/storyctl-macos");

if (process.platform === "win32") {
  run(join(rootDir, "bin", "platform", "storyctl.exe"), ["--version"], {
    cwd: rootDir
  });
} else {
  runNodeLauncher("bin/platform/storyctl.exe");
}

console.log("StoryMaker release readiness check passed.");
