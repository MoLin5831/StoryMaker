import type { WorkUnit } from "../../schemas/dist/schemas/src/index.js";

export type { WorkUnit } from "../../schemas/dist/schemas/src/index.js";

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

const WorkUnitTypeValues: readonly WorkUnit["type"][] = [
  "chapter",
  "scene",
  "episode",
  "panel",
  "branch",
  "node",
  "quest",
  "dialogue_node"
];

const WorkUnitStatusValues: readonly WorkUnit["status"][] = [
  "planned",
  "producing",
  "drafted",
  "reviewed",
  "revised",
  "awaiting_user_review",
  "rejected",
  "approved_pending_kb_commit",
  "final"
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isWorkUnitType = (value: unknown): value is WorkUnit["type"] =>
  typeof value === "string" && WorkUnitTypeValues.includes(value as WorkUnit["type"]);

const isWorkUnitStatus = (value: unknown): value is WorkUnit["status"] =>
  typeof value === "string" && WorkUnitStatusValues.includes(value as WorkUnit["status"]);

const optionalString = (record: Record<string, unknown>, key: string): string | undefined => {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

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
  if (!isRecord(value)) {
    throw new Error("Invalid WorkUnit: expected an object.");
  }

  if (typeof value.id !== "string" || value.id.length === 0) {
    throw new Error("Invalid WorkUnit: id is required.");
  }

  if (!isWorkUnitType(value.type)) {
    throw new Error("Invalid WorkUnit: type is invalid.");
  }

  const index = value.index;

  if (typeof index !== "number" || !Number.isInteger(index) || index < 0) {
    throw new Error("Invalid WorkUnit: index must be a non-negative integer.");
  }

  if (typeof value.title !== "string" || value.title.length === 0) {
    throw new Error("Invalid WorkUnit: title is required.");
  }

  if (typeof value.displayTitle !== "string" || value.displayTitle.length === 0) {
    throw new Error("Invalid WorkUnit: displayTitle is required.");
  }

  if (!isWorkUnitStatus(value.status)) {
    throw new Error("Invalid WorkUnit: status is invalid.");
  }

  return {
    displayTitle: value.displayTitle,
    filenameTitle: optionalString(value, "filenameTitle"),
    id: value.id,
    index,
    outputFile: optionalString(value, "outputFile"),
    revisionDir: optionalString(value, "revisionDir"),
    slug: optionalString(value, "slug"),
    stagedOutputFile: optionalString(value, "stagedOutputFile"),
    status: value.status,
    title: value.title,
    type: value.type
  };
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
