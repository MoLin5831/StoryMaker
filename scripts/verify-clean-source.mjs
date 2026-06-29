import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
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

const listSourceFiles = () => {
  const result = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: rootDir,
    encoding: "buffer",
    stdio: ["ignore", "pipe", "inherit"]
  });

  if (result.status !== 0 || result.error !== undefined) {
    const errorMessage = result.error ? `\n${result.error.message}` : "";

    throw new Error(`Command failed: git ls-files${errorMessage}`);
  }

  return result.stdout
    .toString("utf8")
    .split("\0")
    .filter((file) => file.length > 0);
};

const copySourceFiles = async (destinationDir) => {
  for (const relativePath of listSourceFiles()) {
    const sourcePath = join(rootDir, relativePath);
    const destinationPath = join(destinationDir, relativePath);

    await mkdir(dirname(destinationPath), {
      recursive: true
    });
    await cp(sourcePath, destinationPath);
  }
};

const tempBaseDir =
  process.platform === "win32" && process.env.LOCALAPPDATA
    ? join(process.env.LOCALAPPDATA, "Temp")
    : tmpdir();
const tempDir = await realpath(await mkdtemp(join(tempBaseDir, "storymaker-clean-source-")));
const keepTemp = process.env.STORYMAKER_KEEP_CLEAN_SOURCE === "1";
let commandError = null;

try {
  await copySourceFiles(tempDir);

  run("corepack", ["pnpm", "install", "--frozen-lockfile"], {
    cwd: tempDir
  });
  run("corepack", ["pnpm", "test"], {
    cwd: tempDir
  });
  run("corepack", ["pnpm", "build"], {
    cwd: tempDir
  });

  console.log(`StoryMaker clean source verification passed in ${tempDir}`);
} catch (error) {
  commandError = error;
} finally {
  if (keepTemp) {
    console.log(`Keeping clean source verification directory: ${tempDir}`);
  } else {
    try {
      await rm(tempDir, {
        force: true,
        maxRetries: 5,
        recursive: true,
        retryDelay: 250
      });
    } catch (error) {
      console.warn(`Warning: failed to remove clean source verification directory: ${tempDir}`);
      console.warn(error instanceof Error ? error.message : String(error));
    }
  }
}

if (commandError) {
  throw commandError;
}
