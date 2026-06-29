import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const PENDING_KNOWLEDGE_UPDATES_RELATIVE_DIR = join(
  ".storyos",
  "pending-knowledge-updates"
);

export type PendingKnowledgeUpdateStatus = "staged" | "committed" | "rejected";

export type PendingKnowledgeUpdatePayload = Record<string, unknown>;

export const PendingKnowledgeFactTypeValues = [
  "character_state",
  "location_change",
  "item_location",
  "ability_rule",
  "timeline_event",
  "new_foreshadowing",
  "recovered_foreshadowing",
  "unconfirmed_assumption"
] as const;

export type PendingKnowledgeFactType =
  (typeof PendingKnowledgeFactTypeValues)[number];

export type PendingKnowledgeFactDraft = {
  confidence?: "low" | "medium" | "high";
  key?: string;
  note?: string;
  sourceRef?: string;
  subject?: string;
  summary: string;
  type: PendingKnowledgeFactType;
  value?: string;
};

export type PendingKnowledgeUpdate = {
  committedAt?: string;
  createdAt: string;
  entityUpdates: PendingKnowledgeUpdatePayload[];
  factDrafts: PendingKnowledgeFactDraft[];
  facts: PendingKnowledgeUpdatePayload[];
  foreshadowingUpdates: PendingKnowledgeUpdatePayload[];
  id: string;
  rejectedAt?: string;
  sourceRunId: string;
  status: PendingKnowledgeUpdateStatus;
  timelineUpdates: PendingKnowledgeUpdatePayload[];
  unitId: string;
};

export type CreatePendingKnowledgeUpdateOptions = {
  createdAt: string;
  entityUpdates?: PendingKnowledgeUpdatePayload[];
  factDrafts?: PendingKnowledgeFactDraft[];
  facts?: PendingKnowledgeUpdatePayload[];
  foreshadowingUpdates?: PendingKnowledgeUpdatePayload[];
  id?: string;
  sourceRunId: string;
  timelineUpdates?: PendingKnowledgeUpdatePayload[];
  unitId: string;
};

const validStatuses = new Set<PendingKnowledgeUpdateStatus>([
  "staged",
  "committed",
  "rejected"
]);

const validFactTypes = new Set<string>(PendingKnowledgeFactTypeValues);

const validConfidence = new Set(["low", "medium", "high"]);

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const assertNonEmptyString = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid PendingKnowledgeUpdate.${field}: expected non-empty string.`);
  }

  return value;
};

const assertSafeFileId = (id: string): string => {
  if (id.includes("/") || id.includes("\\") || id.includes("\0")) {
    throw new Error("Invalid PendingKnowledgeUpdate.id: path separators are not allowed.");
  }

  return id;
};

const assertPayloadArray = (
  value: unknown,
  field: string
): PendingKnowledgeUpdatePayload[] => {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid PendingKnowledgeUpdate.${field}: expected array.`);
  }

  for (const item of value) {
    if (!isObjectRecord(item)) {
      throw new Error(
        `Invalid PendingKnowledgeUpdate.${field}: expected object entries.`
      );
    }
  }

  return value as PendingKnowledgeUpdatePayload[];
};

export const validatePendingKnowledgeFactDraft = (
  value: unknown
): PendingKnowledgeFactDraft => {
  if (!isObjectRecord(value)) {
    throw new Error("Invalid PendingKnowledgeFactDraft: expected object.");
  }

  const type = assertNonEmptyString(value.type, "factDrafts.type");

  if (!validFactTypes.has(type)) {
    throw new Error(`Invalid PendingKnowledgeFactDraft.type: ${type}.`);
  }

  const summary = assertNonEmptyString(value.summary, "factDrafts.summary");
  const confidence =
    typeof value.confidence === "string" && validConfidence.has(value.confidence)
      ? (value.confidence as PendingKnowledgeFactDraft["confidence"])
      : undefined;

  return {
    ...(confidence !== undefined ? { confidence } : {}),
    ...(typeof value.key === "string" && value.key.trim().length > 0
      ? { key: value.key.trim() }
      : {}),
    ...(typeof value.note === "string" && value.note.trim().length > 0
      ? { note: value.note.trim() }
      : {}),
    ...(typeof value.sourceRef === "string" && value.sourceRef.trim().length > 0
      ? { sourceRef: value.sourceRef.trim() }
      : {}),
    ...(typeof value.subject === "string" && value.subject.trim().length > 0
      ? { subject: value.subject.trim() }
      : {}),
    summary: summary.trim(),
    type: type as PendingKnowledgeFactType,
    ...(typeof value.value === "string" && value.value.trim().length > 0
      ? { value: value.value.trim() }
      : {})
  };
};

const assertFactDraftArray = (
  value: unknown,
  field: string
): PendingKnowledgeFactDraft[] => {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`Invalid PendingKnowledgeUpdate.${field}: expected array.`);
  }

  return value.map(validatePendingKnowledgeFactDraft);
};

const isMissingPathError = (error: unknown): boolean =>
  error instanceof Error &&
  "code" in error &&
  (error as { code?: string }).code === "ENOENT";

const normalizeRelativePath = (path: string): string => path.split("\\").join("/");

export const getPendingKnowledgeUpdateRelativePath = (id: string): string =>
  normalizeRelativePath(
    join(PENDING_KNOWLEDGE_UPDATES_RELATIVE_DIR, `${assertSafeFileId(id)}.json`)
  );

export const getPendingKnowledgeUpdateFilePath = (
  cwd: string,
  id: string
): string => join(cwd, getPendingKnowledgeUpdateRelativePath(id));

export const createPendingKnowledgeUpdate = (
  options: CreatePendingKnowledgeUpdateOptions
): PendingKnowledgeUpdate =>
  validatePendingKnowledgeUpdate({
    createdAt: options.createdAt,
    entityUpdates: options.entityUpdates ?? [],
    factDrafts: options.factDrafts ?? [],
    facts: options.facts ?? [],
    foreshadowingUpdates: options.foreshadowingUpdates ?? [],
    id: options.id ?? `pending-${options.sourceRunId}`,
    sourceRunId: options.sourceRunId,
    status: "staged",
    timelineUpdates: options.timelineUpdates ?? [],
    unitId: options.unitId
  });

export const validatePendingKnowledgeUpdate = (
  value: unknown
): PendingKnowledgeUpdate => {
  if (!isObjectRecord(value)) {
    throw new Error("Invalid PendingKnowledgeUpdate: expected object.");
  }

  const id = assertSafeFileId(assertNonEmptyString(value.id, "id"));
  const status = assertNonEmptyString(value.status, "status");

  if (!validStatuses.has(status as PendingKnowledgeUpdateStatus)) {
    throw new Error(`Invalid PendingKnowledgeUpdate.status: ${status}.`);
  }

  return {
    ...(typeof value.committedAt === "string"
      ? { committedAt: value.committedAt }
      : {}),
    createdAt: assertNonEmptyString(value.createdAt, "createdAt"),
    entityUpdates: assertPayloadArray(value.entityUpdates, "entityUpdates"),
    factDrafts: assertFactDraftArray(value.factDrafts, "factDrafts"),
    facts: assertPayloadArray(value.facts, "facts"),
    foreshadowingUpdates: assertPayloadArray(
      value.foreshadowingUpdates,
      "foreshadowingUpdates"
    ),
    id,
    ...(typeof value.rejectedAt === "string" ? { rejectedAt: value.rejectedAt } : {}),
    sourceRunId: assertNonEmptyString(value.sourceRunId, "sourceRunId"),
    status: status as PendingKnowledgeUpdateStatus,
    timelineUpdates: assertPayloadArray(value.timelineUpdates, "timelineUpdates"),
    unitId: assertNonEmptyString(value.unitId, "unitId")
  };
};

const assertStagedUpdate = (update: PendingKnowledgeUpdate): void => {
  if (update.status !== "staged") {
    throw new Error(
      `PendingKnowledgeUpdate ${update.id} must be staged; current status is ${update.status}.`
    );
  }
};

export const commitPendingKnowledgeUpdate = (
  update: PendingKnowledgeUpdate,
  committedAt: string
): PendingKnowledgeUpdate => {
  assertStagedUpdate(update);
  const { rejectedAt: _rejectedAt, ...rest } = update;

  return validatePendingKnowledgeUpdate({
    ...rest,
    committedAt,
    status: "committed"
  });
};

export const rejectPendingKnowledgeUpdate = (
  update: PendingKnowledgeUpdate,
  rejectedAt: string
): PendingKnowledgeUpdate => {
  assertStagedUpdate(update);
  const { committedAt: _committedAt, ...rest } = update;

  return validatePendingKnowledgeUpdate({
    ...rest,
    rejectedAt,
    status: "rejected"
  });
};

export const writePendingKnowledgeUpdate = async (
  cwd: string,
  update: PendingKnowledgeUpdate
): Promise<string> => {
  const validated = validatePendingKnowledgeUpdate(update);
  const filePath = getPendingKnowledgeUpdateFilePath(cwd, validated.id);

  await mkdir(dirname(filePath), {
    recursive: true
  });
  await writeFile(filePath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");

  return getPendingKnowledgeUpdateRelativePath(validated.id);
};

export const readPendingKnowledgeUpdate = async (
  cwd: string,
  id: string
): Promise<PendingKnowledgeUpdate> =>
  validatePendingKnowledgeUpdate(
    JSON.parse(
      (await readFile(getPendingKnowledgeUpdateFilePath(cwd, id), "utf8")).replace(
        /^\uFEFF/,
        ""
      )
    ) as unknown
  );

export const listPendingKnowledgeUpdateIds = async (
  cwd: string
): Promise<string[]> => {
  const directoryPath = join(cwd, PENDING_KNOWLEDGE_UPDATES_RELATIVE_DIR);

  let fileNames: string[];

  try {
    fileNames = await readdir(directoryPath);
  } catch (error) {
    if (isMissingPathError(error)) {
      return [];
    }

    throw error;
  }

  return fileNames
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => fileName.slice(0, -".json".length))
    .sort();
};
