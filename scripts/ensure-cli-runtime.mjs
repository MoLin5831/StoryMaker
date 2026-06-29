import { access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildCliRuntime } from "./build-cli-runtime.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const requiredRuntimeFiles = [
  "packages/adapters-codex/dist/index.js",
  "packages/adapters-claude/dist/index.js",
  "packages/exporters/dist/index.js",
  "packages/indexer/dist/index.js",
  "packages/knowledge/dist/index.js",
  "packages/prompts/dist/index.js",
  "packages/quality-gates/dist/index.js",
  "packages/workflow-engine/dist/index.js",
  "packages/workflow-engine/dist/work-unit.js"
];

const fileExists = async (relativePath) => {
  try {
    await access(join(rootDir, relativePath));
    return true;
  } catch {
    return false;
  }
};

const missingRuntimeFiles = [];

for (const relativePath of requiredRuntimeFiles) {
  if (!(await fileExists(relativePath))) {
    missingRuntimeFiles.push(relativePath);
  }
}

if (missingRuntimeFiles.length > 0) {
  console.error(
    `Preparing StoryMaker CLI runtime (${missingRuntimeFiles.length} build artifact(s) missing)...`
  );
  buildCliRuntime();
}
