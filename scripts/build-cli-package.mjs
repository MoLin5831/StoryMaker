import { chmod, cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

import { buildCliRuntime } from "./build-cli-runtime.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliDir = join(rootDir, "packages", "cli");
const distDir = join(cliDir, "dist");

await rm(distDir, {
  force: true,
  recursive: true
});
await mkdir(distDir, {
  recursive: true
});

buildCliRuntime();

await build({
  banner: {
    js: "#!/usr/bin/env node"
  },
  bundle: true,
  entryPoints: [join(cliDir, "src", "index.ts")],
  format: "esm",
  legalComments: "eof",
  outfile: join(distDir, "index.js"),
  platform: "node",
  target: "node24"
});
await chmod(join(distDir, "index.js"), 0o755);

await build({
  bundle: true,
  entryPoints: [join(rootDir, "apps", "dashboard", "src", "index.ts")],
  format: "esm",
  legalComments: "eof",
  outfile: join(distDir, "dashboard", "index.js"),
  platform: "node",
  target: "node24"
});

await cp(join(rootDir, "templates", "base"), join(distDir, "templates", "base"), {
  recursive: true
});

await writeFile(
  join(distDir, "index.d.ts"),
  `export declare const VERSION: string;
export declare const HELP_TEXT: string;

export type StoryctlIO = {
  stdout: {
    write(chunk: string): unknown;
  };
  stderr: {
    write(chunk: string): unknown;
  };
};

export type StoryctlRunOptions = {
  cwd?: string;
  now?: string;
};

export declare const runStoryctl: (
  argv: readonly string[],
  io?: StoryctlIO,
  options?: StoryctlRunOptions
) => Promise<number>;

export declare const main: (argv?: readonly string[]) => Promise<void>;
`,
  "utf8"
);
