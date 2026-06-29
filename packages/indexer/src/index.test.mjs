import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import {
  STORYOS_DATABASE_VERSION,
  getStoryDatabaseVersion,
  indexStoryProject,
  initializeStoryDatabase,
  readKnowledgeBrowser,
  searchStoryIndex
} from "./index.ts";

const createTempDir = async () => mkdtemp(join(tmpdir(), "storyos-indexer-"));

const listTables = (databasePath) => {
  const database = new DatabaseSync(databasePath);

  try {
    return database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
      )
      .all()
      .map((row) => row.name);
  } finally {
    database.close();
  }
};

const listIndexedFacts = (databasePath) => {
  const database = new DatabaseSync(databasePath);

  try {
    return database
      .prepare(
        "SELECT source_path, status FROM facts WHERE id LIKE 'markdown:%' ORDER BY source_path"
      )
      .all()
      .map((row) => ({
        source_path: row.source_path,
        status: row.status
      }));
  } finally {
    database.close();
  }
};

const writeMarkdown = async (cwd, relativePath, status, body) => {
  const filePath = join(cwd, relativePath);
  const directoryPath = filePath.slice(0, filePath.lastIndexOf("\\"));

  await mkdir(directoryPath, {
    recursive: true
  });
  await writeFile(
    filePath,
    `---\nstatus: "${status}"\n---\n${body}`,
    "utf8"
  );
};

const writePendingKnowledgeUpdate = async (cwd, update) => {
  const directoryPath = join(cwd, ".storyos", "pending-knowledge-updates");

  await mkdir(directoryPath, {
    recursive: true
  });
  await writeFile(
    join(directoryPath, `${update.id}.json`),
    `${JSON.stringify(update, null, 2)}\n`,
    "utf8"
  );
};

describe("StoryOS database migrations", () => {
  it("initializes a queryable SQLite database with a schema version", async () => {
    const cwd = await createTempDir();
    const databasePath = join(cwd, "story.db");

    try {
      const info = initializeStoryDatabase(databasePath);

      assert.deepEqual(info, {
        path: databasePath,
        version: STORYOS_DATABASE_VERSION
      });
      assert.equal(getStoryDatabaseVersion(databasePath), STORYOS_DATABASE_VERSION);
      assert.deepEqual(listTables(databasePath), [
        "entities",
        "facts",
        "foreshadowing",
        "pending_knowledge_updates",
        "production_runs",
        "quality_reports",
        "search_index_meta",
        "storyos_meta",
        "timeline_events",
        "work_units"
      ]);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("can run migrations more than once", async () => {
    const cwd = await createTempDir();
    const databasePath = join(cwd, "story.db");

    try {
      initializeStoryDatabase(databasePath);
      initializeStoryDatabase(databasePath);

      assert.equal(getStoryDatabaseVersion(databasePath), STORYOS_DATABASE_VERSION);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("indexes canon Markdown by default and staged Markdown when requested", async () => {
    const cwd = await createTempDir();
    const databasePath = join(cwd, ".storyos", "story.db");

    try {
      await mkdir(join(cwd, ".storyos"), {
        recursive: true
      });
      initializeStoryDatabase(databasePath);
      await writeMarkdown(cwd, join("knowledge", "canon.md"), "canon", "# Canon\n");
      await writeMarkdown(cwd, join("knowledge", "staged.md"), "staged", "# Staged\n");

      const defaultResult = await indexStoryProject({ cwd });

      assert.equal(defaultResult.scannedFiles, 2);
      assert.equal(defaultResult.indexedFiles, 1);
      assert.deepEqual(listIndexedFacts(databasePath), [
        {
          source_path: "knowledge/canon.md",
          status: "canon"
        }
      ]);

      const stagedResult = await indexStoryProject({
        cwd,
        includeStaged: true
      });

      assert.equal(stagedResult.indexedFiles, 2);
      assert.deepEqual(listIndexedFacts(databasePath), [
        {
          source_path: "knowledge/canon.md",
          status: "canon"
        },
        {
          source_path: "knowledge/staged.md",
          status: "staged"
        }
      ]);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("rebuilds the index and removes records for deleted Markdown files", async () => {
    const cwd = await createTempDir();
    const databasePath = join(cwd, ".storyos", "story.db");
    const firstFile = join(cwd, "knowledge", "first.md");

    try {
      await mkdir(join(cwd, ".storyos"), {
        recursive: true
      });
      initializeStoryDatabase(databasePath);
      await writeMarkdown(cwd, join("knowledge", "first.md"), "canon", "# First\n");
      await indexStoryProject({ cwd });

      await rm(firstFile, {
        force: true
      });
      await writeMarkdown(cwd, join("knowledge", "second.md"), "canon", "# Second\n");

      const result = await indexStoryProject({
        cwd,
        rebuild: true
      });

      assert.equal(result.mode, "rebuild");
      assert.deepEqual(listIndexedFacts(databasePath), [
        {
          source_path: "knowledge/second.md",
          status: "canon"
        }
      ]);

      const deletedResult = await searchStoryIndex({
        cwd,
        query: "First"
      });
      assert.equal(deletedResult.mode, "fts5");
      assert.equal(deletedResult.results.length, 0);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("builds a FTS5 table and uses ranked search", async () => {
    const cwd = await createTempDir();
    const databasePath = join(cwd, ".storyos", "story.db");

    try {
      await mkdir(join(cwd, ".storyos"), {
        recursive: true
      });
      initializeStoryDatabase(databasePath);
      await writeMarkdown(
        cwd,
        join("knowledge", "weak.md"),
        "canon",
        "# Weak\nsilver clue only.\n"
      );
      await writeMarkdown(
        cwd,
        join("knowledge", "strong.md"),
        "canon",
        "# Strong\nsilver key gate silver key gate.\n"
      );
      await indexStoryProject({
        cwd,
        rebuild: true
      });

      assert.ok(listTables(databasePath).includes("facts_fts"));

      const result = await searchStoryIndex({
        cwd,
        query: "silver key gate"
      });

      assert.equal(result.mode, "fts5");
      assert.equal(result.results[0].sourcePath, "knowledge/strong.md");
      assert.match(result.results[0].reason, /via fts5/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("searches indexed roles, places, foreshadowing, and chapters", async () => {
    const cwd = await createTempDir();
    const databasePath = join(cwd, ".storyos", "story.db");

    try {
      await mkdir(join(cwd, ".storyos"), {
        recursive: true
      });
      initializeStoryDatabase(databasePath);
      await writeMarkdown(cwd, join("knowledge", "role.md"), "canon", "# 林夏\n主角林夏知道银钥匙的秘密。\n");
      await writeMarkdown(cwd, join("knowledge", "place.md"), "canon", "# 雾港\n地点雾港藏着旧灯塔。\n");
      await writeMarkdown(cwd, join("knowledge", "foreshadow.md"), "canon", "# 银钥匙\n伏笔银钥匙会打开地下室。\n");
      await writeMarkdown(cwd, join("units", "chapter-007.md"), "canon", "# 第七章 雾港回声\n章节里主角进入旧灯塔。\n");
      await indexStoryProject({ cwd });

      assert.equal((await searchStoryIndex({ cwd, query: "林夏" })).results[0].sourcePath, "knowledge/role.md");
      assert.equal((await searchStoryIndex({ cwd, query: "雾港" })).results[0].sourcePath, "knowledge/place.md");
      assert.equal((await searchStoryIndex({ cwd, query: "银钥匙" })).results[0].sourcePath, "knowledge/foreshadow.md");
      assert.equal((await searchStoryIndex({ cwd, query: "第七章" })).results[0].sourcePath, "units/chapter-007.md");

      const secretResult = await searchStoryIndex({
        cwd,
        query: "主角现在知道哪些秘密"
      });

      assert.equal(secretResult.results[0].sourcePath, "knowledge/role.md");
      assert.equal(secretResult.results[0].title, "林夏");
      assert.match(secretResult.results[0].summary, /银钥匙/);
      assert.match(secretResult.results[0].reason, /matched.*:/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("filters staged search rows unless explicitly requested", async () => {
    const cwd = await createTempDir();
    const databasePath = join(cwd, ".storyos", "story.db");

    try {
      await mkdir(join(cwd, ".storyos"), {
        recursive: true
      });
      initializeStoryDatabase(databasePath);
      await writeMarkdown(
        cwd,
        join("knowledge", "canon.md"),
        "canon",
        "# Canon\napproved lighthouse fact.\n"
      );
      await writeMarkdown(
        cwd,
        join("outputs", "chapters", "draft.md"),
        "staged",
        "# Draft\nstaged-only zzqxjv clue.\n"
      );
      await indexStoryProject({
        cwd,
        includeStaged: true,
        rebuild: true
      });

      const defaultResult = await searchStoryIndex({
        cwd,
        query: "zzqxjv"
      });
      assert.equal(defaultResult.results.length, 0);

      const stagedResult = await searchStoryIndex({
        cwd,
        includeStaged: true,
        query: "zzqxjv"
      });
      assert.equal(stagedResult.results[0].sourcePath, "outputs/chapters/draft.md");
      assert.equal(stagedResult.results[0].status, "staged");
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("writes structured knowledge rows and searches by match type", async () => {
    const cwd = await createTempDir();
    const databasePath = join(cwd, ".storyos", "story.db");

    try {
      await mkdir(join(cwd, ".storyos"), {
        recursive: true
      });
      initializeStoryDatabase(databasePath);
      await writePendingKnowledgeUpdate(cwd, {
        createdAt: "2026-06-28T00:00:00.000Z",
        entityUpdates: [],
        factDrafts: [
          {
            sourceRef: "outputs/chapters/chapter-0001.md",
            subject: "Mira",
            summary: "Mira trusts the clockmaker after the bridge scene.",
            type: "character_state"
          },
          {
            sourceRef: "outputs/chapters/chapter-0001.md",
            subject: "Midnight bell",
            summary: "The midnight bell rings before the harbor fire.",
            type: "timeline_event",
            value: "Day 3 midnight"
          },
          {
            key: "silver-key",
            sourceRef: "outputs/chapters/chapter-0001.md",
            summary: "The silver key flashes under the rain grate.",
            type: "new_foreshadowing"
          },
          {
            sourceRef: "outputs/chapters/chapter-0001.md",
            subject: "Harbor",
            summary: "The harbor is flooded after the storm wall breaks.",
            type: "location_change"
          }
        ],
        facts: [],
        foreshadowingUpdates: [],
        id: "pending-run-structured",
        sourceRunId: "run-structured",
        status: "committed",
        timelineUpdates: [],
        unitId: "chapter-0001"
      });

      await indexStoryProject({
        cwd,
        rebuild: true
      });

      const database = new DatabaseSync(databasePath);

      try {
        assert.equal(
          database
            .prepare("SELECT COUNT(*) AS count FROM entities")
            .get().count,
          2
        );
        assert.equal(
          database
            .prepare("SELECT COUNT(*) AS count FROM timeline_events")
            .get().count,
          1
        );
        assert.equal(
          database
            .prepare("SELECT COUNT(*) AS count FROM foreshadowing")
            .get().count,
          1
        );
      } finally {
        database.close();
      }

      const characterResult = await searchStoryIndex({
        cwd,
        query: "clockmaker"
      });
      assert.equal(characterResult.results[0].sourcePath, "outputs/chapters/chapter-0001.md");
      assert.match(characterResult.results[0].reason, /character_state/);

      const timelineResult = await searchStoryIndex({
        cwd,
        query: "harbor fire"
      });
      assert.match(timelineResult.results[0].reason, /timeline_event/);

      const foreshadowingResult = await searchStoryIndex({
        cwd,
        query: "silver key rain"
      });
      assert.match(foreshadowingResult.results[0].reason, /new_foreshadowing/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("reads knowledge browser entries by type search and status", async () => {
    const cwd = await createTempDir();
    const databasePath = join(cwd, ".storyos", "story.db");

    try {
      await mkdir(join(cwd, ".storyos"), {
        recursive: true
      });
      initializeStoryDatabase(databasePath);
      await writePendingKnowledgeUpdate(cwd, {
        createdAt: "2026-06-28T00:00:00.000Z",
        entityUpdates: [],
        factDrafts: [
          {
            sourceRef: "outputs/chapters/chapter-0001.md",
            subject: "Mira",
            summary: "Mira trusts the clockmaker after the bridge scene.",
            type: "character_state"
          },
          {
            sourceRef: "outputs/chapters/chapter-0001.md",
            subject: "Harbor fire",
            summary: "Harbor fire happens after the midnight bell.",
            type: "timeline_event"
          },
          {
            key: "silver-key",
            sourceRef: "outputs/chapters/chapter-0001.md",
            summary: "Silver key must pay off under the old tower.",
            type: "new_foreshadowing"
          }
        ],
        facts: [],
        foreshadowingUpdates: [],
        id: "pending-browser-canon",
        sourceRunId: "run-browser",
        status: "committed",
        timelineUpdates: [],
        unitId: "chapter-0001"
      });
      await writeMarkdown(
        cwd,
        join("knowledge", "places", "harbor.md"),
        "canon",
        "# Harbor\nFoggy harbor is a canon place.\n"
      );
      await writeMarkdown(
        cwd,
        join("outputs", "chapters", "draft.md"),
        "staged",
        "# Draft\nStaged comet clue waits for approval.\n"
      );
      await writeMarkdown(
        cwd,
        join("outputs", "revisions", "chapter-0001", "rejected.md"),
        "rejected",
        "# Rejected Draft\nRejected bridge version should stay visible but read-only.\n"
      );
      await indexStoryProject({
        cwd,
        includeStaged: true,
        rebuild: true
      });

      const browser = await readKnowledgeBrowser({
        cwd
      });
      const statuses = new Set(browser.entries.map((entry) => entry.status));
      const types = new Set(browser.entries.map((entry) => entry.type));

      assert.deepEqual(browser.includedStatuses, ["canon", "staged", "rejected"]);
      assert.ok(statuses.has("canon"));
      assert.ok(statuses.has("staged"));
      assert.ok(statuses.has("rejected"));
      assert.ok(types.has("character"));
      assert.ok(types.has("place"));
      assert.ok(types.has("timeline"));
      assert.ok(types.has("foreshadowing"));

      const search = await readKnowledgeBrowser({
        cwd,
        query: "comet"
      });

      assert.equal(search.entries.length, 1);
      assert.equal(search.entries[0].status, "staged");
      assert.equal(search.entries[0].sourcePath, "outputs/chapters/draft.md");

      const rejected = await readKnowledgeBrowser({
        cwd,
        query: "rejected bridge"
      });
      const rejectedEntry = rejected.entries.find(
        (entry) => entry.status === "rejected"
      );

      assert.ok(rejectedEntry);
      assert.equal(
        rejectedEntry.sourcePath,
        "outputs/revisions/chapter-0001/rejected.md"
      );
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("asks for an index rebuild when story.db is missing", async () => {
    const cwd = await createTempDir();

    try {
      await assert.rejects(
        () => searchStoryIndex({ cwd, query: "主角" }),
        /storyctl index rebuild/
      );
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });
});
