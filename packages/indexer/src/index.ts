import { access, readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  getPendingKnowledgeUpdateRelativePath,
  listPendingKnowledgeUpdateIds,
  readMarkdownWithFrontMatter,
  readPendingKnowledgeUpdate,
  type PendingKnowledgeFactDraft,
  type PendingKnowledgeUpdate,
  type PendingKnowledgeUpdatePayload,
  type FrontMatter
} from "../../knowledge/dist/index.js";

export const STORYOS_DATABASE_VERSION = 1;

export type StoryDatabaseInfo = {
  path: string;
  version: number;
};

export type IndexStoryProjectOptions = {
  cwd: string;
  includeStaged?: boolean;
  rebuild?: boolean;
};

export type IndexStoryProjectResult = {
  databasePath: string;
  includedStatuses: string[];
  indexedFiles: number;
  mode: "rebuild" | "update";
  removedFiles: number;
  scannedFiles: number;
};

export type SearchStoryIndexOptions = {
  cwd: string;
  includeStaged?: boolean;
  limit?: number;
  query: string;
};

export type SearchStoryIndexResult = {
  fallbackReason?: string;
  mode: "fallback" | "fts5";
  query: string;
  results: SearchStoryIndexHit[];
};

export type SearchStoryIndexHit = {
  reason: string;
  score: number;
  sourcePath: string;
  status: string;
  summary: string;
  title: string;
};

export type KnowledgeBrowserEntryStatus = "canon" | "staged" | "rejected";

export type KnowledgeBrowserEntryType =
  | "character"
  | "place"
  | "timeline"
  | "foreshadowing"
  | "fact";

export type KnowledgeBrowserEntry = {
  sourcePath: string;
  status: KnowledgeBrowserEntryStatus;
  summary: string;
  title: string;
  type: KnowledgeBrowserEntryType;
};

export type ReadKnowledgeBrowserOptions = {
  cwd: string;
  includeRejected?: boolean;
  includeStaged?: boolean;
  limit?: number;
  query?: string;
};

export type KnowledgeBrowserResult = {
  entries: KnowledgeBrowserEntry[];
  includedStatuses: KnowledgeBrowserEntryStatus[];
  query: string;
};

export type StructuredStoryContextKind =
  | "character_state"
  | "item_location"
  | "timeline"
  | "foreshadowing";

export type StructuredStoryContextSource = {
  kind: StructuredStoryContextKind;
  sourcePath: string;
  status: "canon" | "staged";
  summary: string;
  title: string;
};

export type ReadStructuredStoryContextOptions = {
  cwd: string;
  includeStaged?: boolean;
};

type IndexedMarkdownFile = {
  body: string;
  id: string;
  sourcePath: string;
  status: "canon" | "staged";
};

type StructuredFactRecord = {
  content: string;
  entity?: {
    id: string;
    name: string;
    type: string;
  };
  factType: string;
  foreshadowing?: {
    id: string;
    payoff: string | null;
    setup: string;
    status: string;
  };
  id: string;
  sourcePath: string;
  status: "canon" | "staged";
  timeline?: {
    eventTime: string | null;
    id: string;
    summary: string;
    title: string;
  };
};

type IndexedPendingKnowledgeUpdate = {
  content: string;
  id: string;
  sourceUnitId: string;
  status: "committed" | "staged";
};

type IndexedStructuredKnowledge = {
  pendingUpdates: IndexedPendingKnowledgeUpdate[];
  records: StructuredFactRecord[];
};

type SearchableFactRow = {
  content: string;
  fact_type: string;
  source_path: string;
  status: string;
};

const schemaSql = `
PRAGMA foreign_keys = ON;
PRAGMA user_version = ${STORYOS_DATABASE_VERSION};

CREATE TABLE IF NOT EXISTS storyos_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  aliases TEXT NOT NULL DEFAULT '[]',
  source_path TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS work_units (
  id TEXT PRIMARY KEY,
  unit_type TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  source_path TEXT,
  output_path TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS facts (
  id TEXT PRIMARY KEY,
  entity_id TEXT,
  fact_type TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL,
  source_path TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entity_id) REFERENCES entities(id)
);

CREATE TABLE IF NOT EXISTS pending_knowledge_updates (
  id TEXT PRIMARY KEY,
  source_unit_id TEXT,
  status TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS timeline_events (
  id TEXT PRIMARY KEY,
  event_time TEXT,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source_path TEXT
);

CREATE TABLE IF NOT EXISTS foreshadowing (
  id TEXT PRIMARY KEY,
  setup TEXT NOT NULL,
  payoff TEXT,
  status TEXT NOT NULL,
  source_path TEXT
);

CREATE TABLE IF NOT EXISTS production_runs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS quality_reports (
  id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL,
  gate TEXT NOT NULL,
  status TEXT NOT NULL,
  score REAL,
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS search_index_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  schema_version INTEGER NOT NULL,
  source_watermark TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO storyos_meta (key, value, updated_at)
VALUES ('schema_version', '${STORYOS_DATABASE_VERSION}', CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO search_index_meta (id, schema_version, updated_at)
VALUES (1, ${STORYOS_DATABASE_VERSION}, CURRENT_TIMESTAMP)
ON CONFLICT(id) DO UPDATE SET
  schema_version = excluded.schema_version,
  updated_at = CURRENT_TIMESTAMP;
`;

const withDatabase = <Result>(
  databasePath: string,
  callback: (database: DatabaseSync) => Result
): Result => {
  const database = new DatabaseSync(databasePath);

  try {
    return callback(database);
  } finally {
    database.close();
  }
};

export const initializeStoryDatabase = (
  databasePath: string
): StoryDatabaseInfo =>
  withDatabase(databasePath, (database) => {
    database.exec("BEGIN");

    try {
      database.exec(schemaSql);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }

    return {
      path: databasePath,
      version: STORYOS_DATABASE_VERSION
    };
  });

export const getStoryDatabaseVersion = (databasePath: string): number =>
  withDatabase(databasePath, (database) => {
    const row = database
      .prepare("SELECT value FROM storyos_meta WHERE key = 'schema_version'")
      .get() as { value?: unknown } | undefined;
    const version = Number(row?.value ?? 0);

    return Number.isInteger(version) ? version : 0;
  });

const sourceRootNames = ["bible", "knowledge", "plans", "outputs", "units"];

const isMissingPathError = (error: unknown): boolean =>
  error instanceof Error &&
  "code" in error &&
  (error as { code?: string }).code === "ENOENT";

const collectMarkdownFiles = async (root: string): Promise<string[]> => {
  let entries;

  try {
    entries = await readdir(root, {
      withFileTypes: true
    });
  } catch (error) {
    if (isMissingPathError(error)) {
      return [];
    }

    throw error;
  }

  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(entryPath);
    }
  }

  return files;
};

const normalizeRelativePath = (cwd: string, path: string): string =>
  relative(cwd, path).split(sep).join("/");

const getFrontMatterStatus = (frontMatter: FrontMatter): string => {
  const status = frontMatter.status;

  return typeof status === "string" ? status : "";
};

const readIndexableMarkdownFiles = async (
  cwd: string,
  includeStaged: boolean
): Promise<{ files: IndexedMarkdownFile[]; scannedFiles: number }> => {
  const markdownFiles = (
    await Promise.all(
      sourceRootNames.map((rootName) => collectMarkdownFiles(join(cwd, rootName)))
    )
  )
    .flat()
    .sort();
  const files: IndexedMarkdownFile[] = [];

  for (const filePath of markdownFiles) {
    const markdown = await readFile(filePath, "utf8");
    const parsed = readMarkdownWithFrontMatter(markdown);
    const status = getFrontMatterStatus(parsed.frontMatter);

    if (status !== "canon" && (!includeStaged || status !== "staged")) {
      continue;
    }

    const sourcePath = normalizeRelativePath(cwd, filePath);

    files.push({
      body: parsed.body,
      id: `markdown:${sourcePath}`,
      sourcePath,
      status
    });
  }

  return {
    files,
    scannedFiles: markdownFiles.length
  };
};

const createSafeIdPart = (value: string): string => {
  const safe = value
    .trim()
    .toLocaleLowerCase("zh-CN")
    .replace(/[:/\\\s]/g, "-")
    .replace(/[^A-Za-z0-9._\-\u4e00-\u9fff]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return safe.length > 0 ? safe : "unknown";
};

const getPayloadString = (
  payload: PendingKnowledgeUpdatePayload,
  fields: readonly string[]
): string | undefined => {
  for (const field of fields) {
    const value = payload[field];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
};

const getPayloadContent = (payload: PendingKnowledgeUpdatePayload): string =>
  getPayloadString(payload, ["content", "summary", "note", "title", "value"]) ??
  JSON.stringify(payload);

const getPayloadSourcePath = (
  payload: PendingKnowledgeUpdatePayload,
  fallback: string
): string => {
  const sourceRef = getPayloadString(payload, [
    "sourceRef",
    "sourcePath",
    "source_path"
  ]);

  if (sourceRef !== undefined) {
    return sourceRef;
  }

  const sourceRefs = payload.sourceRefs;

  if (Array.isArray(sourceRefs)) {
    const first = sourceRefs.find(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0
    );

    if (first !== undefined) {
      return first.trim();
    }
  }

  return fallback;
};

const getPayloadFactType = (
  payload: PendingKnowledgeUpdatePayload,
  fallback: string
): string =>
  getPayloadString(payload, ["factType", "fact_type", "type", "kind"]) ?? fallback;

const getPayloadEntityName = (
  payload: PendingKnowledgeUpdatePayload
): string | undefined =>
  getPayloadString(payload, ["entity", "entityName", "name", "subject", "title"]);

const toIndexedPendingStatus = (
  update: PendingKnowledgeUpdate
): "committed" | "staged" | undefined => {
  if (update.status === "committed") {
    return "committed";
  }

  if (update.status === "staged") {
    return "staged";
  }

  return undefined;
};

const toFactStatus = (status: "committed" | "staged"): "canon" | "staged" =>
  status === "committed" ? "canon" : "staged";

const draftEntityType = (draft: PendingKnowledgeFactDraft): string | undefined => {
  if (draft.type === "character_state") {
    return "character";
  }

  if (draft.type === "location_change") {
    return "location";
  }

  if (draft.type === "item_location") {
    return "item";
  }

  if (draft.type === "ability_rule") {
    return "ability";
  }

  if (draft.type === "unconfirmed_assumption") {
    return "assumption";
  }

  return undefined;
};

const createStructuredFactId = (
  update: PendingKnowledgeUpdate,
  group: string,
  index: number
): string => `knowledge:${createSafeIdPart(update.id)}:${group}:${index}`;

const createEntityRecord = (
  type: string,
  name: string
): StructuredFactRecord["entity"] => ({
  id: `entity:${createSafeIdPart(type)}:${createSafeIdPart(name)}`,
  name,
  type
});

const structuredRecordFromFactDraft = (
  update: PendingKnowledgeUpdate,
  pendingPath: string,
  status: "canon" | "staged",
  draft: PendingKnowledgeFactDraft,
  index: number
): StructuredFactRecord => {
  const sourcePath = draft.sourceRef ?? pendingPath;
  const subject = draft.subject ?? draft.key ?? draft.summary;
  const record: StructuredFactRecord = {
    content: draft.summary,
    factType: draft.type,
    id: createStructuredFactId(update, "factDraft", index),
    sourcePath,
    status
  };
  const entityType = draftEntityType(draft);

  if (entityType !== undefined) {
    record.entity = createEntityRecord(entityType, subject);
  }

  if (draft.type === "timeline_event") {
    record.timeline = {
      eventTime: draft.value ?? null,
      id: `timeline:${createSafeIdPart(update.id)}:${index}`,
      summary: draft.summary,
      title: subject
    };
  }

  if (
    draft.type === "new_foreshadowing" ||
    draft.type === "recovered_foreshadowing"
  ) {
    record.foreshadowing = {
      id: `foreshadowing:${createSafeIdPart(update.id)}:${index}`,
      payoff: draft.type === "recovered_foreshadowing" ? draft.value ?? null : null,
      setup: draft.summary,
      status: draft.type === "recovered_foreshadowing" ? "recovered" : "open"
    };
  }

  return record;
};

const structuredRecordFromPayload = (
  update: PendingKnowledgeUpdate,
  pendingPath: string,
  status: "canon" | "staged",
  payload: PendingKnowledgeUpdatePayload,
  group: "fact" | "entity" | "timeline" | "foreshadowing",
  index: number
): StructuredFactRecord => {
  const content = getPayloadContent(payload);
  const sourcePath = getPayloadSourcePath(payload, pendingPath);
  const factType = getPayloadFactType(payload, `${group}_update`);
  const record: StructuredFactRecord = {
    content,
    factType,
    id: createStructuredFactId(update, group, index),
    sourcePath,
    status
  };

  if (group === "entity") {
    const entityName = getPayloadEntityName(payload) ?? content;
    record.entity = createEntityRecord(
      getPayloadString(payload, ["entityType", "entity_type"]) ?? "entity",
      entityName
    );
  }

  if (group === "timeline") {
    const title = getPayloadString(payload, ["title", "event", "subject"]) ?? content;
    record.timeline = {
      eventTime: getPayloadString(payload, ["eventTime", "time", "date"]) ?? null,
      id: `timeline:${createSafeIdPart(update.id)}:${index}`,
      summary: content,
      title
    };
  }

  if (group === "foreshadowing") {
    record.foreshadowing = {
      id: `foreshadowing:${createSafeIdPart(update.id)}:${index}`,
      payoff: getPayloadString(payload, ["payoff"]) ?? null,
      setup: getPayloadString(payload, ["setup", "summary", "content"]) ?? content,
      status: getPayloadString(payload, ["status"]) ?? "open"
    };
  }

  return record;
};

const readStructuredKnowledge = async (
  cwd: string,
  includeStaged: boolean
): Promise<IndexedStructuredKnowledge> => {
  const records: StructuredFactRecord[] = [];
  const pendingUpdates: IndexedPendingKnowledgeUpdate[] = [];

  for (const id of await listPendingKnowledgeUpdateIds(cwd)) {
    const update = await readPendingKnowledgeUpdate(cwd, id);
    const pendingStatus = toIndexedPendingStatus(update);

    if (
      pendingStatus === undefined ||
      (pendingStatus === "staged" && !includeStaged)
    ) {
      continue;
    }

    const factStatus = toFactStatus(pendingStatus);
    const pendingPath = getPendingKnowledgeUpdateRelativePath(update.id);

    pendingUpdates.push({
      content: JSON.stringify(update),
      id: update.id,
      sourceUnitId: update.unitId,
      status: pendingStatus
    });

    update.factDrafts.forEach((draft, index) => {
      records.push(
        structuredRecordFromFactDraft(update, pendingPath, factStatus, draft, index)
      );
    });
    update.facts.forEach((payload, index) => {
      records.push(
        structuredRecordFromPayload(update, pendingPath, factStatus, payload, "fact", index)
      );
    });
    update.entityUpdates.forEach((payload, index) => {
      records.push(
        structuredRecordFromPayload(
          update,
          pendingPath,
          factStatus,
          payload,
          "entity",
          index
        )
      );
    });
    update.timelineUpdates.forEach((payload, index) => {
      records.push(
        structuredRecordFromPayload(
          update,
          pendingPath,
          factStatus,
          payload,
          "timeline",
          index
        )
      );
    });
    update.foreshadowingUpdates.forEach((payload, index) => {
      records.push(
        structuredRecordFromPayload(
          update,
          pendingPath,
          factStatus,
          payload,
          "foreshadowing",
          index
        )
      );
    });
  }

  return {
    pendingUpdates,
    records
  };
};

export const indexStoryProject = async (
  options: IndexStoryProjectOptions
): Promise<IndexStoryProjectResult> => {
  const databasePath = join(options.cwd, ".storyos", "story.db");
  const includeStaged = options.includeStaged === true;
  const indexedMarkdown = await readIndexableMarkdownFiles(options.cwd, includeStaged);
  const structuredKnowledge = await readStructuredKnowledge(options.cwd, includeStaged);

  initializeStoryDatabase(databasePath);

  return withDatabase(databasePath, (database) => {
    database.exec("BEGIN");

    try {
      const existingRows = database
        .prepare("SELECT source_path FROM facts WHERE id LIKE 'markdown:%'")
        .all() as Array<{ source_path: string }>;
      const currentSourcePaths = new Set(
        indexedMarkdown.files.map((file) => file.sourcePath)
      );
      let removedFiles = 0;

      if (options.rebuild === true) {
        removedFiles = existingRows.length;
        database.prepare("DELETE FROM facts WHERE id LIKE 'markdown:%'").run();
      } else {
        const deleteFact = database.prepare(
          "DELETE FROM facts WHERE id LIKE 'markdown:%' AND source_path = ?"
        );

        for (const row of existingRows) {
          if (!currentSourcePaths.has(row.source_path)) {
            deleteFact.run(row.source_path);
            removedFiles += 1;
          }
        }
      }

      const upsertFact = database.prepare(`
INSERT INTO facts (id, fact_type, content, status, source_path)
VALUES (?, 'markdown', ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  content = excluded.content,
  status = excluded.status,
  source_path = excluded.source_path
`);

      for (const file of indexedMarkdown.files) {
        upsertFact.run(file.id, file.body, file.status, file.sourcePath);
      }

      database.prepare("DELETE FROM facts WHERE id NOT LIKE 'markdown:%'").run();
      database.prepare("DELETE FROM pending_knowledge_updates").run();
      database.prepare("DELETE FROM timeline_events").run();
      database.prepare("DELETE FROM foreshadowing").run();
      database.prepare("DELETE FROM entities").run();

      const upsertPendingKnowledgeUpdate = database.prepare(`
INSERT INTO pending_knowledge_updates (id, source_unit_id, status, content)
VALUES (?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  source_unit_id = excluded.source_unit_id,
  status = excluded.status,
  content = excluded.content
`);
      const upsertEntity = database.prepare(`
INSERT INTO entities (id, type, name, aliases, source_path)
VALUES (?, ?, ?, '[]', ?)
ON CONFLICT(id) DO UPDATE SET
  type = excluded.type,
  name = excluded.name,
  source_path = excluded.source_path,
  updated_at = CURRENT_TIMESTAMP
`);
      const upsertStructuredFact = database.prepare(`
INSERT INTO facts (id, entity_id, fact_type, content, status, source_path)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  entity_id = excluded.entity_id,
  fact_type = excluded.fact_type,
  content = excluded.content,
  status = excluded.status,
  source_path = excluded.source_path
`);
      const upsertTimelineEvent = database.prepare(`
INSERT INTO timeline_events (id, event_time, title, summary, source_path)
VALUES (?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  event_time = excluded.event_time,
  title = excluded.title,
  summary = excluded.summary,
  source_path = excluded.source_path
`);
      const upsertForeshadowing = database.prepare(`
INSERT INTO foreshadowing (id, setup, payoff, status, source_path)
VALUES (?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  setup = excluded.setup,
  payoff = excluded.payoff,
  status = excluded.status,
  source_path = excluded.source_path
`);

      for (const update of structuredKnowledge.pendingUpdates) {
        upsertPendingKnowledgeUpdate.run(
          update.id,
          update.sourceUnitId,
          update.status,
          update.content
        );
      }

      for (const record of structuredKnowledge.records) {
        if (record.entity !== undefined) {
          upsertEntity.run(
            record.entity.id,
            record.entity.type,
            record.entity.name,
            record.sourcePath
          );
        }

        upsertStructuredFact.run(
          record.id,
          record.entity?.id ?? null,
          record.factType,
          record.content,
          record.status,
          record.sourcePath
        );

        if (record.timeline !== undefined) {
          upsertTimelineEvent.run(
            record.timeline.id,
            record.timeline.eventTime,
            record.timeline.title,
            record.timeline.summary,
            record.sourcePath
          );
        }

        if (record.foreshadowing !== undefined) {
          upsertForeshadowing.run(
            record.foreshadowing.id,
            record.foreshadowing.setup,
            record.foreshadowing.payoff,
            record.foreshadowing.status,
            record.sourcePath
          );
        }
      }

      syncFactsFtsIndex(database);

      database
        .prepare(
          "UPDATE search_index_meta SET source_watermark = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1"
        )
        .run(new Date().toISOString());

      database.exec("COMMIT");

      return {
        databasePath,
        includedStatuses: includeStaged ? ["canon", "staged"] : ["canon"],
        indexedFiles: indexedMarkdown.files.length,
        mode: options.rebuild === true ? "rebuild" : "update",
        removedFiles,
        scannedFiles: indexedMarkdown.scannedFiles
      };
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  });
};

const normalizeSearchText = (value: string): string =>
  value.toLocaleLowerCase("zh-CN");

const buildQueryTokens = (query: string): string[] => {
  const normalized = normalizeSearchText(query).trim();
  const tokens = new Set<string>();

  for (const token of normalized.split(/[\s,，。！？?；;：:、]+/)) {
    if (token.length > 0) {
      tokens.add(token);
    }
  }

  const compact = [...normalized.replace(/\s+/g, "")];

  if (compact.length > 0 && compact.length <= 32) {
    tokens.add(compact.join(""));
  }

  for (let index = 0; index < compact.length - 1; index += 1) {
    tokens.add(`${compact[index]}${compact[index + 1]}`);
  }

  return [...tokens].filter((token) => token.length > 0);
};

const extractTitle = (sourcePath: string, body: string): string => {
  const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();

  return heading && heading.length > 0 ? heading : sourcePath;
};

const summarizeBody = (body: string): string => {
  const summary =
    body
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0 && !line.startsWith("#")) ?? "";

  return summary.length > 120 ? `${summary.slice(0, 117)}...` : summary;
};

const augmentSearchText = (value: string): string => {
  const normalized = normalizeSearchText(value);
  const compact = [...normalized.replace(/\s+/g, "")];
  const grams: string[] = [];

  for (let index = 0; index < compact.length - 1; index += 1) {
    grams.push(`${compact[index]}${compact[index + 1]}`);
  }

  return `${value}\n${grams.join(" ")}`;
};

const escapeFtsToken = (token: string): string =>
  `"${token.replace(/"/g, "\"\"")}"`;

const buildFtsQuery = (tokens: readonly string[]): string =>
  tokens.slice(0, 16).map(escapeFtsToken).join(" OR ");

const getRowTitle = (row: SearchableFactRow): string =>
  row.fact_type === "markdown"
    ? extractTitle(row.source_path, row.content)
    : `${row.fact_type}: ${row.source_path}`;

const getMatchReason = (
  factType: string,
  matchedTokens: readonly string[],
  mode: "fallback" | "fts5"
): string => {
  const prefix =
    factType === "markdown" ? "matched" : `matched ${factType}`;
  const suffix = matchedTokens.slice(0, 5).join(", ");

  return mode === "fts5" ? `${prefix} via fts5: ${suffix}` : `${prefix}: ${suffix}`;
};

const isVisibleSearchStatus = (
  status: string,
  includeStaged: boolean | undefined
): boolean => status === "canon" || (status === "staged" && includeStaged === true);

const searchRowsWithTokenFallback = (
  rows: readonly SearchableFactRow[],
  tokens: readonly string[],
  options: SearchStoryIndexOptions
): SearchStoryIndexHit[] => {
  const hits: SearchStoryIndexHit[] = [];

  for (const row of rows) {
    if (!isVisibleSearchStatus(row.status, options.includeStaged)) {
      continue;
    }

    const title = getRowTitle(row);
    const haystack = normalizeSearchText(
      `${row.source_path}\n${title}\n${row.content}`
    );
    const matchedTokens = tokens.filter((token) => haystack.includes(token));

    if (matchedTokens.length === 0) {
      continue;
    }

    hits.push({
      reason: getMatchReason(row.fact_type, matchedTokens, "fallback"),
      score: matchedTokens.reduce((total, token) => total + token.length, 0),
      sourcePath: row.source_path,
      status: row.status,
      summary: summarizeBody(row.content),
      title
    });
  }

  hits.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.sourcePath.localeCompare(right.sourcePath);
  });

  return hits.slice(0, options.limit ?? 10);
};

const factsFtsTableExists = (database: DatabaseSync): boolean => {
  const row = database
    .prepare("SELECT name FROM sqlite_master WHERE name = 'facts_fts'")
    .get() as { name?: string } | undefined;

  return row?.name === "facts_fts";
};

const syncFactsFtsIndex = (database: DatabaseSync): { error?: string; ok: boolean } => {
  try {
    database.exec(`
CREATE VIRTUAL TABLE IF NOT EXISTS facts_fts USING fts5(
  id UNINDEXED,
  title,
  content,
  search_text,
  source_path UNINDEXED,
  status UNINDEXED,
  fact_type UNINDEXED
)
`);
    database.prepare("DELETE FROM facts_fts").run();

    const rows = database
      .prepare("SELECT id, source_path, status, content, fact_type FROM facts")
      .all() as Array<SearchableFactRow & { id: string }>;
    const insertFtsRow = database.prepare(`
INSERT INTO facts_fts (id, title, content, search_text, source_path, status, fact_type)
VALUES (?, ?, ?, ?, ?, ?, ?)
`);

    for (const row of rows) {
      const title = getRowTitle(row);

      insertFtsRow.run(
        row.id,
        title,
        row.content,
        augmentSearchText(`${row.source_path}\n${title}\n${row.content}`),
        row.source_path,
        row.status,
        row.fact_type
      );
    }

    return {
      ok: true
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      ok: false
    };
  }
};

const assertDatabaseExists = async (databasePath: string): Promise<void> => {
  try {
    await access(databasePath);
  } catch (error) {
    if (isMissingPathError(error)) {
      throw new Error("story.db missing; run storyctl index rebuild first.");
    }

    throw error;
  }
};

export const searchStoryIndex = async (
  options: SearchStoryIndexOptions
): Promise<SearchStoryIndexResult> => {
  const databasePath = join(options.cwd, ".storyos", "story.db");
  const tokens = buildQueryTokens(options.query);

  if (tokens.length === 0) {
    return {
      mode: "fallback",
      query: options.query,
      results: []
    };
  }

  await assertDatabaseExists(databasePath);

  return withDatabase(databasePath, (database) => {
    let rows: SearchableFactRow[];

    try {
      rows = database
        .prepare("SELECT source_path, status, content, fact_type FROM facts")
        .all() as SearchableFactRow[];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes("no such table")) {
        throw new Error("story.db missing index tables; run storyctl index rebuild first.");
      }

      throw error;
    }

    const fallbackResults = (fallbackReason: string): SearchStoryIndexResult => ({
      fallbackReason,
      mode: "fallback",
      query: options.query,
      results: searchRowsWithTokenFallback(rows, tokens, options)
    });

    if (!factsFtsTableExists(database)) {
      return fallbackResults("FTS5 index unavailable; run storyctl index rebuild.");
    }

    try {
      const ftsQuery = buildFtsQuery(tokens);
      const ftsRows = database
        .prepare(
          `SELECT source_path, status, content, fact_type, rank
FROM (
  SELECT source_path, status, content, fact_type, bm25(facts_fts) AS rank
  FROM facts_fts
  WHERE facts_fts MATCH ?
)
ORDER BY rank ASC
LIMIT ?`
        )
        .all(ftsQuery, Math.max(options.limit ?? 10, 20)) as Array<
        SearchableFactRow & { rank: number }
      >;
      const hits: SearchStoryIndexHit[] = [];

      for (const row of ftsRows) {
        if (!isVisibleSearchStatus(row.status, options.includeStaged)) {
          continue;
        }

        const title = getRowTitle(row);
        const haystack = normalizeSearchText(
          `${row.source_path}\n${title}\n${row.content}`
        );
        const matchedTokens = tokens.filter((token) => haystack.includes(token));

        if (matchedTokens.length === 0) {
          continue;
        }

        hits.push({
          reason: getMatchReason(row.fact_type, matchedTokens, "fts5"),
          score: -row.rank,
          sourcePath: row.source_path,
          status: row.status,
          summary: summarizeBody(row.content),
          title
        });
      }

      return {
        mode: "fts5",
        query: options.query,
        results: hits.slice(0, options.limit ?? 10)
      };
    } catch (error) {
      return fallbackResults(
        `FTS5 search unavailable: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  });
};

const isKnowledgeBrowserStatus = (
  status: string
): status is KnowledgeBrowserEntryStatus =>
  status === "canon" || status === "staged" || status === "rejected";

const knowledgeBrowserTypeForFact = (
  factType: string,
  sourcePath: string
): KnowledgeBrowserEntryType => {
  if (factType === "character_state") {
    return "character";
  }

  if (factType === "location_change") {
    return "place";
  }

  if (factType === "timeline_event" || factType === "timeline_update") {
    return "timeline";
  }

  if (
    factType === "new_foreshadowing" ||
    factType === "recovered_foreshadowing" ||
    factType === "foreshadowing_update"
  ) {
    return "foreshadowing";
  }

  if (sourcePath.includes("/characters/")) {
    return "character";
  }

  if (sourcePath.includes("/places/") || sourcePath.includes("/locations/")) {
    return "place";
  }

  if (sourcePath.includes("timeline")) {
    return "timeline";
  }

  if (sourcePath.includes("foreshadow")) {
    return "foreshadowing";
  }

  return "fact";
};

const isVisibleKnowledgeBrowserStatus = (
  status: KnowledgeBrowserEntryStatus,
  options: ReadKnowledgeBrowserOptions
): boolean => {
  if (status === "canon") {
    return true;
  }

  if (status === "staged") {
    return options.includeStaged !== false;
  }

  return options.includeRejected !== false;
};

const createKnowledgeBrowserEntry = (
  row: SearchableFactRow
): KnowledgeBrowserEntry | null => {
  if (!isKnowledgeBrowserStatus(row.status)) {
    return null;
  }

  return {
    sourcePath: row.source_path,
    status: row.status,
    summary: summarizeBody(row.content),
    title: getRowTitle(row),
    type: knowledgeBrowserTypeForFact(row.fact_type, row.source_path)
  };
};

const readRejectedMarkdownBrowserEntries = async (
  cwd: string
): Promise<KnowledgeBrowserEntry[]> => {
  const markdownFiles = (
    await Promise.all(
      sourceRootNames.map((rootName) => collectMarkdownFiles(join(cwd, rootName)))
    )
  ).flat();
  const entries: KnowledgeBrowserEntry[] = [];

  for (const filePath of markdownFiles) {
    const markdown = await readFile(filePath, "utf8");
    const parsed = readMarkdownWithFrontMatter(markdown);

    if (getFrontMatterStatus(parsed.frontMatter) !== "rejected") {
      continue;
    }

    const sourcePath = normalizeRelativePath(cwd, filePath);

    entries.push({
      sourcePath,
      status: "rejected",
      summary: summarizeBody(parsed.body),
      title: extractTitle(sourcePath, parsed.body),
      type: knowledgeBrowserTypeForFact("markdown", sourcePath)
    });
  }

  return entries;
};

const matchesKnowledgeBrowserQuery = (
  entry: KnowledgeBrowserEntry,
  tokens: readonly string[]
): boolean => {
  if (tokens.length === 0) {
    return true;
  }

  const haystack = normalizeSearchText(
    `${entry.type}\n${entry.status}\n${entry.title}\n${entry.summary}\n${entry.sourcePath}`
  );

  return tokens.some((token) => haystack.includes(token));
};

const buildKnowledgeBrowserQueryTokens = (query: string): string[] =>
  normalizeSearchText(query)
    .trim()
    .split(/[\s,，。！？?；;：:、]+/)
    .filter((token) => token.length > 0);

const knowledgeBrowserSortKey = (entry: KnowledgeBrowserEntry): string =>
  `${entry.type}\u0000${entry.status}\u0000${entry.sourcePath}`;

export const readKnowledgeBrowser = async (
  options: ReadKnowledgeBrowserOptions
): Promise<KnowledgeBrowserResult> => {
  const databasePath = join(options.cwd, ".storyos", "story.db");
  const query = options.query?.trim() ?? "";
  const tokens = buildKnowledgeBrowserQueryTokens(query);

  await assertDatabaseExists(databasePath);

  const indexedEntries = withDatabase(databasePath, (database) => {
    const rows = database
      .prepare("SELECT source_path, status, content, fact_type FROM facts")
      .all() as SearchableFactRow[];

    return rows
      .map(createKnowledgeBrowserEntry)
      .filter((entry): entry is KnowledgeBrowserEntry => entry !== null);
  });
  const rejectedEntries =
    options.includeRejected === false
      ? []
      : await readRejectedMarkdownBrowserEntries(options.cwd);
  const entriesByKey = new Map<string, KnowledgeBrowserEntry>();

  for (const entry of [...indexedEntries, ...rejectedEntries]) {
    if (!isVisibleKnowledgeBrowserStatus(entry.status, options)) {
      continue;
    }

    if (!matchesKnowledgeBrowserQuery(entry, tokens)) {
      continue;
    }

    entriesByKey.set(`${entry.status}:${entry.sourcePath}:${entry.type}`, entry);
  }

  return {
    entries: [...entriesByKey.values()]
      .sort((left, right) =>
        knowledgeBrowserSortKey(left).localeCompare(knowledgeBrowserSortKey(right))
      )
      .slice(0, options.limit ?? 100),
    includedStatuses: [
      "canon",
      ...(options.includeStaged === false ? [] : (["staged"] as const)),
      ...(options.includeRejected === false ? [] : (["rejected"] as const))
    ],
    query
  };
};

const contextKindForFactType = (
  factType: string
): StructuredStoryContextKind | undefined => {
  if (factType === "character_state") {
    return "character_state";
  }

  if (factType === "item_location") {
    return "item_location";
  }

  if (factType === "timeline_event" || factType === "timeline_update") {
    return "timeline";
  }

  if (
    factType === "new_foreshadowing" ||
    factType === "recovered_foreshadowing" ||
    factType === "foreshadowing_update"
  ) {
    return "foreshadowing";
  }

  return undefined;
};

const structuredContextSourcePath = (kind: StructuredStoryContextKind): string => {
  if (kind === "character_state") {
    return "knowledge/characters/structured-index.md";
  }

  if (kind === "item_location") {
    return "knowledge/items/structured-index.md";
  }

  if (kind === "timeline") {
    return "knowledge/timeline/structured-index.md";
  }

  return "knowledge/foreshadowing/structured-index.md";
};

const structuredContextTitle = (kind: StructuredStoryContextKind): string => {
  if (kind === "character_state") {
    return "Structured character state";
  }

  if (kind === "item_location") {
    return "Structured item locations";
  }

  if (kind === "timeline") {
    return "Structured timeline";
  }

  return "Structured foreshadowing";
};

export const readStructuredStoryContext = async (
  options: ReadStructuredStoryContextOptions
): Promise<StructuredStoryContextSource[]> => {
  const databasePath = join(options.cwd, ".storyos", "story.db");

  await assertDatabaseExists(databasePath);

  return withDatabase(databasePath, (database) => {
    const rows = database
      .prepare(
        "SELECT fact_type, content, status, source_path FROM facts WHERE id NOT LIKE 'markdown:%'"
      )
      .all() as Array<{
      content: string;
      fact_type: string;
      source_path: string;
      status: string;
    }>;
    const groups = new Map<
      StructuredStoryContextKind,
      { items: string[]; status: "canon" | "staged" }
    >();

    for (const row of rows) {
      if (row.status !== "canon" && options.includeStaged !== true) {
        continue;
      }

      const kind = contextKindForFactType(row.fact_type);

      if (kind === undefined) {
        continue;
      }

      const status = row.status === "staged" ? "staged" : "canon";
      const group = groups.get(kind) ?? {
        items: [],
        status
      };

      group.status = group.status === "staged" || status === "staged" ? "staged" : "canon";
      group.items.push(`${row.content} (source: ${row.source_path})`);
      groups.set(kind, group);
    }

    return [...groups.entries()].map(([kind, group]) => ({
      kind,
      sourcePath: structuredContextSourcePath(kind),
      status: group.status,
      summary: group.items.slice(0, 5).join(" | "),
      title: structuredContextTitle(kind)
    }));
  });
};
