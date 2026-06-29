import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  commitPendingKnowledgeUpdate,
  createPendingKnowledgeUpdate,
  getPendingKnowledgeUpdateRelativePath,
  listPendingKnowledgeUpdateIds,
  readPendingKnowledgeUpdate,
  rejectPendingKnowledgeUpdate,
  validatePendingKnowledgeUpdate,
  writePendingKnowledgeUpdate
} from "./index.ts";

const createTempDir = async () => mkdtemp(join(tmpdir(), "storyos-pending-"));

describe("PendingKnowledgeUpdate", () => {
  it("creates, writes, lists, and reads a staged update", async () => {
    const cwd = await createTempDir();

    try {
      const update = createPendingKnowledgeUpdate({
        createdAt: "2026-06-28T00:00:00.000Z",
        factDrafts: [
          {
            confidence: "high",
            key: "location",
            sourceRef: "outputs/chapters/chapter-0001.md#p2",
            subject: "Mara",
            summary: "Mara moves from the market to the archive.",
            type: "character_state",
            value: "archive"
          },
          {
            summary: "The silver key is shown but not explained.",
            type: "new_foreshadowing"
          }
        ],
        facts: [
          {
            content: "The placeholder chapter is still under review.",
            sourceRef: "outputs/chapters/chapter-0001.md"
          }
        ],
        id: "pending-run-1",
        sourceRunId: "run-1",
        unitId: "chapter-0001"
      });

      assert.equal(update.status, "staged");
      assert.equal(update.factDrafts.length, 2);
      assert.equal(update.factDrafts[0].type, "character_state");
      assert.equal(update.factDrafts[1].type, "new_foreshadowing");
      assert.deepEqual(update.entityUpdates, []);
      assert.deepEqual(update.timelineUpdates, []);
      assert.deepEqual(update.foreshadowingUpdates, []);

      const relativePath = await writePendingKnowledgeUpdate(cwd, update);

      assert.equal(
        relativePath,
        ".storyos/pending-knowledge-updates/pending-run-1.json"
      );
      assert.equal(getPendingKnowledgeUpdateRelativePath(update.id), relativePath);
      assert.deepEqual(await listPendingKnowledgeUpdateIds(cwd), ["pending-run-1"]);
      assert.deepEqual(await readPendingKnowledgeUpdate(cwd, update.id), update);

      const rawJson = await readFile(join(cwd, relativePath), "utf8");
      assert.match(rawJson, /"status": "staged"/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("represents future approve and reject outcomes as state transitions", () => {
    const staged = createPendingKnowledgeUpdate({
      createdAt: "2026-06-28T00:00:00.000Z",
      sourceRunId: "run-2",
      unitId: "chapter-0002"
    });

    const committed = commitPendingKnowledgeUpdate(
      staged,
      "2026-06-28T00:01:00.000Z"
    );
    const rejected = rejectPendingKnowledgeUpdate(
      staged,
      "2026-06-28T00:02:00.000Z"
    );

    assert.equal(committed.status, "committed");
    assert.deepEqual(committed.factDrafts, staged.factDrafts);
    assert.equal(committed.committedAt, "2026-06-28T00:01:00.000Z");
    assert.equal("rejectedAt" in committed, false);
    assert.equal(rejected.status, "rejected");
    assert.deepEqual(rejected.factDrafts, staged.factDrafts);
    assert.equal(rejected.rejectedAt, "2026-06-28T00:02:00.000Z");
    assert.equal("committedAt" in rejected, false);
    assert.throws(
      () => commitPendingKnowledgeUpdate(committed, "2026-06-28T00:03:00.000Z"),
      /must be staged/
    );
  });

  it("reads pending update JSON with a UTF-8 BOM", async () => {
    const cwd = await createTempDir();

    try {
      const update = createPendingKnowledgeUpdate({
        createdAt: "2026-06-28T00:00:00.000Z",
        id: "pending-bom",
        sourceRunId: "run-bom",
        unitId: "chapter-bom"
      });

      await writePendingKnowledgeUpdate(cwd, update);
      await writeFile(
        join(cwd, ".storyos", "pending-knowledge-updates", "pending-bom.json"),
        `\uFEFF${JSON.stringify(update, null, 2)}\n`,
        "utf8"
      );

      assert.deepEqual(await readPendingKnowledgeUpdate(cwd, update.id), update);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("rejects malformed pending update records", () => {
    assert.throws(
      () =>
        validatePendingKnowledgeUpdate({
          createdAt: "2026-06-28T00:00:00.000Z",
          entityUpdates: [],
          facts: [],
          foreshadowingUpdates: [],
          id: "../bad",
          sourceRunId: "run-3",
          status: "staged",
          timelineUpdates: [],
          unitId: "chapter-0003"
        }),
      /path separators/
    );
    assert.throws(
      () =>
        validatePendingKnowledgeUpdate({
          createdAt: "2026-06-28T00:00:00.000Z",
          entityUpdates: [],
          factDrafts: [
            {
              summary: "Bad type.",
              type: "mystery"
            }
          ],
          facts: [],
          foreshadowingUpdates: [],
          id: "pending-run-4",
          sourceRunId: "run-4",
          status: "staged",
          timelineUpdates: [],
          unitId: "chapter-0004"
        }),
      /FactDraft.type/
    );
    assert.throws(
      () =>
        validatePendingKnowledgeUpdate({
          createdAt: "2026-06-28T00:00:00.000Z",
          entityUpdates: [],
          facts: [],
          foreshadowingUpdates: [],
          id: "pending-run-3",
          sourceRunId: "run-3",
          status: "canon",
          timelineUpdates: [],
          unitId: "chapter-0003"
        }),
      /status/
    );
  });
});
