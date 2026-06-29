import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import {
  getDashboardModulePath,
  getFirstExistingRuntimePath,
  getRuntimePathCandidates,
  getTemplateRoot
} from "./runtime-assets.js";

const createModuleUrl = (root: string): string =>
  pathToFileURL(join(root, "packages", "cli", "dist", "index.js")).href;

test("runtime assets prefer package-local files when they exist", () => {
  const root = resolve("fixture-root");
  const moduleUrl = createModuleUrl(root);
  const candidates = getRuntimePathCandidates(join("templates", "base"), {
    moduleUrl
  });

  assert.equal(
    getTemplateRoot({
      exists: (path) => path === candidates[0],
      moduleUrl
    }),
    candidates[0]
  );
});

test("runtime assets fall back to source repository files", () => {
  const root = resolve("fixture-root");
  const moduleUrl = createModuleUrl(root);
  const candidates = getRuntimePathCandidates(join("templates", "base"), {
    moduleUrl
  });

  assert.equal(
    getFirstExistingRuntimePath(join("templates", "base"), {
      exists: (path) => path === candidates[1],
      moduleUrl
    }),
    candidates[1]
  );
});

test("dashboard module path supports packaged and source repository layouts", () => {
  const root = resolve("fixture-root");
  const moduleUrl = createModuleUrl(root);
  const packagedDashboard = join(root, "packages", "cli", "dist", "dashboard", "index.js");
  const sourceDashboard = join(root, "apps", "dashboard", "dist", "index.js");

  assert.equal(
    getDashboardModulePath({
      exists: (path) => path === packagedDashboard,
      moduleUrl
    }),
    packagedDashboard
  );
  assert.equal(
    getDashboardModulePath({
      exists: (path) => path === sourceDashboard,
      moduleUrl
    }),
    sourceDashboard
  );
});
