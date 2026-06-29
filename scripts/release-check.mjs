import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
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

const assertFileContains = async (relativePath, expected) => {
  const contents = await readFile(join(rootDir, relativePath), "utf8");

  if (!contents.includes(expected)) {
    throw new Error(`Expected ${relativePath} to contain ${expected}`);
  }
};

const assertCliVersionConsistency = async () => {
  const packageJson = JSON.parse(await readFile(join(rootDir, "packages/cli/package.json"), "utf8"));
  const metadata = await readFile(join(rootDir, "packages/cli/src/cli-metadata.ts"), "utf8");
  const versionMatch = metadata.match(/export const VERSION = "([^"]+)";/);

  if (!versionMatch) {
    throw new Error("Could not find CLI VERSION in packages/cli/src/cli-metadata.ts");
  }

  if (packageJson.version !== versionMatch[1]) {
    throw new Error(
      `CLI version mismatch: package.json has ${packageJson.version}, cli-metadata.ts has ${versionMatch[1]}`
    );
  }
};

const runNodeLauncher = (relativePath) => {
  run(process.execPath, [join(rootDir, relativePath), "--version"]);
};

await assertCliVersionConsistency();

run("git", ["diff", "--check"]);
run("corepack", ["pnpm", "lint"]);
run("corepack", ["pnpm", "build"]);
run("corepack", ["pnpm", "test"]);
run("corepack", ["pnpm", "verify:clean-source"]);
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
  await assertFileContains("bin/platform/storyctl.exe", 'STORYOS_PACKAGED_PLATFORM = "windows"');
}

console.log("StoryMaker release readiness check passed.");
