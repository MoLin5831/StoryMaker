import { spawnSync } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliDir = join(rootDir, "packages", "cli");

const run = (command, args, options = {}) => {
  const executable = process.platform === "win32" ? "cmd.exe" : command;
  const executableArgs = process.platform === "win32" ? ["/d", "/s", "/c", command, ...args] : args;
  const result = spawnSync(executable, executableArgs, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: "pipe",
    ...options
  });

  if (result.status !== 0 || result.error !== undefined) {
    throw new Error(
      `Command failed: ${command} ${args.join(" ")}${
        result.error ? `\n${result.error.message}` : ""
      }\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
    );
  }

  return result;
};

const assertFileExists = async (path) => {
  try {
    await access(path);
  } catch {
    throw new Error(`Expected file to exist: ${path}`);
  }
};

const tempDir = await mkdtemp(join(tmpdir(), "storymaker-cli-package-"));
const cliSmokeEnv = {
  ...process.env
};

delete cliSmokeEnv.INIT_CWD;
delete cliSmokeEnv.STORYOS_CWD;

try {
  run("corepack", ["pnpm", "--filter", "storymaker", "build"]);

  const pack = run("npm", ["pack", "--pack-destination", tempDir], {
    cwd: cliDir
  });
  const tarballName = pack.stdout
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);

  if (tarballName === undefined) {
    throw new Error("npm pack did not report a tarball name.");
  }

  const tarballPath = join(tempDir, basename(tarballName));
  const projectDir = join(tempDir, "project");

  await assertFileExists(tarballPath);
  run("npm", ["init", "-y"], {
    cwd: tempDir
  });
  run("npm", ["install", tarballPath], {
    cwd: tempDir
  });

  const installedPackageDir = join(tempDir, "node_modules", "storymaker");
  const installedCli = join(installedPackageDir, "dist", "index.js");

  await assertFileExists(installedCli);
  await assertFileExists(join(installedPackageDir, "dist", "templates", "base", "project.yaml"));
  await assertFileExists(join(installedPackageDir, "dist", "dashboard", "index.js"));

  const declarationText = await readFile(
    join(installedPackageDir, "dist", "index.d.ts"),
    "utf8"
  );

  if (declarationText.includes("../../") || declarationText.includes("@storyos/")) {
    throw new Error("Published CLI declarations must not reference private workspace packages.");
  }

  const packageJson = JSON.parse(
    await readFile(join(installedPackageDir, "package.json"), "utf8")
  );

  for (const dependencyName of Object.keys(packageJson.dependencies ?? {})) {
    if (dependencyName.startsWith("@storyos/")) {
      throw new Error(`Published CLI package must not depend on private package ${dependencyName}.`);
    }
  }

  run(process.execPath, [installedCli, "--help"], {
    cwd: tempDir,
    env: cliSmokeEnv
  });

  await mkdir(projectDir, {
    recursive: true
  });

  run(process.execPath, [installedCli, "init", "--type", "superlong_webnovel", "--profile", "production"], {
    cwd: projectDir,
    env: cliSmokeEnv
  });
  run(process.execPath, [installedCli, "status"], {
    cwd: projectDir,
    env: cliSmokeEnv
  });
  run(process.execPath, [installedCli, "dashboard", "--once", "--port", "0"], {
    cwd: projectDir,
    env: cliSmokeEnv
  });

  console.log("StoryMaker CLI package smoke test passed.");
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true
  });
}
