import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type RuntimeAssetPathOptions = {
  exists?: (path: string) => boolean;
  moduleUrl?: string;
};

const getModuleDirectory = (moduleUrl: string): string => dirname(fileURLToPath(moduleUrl));

export const getRuntimePathCandidates = (
  relativePath: string,
  options: RuntimeAssetPathOptions = {}
): string[] => {
  const moduleDirectory = getModuleDirectory(options.moduleUrl ?? import.meta.url);

  return [
    resolve(moduleDirectory, relativePath),
    resolve(moduleDirectory, "../../..", relativePath)
  ];
};

export const getFirstExistingRuntimePath = (
  relativePath: string,
  options: RuntimeAssetPathOptions = {}
): string => {
  const candidates = getRuntimePathCandidates(relativePath, options);
  const pathExists = options.exists ?? existsSync;

  return candidates.find((candidate) => pathExists(candidate)) ?? candidates[0];
};

export const getDashboardModulePath = (options: RuntimeAssetPathOptions = {}): string => {
  const moduleDirectory = getModuleDirectory(options.moduleUrl ?? import.meta.url);
  const candidates = [
    resolve(moduleDirectory, "dashboard", "index.js"),
    resolve(moduleDirectory, "../../..", "apps", "dashboard", "dist", "index.js")
  ];
  const pathExists = options.exists ?? existsSync;

  return candidates.find((candidate) => pathExists(candidate)) ?? candidates[0];
};

export const getTemplateRoot = (options: RuntimeAssetPathOptions = {}): string =>
  getFirstExistingRuntimePath(join("templates", "base"), options);
