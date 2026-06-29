import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  CheckpointSchema,
  ProductionRunSchema,
  WorkUnitSchema,
  WorkflowStateSchema,
  type Checkpoint,
  type ProductionRun,
  type WorkUnit,
  type WorkflowState
} from "../../schemas/dist/schemas/src/index.js";

export type {
  Checkpoint,
  CheckpointReason,
  ProductionRun,
  ProductionStep,
  WorkUnit,
  WorkflowState
} from "../../schemas/dist/schemas/src/index.js";

export const WORKFLOW_STATE_RELATIVE_PATH = join(".storyos", "workflow-state.json");
export const PRODUCTION_RUNS_RELATIVE_DIR = join(".storyos", "runs");
export const CHECKPOINTS_RELATIVE_DIR = join(".storyos", "checkpoints");

export const WORKFLOW_STATE_RECOVERY_SUGGESTION =
  'Restore .storyos/workflow-state.json from backup, or replace it with a valid idle state such as {"status":"idle","updatedAt":"<ISO timestamp>"} before resuming.';
export const PRODUCTION_RUN_RECOVERY_SUGGESTION =
  "Inspect .storyos/runs/, remove or repair the damaged run JSON file, then retry the workflow operation.";
export const CHECKPOINT_RECOVERY_SUGGESTION =
  "Inspect .storyos/checkpoints/, remove or repair the damaged checkpoint JSON file, then retry the workflow operation.";

export class WorkflowStateFileError extends Error {
  readonly recoverySuggestion: string;

  constructor(message: string, recoverySuggestion = WORKFLOW_STATE_RECOVERY_SUGGESTION) {
    super(`${message} Recovery suggestion: ${recoverySuggestion}`);
    this.name = "WorkflowStateFileError";
    this.recoverySuggestion = recoverySuggestion;
  }
}

export class ProductionRunFileError extends Error {
  readonly recoverySuggestion: string;

  constructor(message: string, recoverySuggestion = PRODUCTION_RUN_RECOVERY_SUGGESTION) {
    super(`${message} Recovery suggestion: ${recoverySuggestion}`);
    this.name = "ProductionRunFileError";
    this.recoverySuggestion = recoverySuggestion;
  }
}

export class CheckpointFileError extends Error {
  readonly recoverySuggestion: string;

  constructor(message: string, recoverySuggestion = CHECKPOINT_RECOVERY_SUGGESTION) {
    super(`${message} Recovery suggestion: ${recoverySuggestion}`);
    this.name = "CheckpointFileError";
    this.recoverySuggestion = recoverySuggestion;
  }
}

export type SanitizeFilenameTitleOptions = {
  fallbackTitle?: string;
  maxLength?: number;
};

export type FormatWorkUnitDisplayTitleOptions = {
  index: number;
  numberPadding?: number;
  title: string;
  type: WorkUnit["type"];
};

export type CreateWorkUnitOptions = {
  existingUnits?: readonly WorkUnit[];
  id?: string;
  index: number;
  numberPadding?: number;
  status?: WorkUnit["status"];
  title: string;
  type: WorkUnit["type"];
};

export type CreateNextWorkUnitOptions = Omit<CreateWorkUnitOptions, "index">;

const DEFAULT_CHAPTER_NUMBER_PADDING = 4;
const DEFAULT_FILENAME_TITLE_MAX_LENGTH = 96;
const DEFAULT_FILENAME_FALLBACK_TITLE = "untitled";
const WINDOWS_RESERVED_FILENAME_CHARACTERS = /[<>:"/\\|?*]/g;

const replaceControlCharacters = (value: string): string =>
  Array.from(value, (character) => ((character.codePointAt(0) ?? 0) < 32 ? "-" : character)).join(
    ""
  );

export const formatWorkUnitNumber = (
  index: number,
  padding = DEFAULT_CHAPTER_NUMBER_PADDING
): string => {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error("WorkUnit index must be a non-negative integer.");
  }

  if (!Number.isInteger(padding) || padding < 1) {
    throw new Error("WorkUnit number padding must be a positive integer.");
  }

  return String(index + 1).padStart(padding, "0");
};

export const formatWorkUnitDisplayTitle = (options: FormatWorkUnitDisplayTitleOptions): string => {
  const title = options.title.trim();

  if (!title) {
    throw new Error("WorkUnit title must not be empty.");
  }

  if (options.type === "chapter") {
    return `第 ${formatWorkUnitNumber(options.index, options.numberPadding)} 章 ${title}`;
  }

  return title;
};

export const sanitizeFilenameTitle = (
  title: string,
  options: SanitizeFilenameTitleOptions = {}
): string => {
  const fallbackTitle = options.fallbackTitle ?? DEFAULT_FILENAME_FALLBACK_TITLE;
  const maxLength = options.maxLength ?? DEFAULT_FILENAME_TITLE_MAX_LENGTH;

  if (!Number.isInteger(maxLength) || maxLength < 1) {
    throw new Error("Filename title maxLength must be a positive integer.");
  }

  const sanitized = title.normalize("NFKC").replace(WINDOWS_RESERVED_FILENAME_CHARACTERS, "-");
  const safeTitle = replaceControlCharacters(sanitized)
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .trim()
    .replace(/[ .]+$/g, "")
    .replace(/^[ .]+/g, "");
  const finalTitle = safeTitle || fallbackTitle;

  return finalTitle.length > maxLength ? finalTitle.slice(0, maxLength).trimEnd() : finalTitle;
};

const hashShortId = (value: string): string => {
  let hash = 0x811c9dc5;

  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash.toString(36).padStart(6, "0").slice(0, 6);
};

const truncateForSuffix = (
  value: string,
  suffix: string,
  maxLength = DEFAULT_FILENAME_TITLE_MAX_LENGTH
): string => {
  const availableLength = Math.max(1, maxLength - suffix.length);
  return value.length > availableLength ? value.slice(0, availableLength).trimEnd() : value;
};

const ensureUniqueFilenameTitle = (
  filenameTitle: string,
  existingUnits: readonly WorkUnit[],
  seed: string
): string => {
  const existingFilenameTitles = new Set(
    existingUnits
      .map((unit) => unit.filenameTitle)
      .filter((value): value is string => value !== undefined)
  );

  if (!existingFilenameTitles.has(filenameTitle)) {
    return filenameTitle;
  }

  const shortId = hashShortId(seed);
  const suffix = `-${shortId}`;
  let candidate = `${truncateForSuffix(filenameTitle, suffix)}${suffix}`;
  let collisionIndex = 2;

  while (existingFilenameTitles.has(candidate)) {
    const indexedSuffix = `${suffix}-${collisionIndex}`;
    candidate = `${truncateForSuffix(filenameTitle, indexedSuffix)}${indexedSuffix}`;
    collisionIndex += 1;
  }

  return candidate;
};

export const validateWorkUnit = (value: unknown): WorkUnit => {
  const parsed = WorkUnitSchema.safeParse(value);

  if (!parsed.success) {
    throw new Error(
      `Invalid WorkUnit: ${parsed.error.issues
        .map((issue: { message: string }) => issue.message)
        .join("; ")}.`
    );
  }

  return parsed.data;
};

export const createWorkUnit = (options: CreateWorkUnitOptions): WorkUnit => {
  const displayTitle = formatWorkUnitDisplayTitle(options);
  const id =
    options.id ?? `${options.type}-${formatWorkUnitNumber(options.index, options.numberPadding)}`;
  const baseFilenameTitle = sanitizeFilenameTitle(displayTitle);
  const filenameTitle = ensureUniqueFilenameTitle(
    baseFilenameTitle,
    options.existingUnits ?? [],
    `${id}:${displayTitle}`
  );

  return validateWorkUnit({
    displayTitle,
    filenameTitle,
    id,
    index: options.index,
    status: options.status ?? "planned",
    title: options.title.trim(),
    type: options.type
  });
};

export const createNextWorkUnit = (options: CreateNextWorkUnitOptions): WorkUnit => {
  const existingUnits = options.existingUnits ?? [];
  const nextIndex =
    Math.max(
      -1,
      ...existingUnits.filter((unit) => unit.type === options.type).map((unit) => unit.index)
    ) + 1;

  return createWorkUnit({
    ...options,
    existingUnits,
    index: nextIndex
  });
};

export const createDefaultWorkflowState = (
  updatedAt = new Date().toISOString()
): WorkflowState => ({
  status: "idle",
  updatedAt
});

const isMissingPathError = (error: unknown): boolean =>
  error instanceof Error && "code" in error && (error as { code?: string }).code === "ENOENT";

export const validateWorkflowState = (value: unknown): WorkflowState => {
  const parsed = WorkflowStateSchema.safeParse(value);

  if (!parsed.success) {
    throw new WorkflowStateFileError(
      `Invalid workflow-state.json: ${parsed.error.issues
        .map((issue: { message: string }) => issue.message)
        .join("; ")}.`
    );
  }

  return parsed.data;
};

export const validateProductionRun = (value: unknown): ProductionRun => {
  const parsed = ProductionRunSchema.safeParse(value);

  if (!parsed.success) {
    throw new ProductionRunFileError(
      `Invalid ProductionRun: ${parsed.error.issues
        .map((issue: { message: string }) => issue.message)
        .join("; ")}.`
    );
  }

  return parsed.data;
};

export const validateCheckpoint = (value: unknown): Checkpoint => {
  const parsed = CheckpointSchema.safeParse(value);

  if (!parsed.success) {
    throw new CheckpointFileError(
      `Invalid Checkpoint: ${parsed.error.issues
        .map((issue: { message: string }) => issue.message)
        .join("; ")}.`
    );
  }

  return parsed.data;
};

export const readWorkflowStateFile = async (
  filePath: string,
  options: { defaultIfMissing?: boolean; now?: string } = {}
): Promise<WorkflowState> => {
  let text: string;

  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    if (isMissingPathError(error) && options.defaultIfMissing !== false) {
      return createDefaultWorkflowState(options.now);
    }

    throw error;
  }

  try {
    return validateWorkflowState(JSON.parse(text.replace(/^\uFEFF/, "")));
  } catch (error) {
    if (error instanceof WorkflowStateFileError) {
      throw error;
    }

    throw new WorkflowStateFileError("Invalid workflow-state.json: file is not valid JSON.");
  }
};

export const readWorkflowState = async (
  projectRoot: string,
  options: { defaultIfMissing?: boolean; now?: string } = {}
): Promise<WorkflowState> =>
  readWorkflowStateFile(join(projectRoot, WORKFLOW_STATE_RELATIVE_PATH), options);

export const writeWorkflowStateFile = async (
  filePath: string,
  state: WorkflowState
): Promise<WorkflowState> => {
  const validated = validateWorkflowState(state);
  const directory = dirname(filePath);
  const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;

  await mkdir(directory, {
    recursive: true
  });
  await writeFile(tempPath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);

  return validated;
};

export const writeWorkflowState = async (
  projectRoot: string,
  state: WorkflowState
): Promise<WorkflowState> =>
  writeWorkflowStateFile(join(projectRoot, WORKFLOW_STATE_RELATIVE_PATH), state);

const assertSafeRunId = (runId: string): void => {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new ProductionRunFileError(
      `Invalid ProductionRun id "${runId}": run ids must be safe file names.`
    );
  }
};

export const getProductionRunFilePath = (projectRoot: string, runId: string): string => {
  assertSafeRunId(runId);

  return join(projectRoot, PRODUCTION_RUNS_RELATIVE_DIR, `${runId}.json`);
};

export const readProductionRunFile = async (filePath: string): Promise<ProductionRun> => {
  let text: string;

  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    if (isMissingPathError(error)) {
      throw new ProductionRunFileError(`ProductionRun file not found: ${filePath}.`);
    }

    throw error;
  }

  try {
    return validateProductionRun(JSON.parse(text.replace(/^\uFEFF/, "")));
  } catch (error) {
    if (error instanceof ProductionRunFileError) {
      throw error;
    }

    throw new ProductionRunFileError(`Invalid ProductionRun file: ${filePath} is not valid JSON.`);
  }
};

export const readProductionRun = async (
  projectRoot: string,
  runId: string
): Promise<ProductionRun> => readProductionRunFile(getProductionRunFilePath(projectRoot, runId));

export const writeProductionRunFile = async (
  filePath: string,
  run: ProductionRun
): Promise<ProductionRun> => {
  const validated = validateProductionRun(run);
  const directory = dirname(filePath);
  const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;

  await mkdir(directory, {
    recursive: true
  });
  await writeFile(tempPath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);

  return validated;
};

export const writeProductionRun = async (
  projectRoot: string,
  run: ProductionRun
): Promise<ProductionRun> =>
  writeProductionRunFile(getProductionRunFilePath(projectRoot, run.id), run);

export const listProductionRunIds = async (projectRoot: string): Promise<string[]> => {
  const runsDirectory = join(projectRoot, PRODUCTION_RUNS_RELATIVE_DIR);
  let entries: string[];

  try {
    entries = await readdir(runsDirectory);
  } catch (error) {
    if (isMissingPathError(error)) {
      return [];
    }

    throw error;
  }

  return entries
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => entry.slice(0, -".json".length))
    .sort();
};

const getRunTimestamp = (run: ProductionRun): number => {
  const parsed = Date.parse(run.startedAt);

  return Number.isNaN(parsed) ? 0 : parsed;
};

export const readLatestProductionRun = async (
  projectRoot: string
): Promise<ProductionRun | undefined> => {
  const runIds = await listProductionRunIds(projectRoot);
  const runs = await Promise.all(runIds.map((runId) => readProductionRun(projectRoot, runId)));

  return runs.sort((left, right) => {
    const byTimestamp = getRunTimestamp(right) - getRunTimestamp(left);

    if (byTimestamp !== 0) {
      return byTimestamp;
    }

    return right.id.localeCompare(left.id);
  })[0];
};

const createCheckpointId = (createdAt: string): string =>
  createdAt
    .replace(/[:/\\\s]/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/-+/g, "-");

const assertSafeCheckpointId = (checkpointId: string): void => {
  if (!/^[A-Za-z0-9._-]+$/.test(checkpointId)) {
    throw new CheckpointFileError(
      `Invalid checkpoint id "${checkpointId}": checkpoint ids must be safe file names.`
    );
  }
};

export const createCheckpoint = (
  checkpoint: Omit<Checkpoint, "id"> & { id?: string }
): Checkpoint =>
  validateCheckpoint({
    ...checkpoint,
    id: checkpoint.id ?? createCheckpointId(checkpoint.createdAt)
  });

export const getCheckpointFilePath = (projectRoot: string, checkpointId: string): string => {
  assertSafeCheckpointId(checkpointId);

  return join(projectRoot, CHECKPOINTS_RELATIVE_DIR, `${checkpointId}.json`);
};

export const readCheckpointFile = async (filePath: string): Promise<Checkpoint> => {
  let text: string;

  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    if (isMissingPathError(error)) {
      throw new CheckpointFileError(`Checkpoint file not found: ${filePath}.`);
    }

    throw error;
  }

  try {
    return validateCheckpoint(JSON.parse(text.replace(/^\uFEFF/, "")));
  } catch (error) {
    if (error instanceof CheckpointFileError) {
      throw error;
    }

    throw new CheckpointFileError(`Invalid checkpoint file: ${filePath} is not valid JSON.`);
  }
};

export const readCheckpoint = async (
  projectRoot: string,
  checkpointId: string
): Promise<Checkpoint> => readCheckpointFile(getCheckpointFilePath(projectRoot, checkpointId));

export const writeCheckpointFile = async (
  filePath: string,
  checkpoint: Checkpoint
): Promise<Checkpoint> => {
  const validated = validateCheckpoint(checkpoint);
  const directory = dirname(filePath);
  const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;

  await mkdir(directory, {
    recursive: true
  });
  await writeFile(tempPath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);

  return validated;
};

export const writeCheckpoint = async (
  projectRoot: string,
  checkpoint: Checkpoint
): Promise<Checkpoint> =>
  writeCheckpointFile(getCheckpointFilePath(projectRoot, checkpoint.id), checkpoint);

export const createAndWriteCheckpoint = async (
  projectRoot: string,
  checkpoint: Omit<Checkpoint, "id"> & { id?: string }
): Promise<Checkpoint> => writeCheckpoint(projectRoot, createCheckpoint(checkpoint));

export const listCheckpointIds = async (projectRoot: string): Promise<string[]> => {
  const checkpointsDirectory = join(projectRoot, CHECKPOINTS_RELATIVE_DIR);
  let entries: string[];

  try {
    entries = await readdir(checkpointsDirectory);
  } catch (error) {
    if (isMissingPathError(error)) {
      return [];
    }

    throw error;
  }

  return entries
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => entry.slice(0, -".json".length))
    .sort();
};

const getCheckpointTimestamp = (checkpoint: Checkpoint): number => {
  const parsed = Date.parse(checkpoint.createdAt);

  return Number.isNaN(parsed) ? 0 : parsed;
};

export const readRecentCheckpoints = async (
  projectRoot: string,
  options: { limit?: number } = {}
): Promise<Checkpoint[]> => {
  const checkpointIds = await listCheckpointIds(projectRoot);
  const checkpoints = await Promise.all(
    checkpointIds.map((checkpointId) => readCheckpoint(projectRoot, checkpointId))
  );

  return checkpoints
    .sort((left, right) => {
      const byTimestamp = getCheckpointTimestamp(right) - getCheckpointTimestamp(left);

      if (byTimestamp !== 0) {
        return byTimestamp;
      }

      return right.id.localeCompare(left.id);
    })
    .slice(0, options.limit);
};
