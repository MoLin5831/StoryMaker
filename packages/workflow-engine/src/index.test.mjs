import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  CHECKPOINTS_RELATIVE_DIR,
  PRODUCTION_RUNS_RELATIVE_DIR,
  WORKFLOW_STATE_RELATIVE_PATH,
  CheckpointFileError,
  ProductionRunFileError,
  WorkflowStateFileError,
  createAndWriteCheckpoint,
  createCheckpoint,
  createDefaultWorkflowState,
  createNextWorkUnit,
  createWorkUnit,
  formatWorkUnitDisplayTitle,
  formatWorkUnitNumber,
  getCheckpointFilePath,
  getProductionRunFilePath,
  listCheckpointIds,
  listProductionRunIds,
  readCheckpoint,
  readCheckpointFile,
  readLatestProductionRun,
  readProductionRun,
  readProductionRunFile,
  readRecentCheckpoints,
  readWorkflowState,
  readWorkflowStateFile,
  sanitizeFilenameTitle,
  validateCheckpoint,
  validateProductionRun,
  validateWorkUnit,
  validateWorkflowState,
  writeCheckpoint,
  writeCheckpointFile,
  writeProductionRun,
  writeProductionRunFile,
  writeWorkflowState,
  writeWorkflowStateFile
} from "./index.ts";

const createTempDir = async () => mkdtemp(join(tmpdir(), "storyos-workflow-"));

describe("WorkUnit creation helpers", () => {
  it("formats chapter numbers and display titles with four digits", () => {
    assert.equal(formatWorkUnitNumber(0), "0001");
    assert.equal(formatWorkUnitNumber(22), "0023");
    assert.equal(
      formatWorkUnitDisplayTitle({
        index: 0,
        title: "雨夜来客",
        type: "chapter"
      }),
      "第 0001 章 雨夜来客"
    );
  });

  it("creates a planned chapter WorkUnit with safe filenameTitle", () => {
    const workUnit = createWorkUnit({
      index: 0,
      title: '雨夜: 来客 / "失控"?*',
      type: "chapter"
    });

    assert.equal(workUnit.id, "chapter-0001");
    assert.equal(workUnit.index, 0);
    assert.equal(workUnit.status, "planned");
    assert.equal(workUnit.displayTitle, '第 0001 章 雨夜: 来客 / "失控"?*');
    assert.equal(workUnit.filenameTitle, "第 0001 章 雨夜- 来客 - -失控-");
    assert.deepEqual(validateWorkUnit(workUnit), workUnit);
  });

  it("sanitizes empty trailing and overlong filename titles", () => {
    assert.equal(sanitizeFilenameTitle("  ...  "), "untitled");
    assert.equal(sanitizeFilenameTitle("chapter. "), "chapter");
    assert.equal(
      sanitizeFilenameTitle("a".repeat(120), {
        maxLength: 12
      }),
      "a".repeat(12)
    );
  });

  it("creates the next WorkUnit index by type", () => {
    const existingUnits = [
      createWorkUnit({
        index: 0,
        title: "第一章",
        type: "chapter"
      }),
      createWorkUnit({
        index: 3,
        title: "第四章",
        type: "chapter"
      }),
      createWorkUnit({
        index: 0,
        title: "第一场",
        type: "scene"
      })
    ];

    const nextChapter = createNextWorkUnit({
      existingUnits,
      title: "第五章",
      type: "chapter"
    });

    assert.equal(nextChapter.index, 4);
    assert.equal(nextChapter.id, "chapter-0005");
    assert.equal(nextChapter.displayTitle, "第 0005 章 第五章");
  });

  it("adds a short id when filenameTitle collides", () => {
    const existing = createWorkUnit({
      index: 0,
      title: "同名标题",
      type: "chapter"
    });
    const colliding = createWorkUnit({
      existingUnits: [existing],
      index: 0,
      title: "同名标题",
      type: "chapter"
    });

    assert.equal(existing.filenameTitle, "第 0001 章 同名标题");
    assert.match(colliding.filenameTitle ?? "", /^第 0001 章 同名标题-[a-z0-9]{6}$/);
  });
});

describe("WorkflowState file IO", () => {
  it("validates pending review state fields", () => {
    const parsed = validateWorkflowState({
      currentUnitId: "unit-23",
      stagedOutputFile: "outputs/chapters/第0023章 雨夜来客.md",
      status: "awaiting_user_review",
      updatedAt: "2026-06-28T00:00:00Z"
    });

    assert.equal(parsed.status, "awaiting_user_review");
    assert.equal(parsed.currentUnitId, "unit-23");
  });

  it("writes atomically and reads workflow-state.json", async () => {
    const cwd = await createTempDir();
    const filePath = join(cwd, ".storyos", "workflow-state.json");

    try {
      const state = {
        currentUnitId: "unit-23",
        stagedOutputFile: "outputs/chapters/第0023章 雨夜来客.md",
        status: "awaiting_user_review",
        updatedAt: "2026-06-28T00:00:00Z"
      };

      await writeWorkflowStateFile(filePath, state);

      assert.deepEqual(await readWorkflowStateFile(filePath), state);
      assert.match(await readFile(filePath, "utf8"), /awaiting_user_review/);
      assert.deepEqual(
        (await readdir(join(cwd, ".storyos"))).filter((entry) =>
          entry.endsWith(".tmp")
        ),
        []
      );
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("uses the project root helper path", async () => {
    const cwd = await createTempDir();

    try {
      const state = createDefaultWorkflowState("2026-06-28T00:00:00Z");

      await writeWorkflowState(cwd, state);

      assert.deepEqual(await readWorkflowState(cwd), state);
      assert.match(WORKFLOW_STATE_RELATIVE_PATH, /workflow-state\.json/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("returns an idle default when workflow-state.json is missing", async () => {
    const cwd = await createTempDir();

    try {
      assert.deepEqual(await readWorkflowState(cwd, {
        now: "2026-06-28T00:00:00Z"
      }), {
        status: "idle",
        updatedAt: "2026-06-28T00:00:00Z"
      });
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("throws recovery guidance for damaged JSON", async () => {
    const cwd = await createTempDir();
    const filePath = join(cwd, ".storyos", "workflow-state.json");

    try {
      await mkdir(join(cwd, ".storyos"), {
        recursive: true
      });
      await writeFile(filePath, "{not json", "utf8");

      await assert.rejects(
        () => readWorkflowStateFile(filePath),
        (error) =>
          error instanceof WorkflowStateFileError &&
          /Recovery suggestion/.test(error.message) &&
          /workflow-state\.json/.test(error.recoverySuggestion)
      );
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });
});

describe("ProductionRun file IO", () => {
  it("validates and persists step status error and report fields", async () => {
    const cwd = await createTempDir();
    const filePath = join(cwd, ".storyos", "runs", "run-001.json");

    try {
      const run = {
        id: "run-001",
        reportFile: "reviews/run-001.md",
        startedAt: "2026-06-28T00:00:00Z",
        status: "failed",
        steps: [
          {
            endedAt: "2026-06-28T00:00:01Z",
            id: "search_context",
            name: "Search context",
            startedAt: "2026-06-28T00:00:00Z",
            status: "completed"
          },
          {
            error: "Quality gate failed",
            id: "review",
            name: "Review",
            reportFile: "reviews/run-001-review.md",
            startedAt: "2026-06-28T00:00:02Z",
            status: "failed"
          }
        ],
        unitId: "unit-23"
      };

      assert.deepEqual(validateProductionRun(run), run);
      await writeProductionRunFile(filePath, run);

      const persisted = await readProductionRunFile(filePath);

      assert.deepEqual(persisted, run);
      assert.equal(persisted.steps[1].status, "failed");
      assert.equal(persisted.steps[1].error, "Quality gate failed");
      assert.equal(persisted.steps[1].reportFile, "reviews/run-001-review.md");
      assert.equal(persisted.reportFile, "reviews/run-001.md");
      assert.deepEqual(
        (await readdir(join(cwd, ".storyos", "runs"))).filter((entry) =>
          entry.endsWith(".tmp")
        ),
        []
      );
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("uses project root helpers and finds the latest run after interruption", async () => {
    const cwd = await createTempDir();

    try {
      const olderRun = {
        id: "run-older",
        startedAt: "2026-06-28T00:00:00Z",
        status: "running",
        steps: [
          {
            id: "draft",
            name: "Draft",
            status: "running"
          }
        ]
      };
      const latestRun = {
        id: "run-latest",
        reportFile: "reviews/run-latest.md",
        startedAt: "2026-06-28T00:05:00Z",
        status: "failed",
        steps: [
          {
            error: "Model call interrupted",
            id: "draft",
            name: "Draft",
            reportFile: "reviews/run-latest-draft.md",
            status: "failed"
          }
        ]
      };

      await writeProductionRun(cwd, olderRun);
      await writeProductionRun(cwd, latestRun);

      assert.deepEqual(await readProductionRun(cwd, "run-latest"), latestRun);
      assert.deepEqual(await readLatestProductionRun(cwd), latestRun);
      assert.deepEqual(await listProductionRunIds(cwd), ["run-latest", "run-older"]);
      assert.match(PRODUCTION_RUNS_RELATIVE_DIR, /runs/);
      assert.match(getProductionRunFilePath(cwd, "run-latest"), /run-latest\.json$/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("returns no latest run when the runs directory is missing", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal(await readLatestProductionRun(cwd), undefined);
      assert.deepEqual(await listProductionRunIds(cwd), []);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("throws recovery guidance for damaged run JSON", async () => {
    const cwd = await createTempDir();
    const filePath = join(cwd, ".storyos", "runs", "run-damaged.json");

    try {
      await mkdir(join(cwd, ".storyos", "runs"), {
        recursive: true
      });
      await writeFile(filePath, "{not json", "utf8");

      await assert.rejects(
        () => readProductionRunFile(filePath),
        (error) =>
          error instanceof ProductionRunFileError &&
          /Recovery suggestion/.test(error.message) &&
          /runs/.test(error.recoverySuggestion)
      );
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });
});

describe("Checkpoint file IO", () => {
  it("creates and persists an approve checkpoint", async () => {
    const cwd = await createTempDir();

    try {
      const checkpoint = createCheckpoint({
        createdAt: "2026-06-28T00:00:00Z",
        note: "approved unit-23",
        reason: "approve",
        workflowState: {
          currentUnitId: "unit-24",
          status: "ready_to_produce",
          updatedAt: "2026-06-28T00:00:00Z"
        }
      });

      assert.equal(checkpoint.id, "2026-06-28T00-00-00Z");
      assert.deepEqual(validateCheckpoint(checkpoint), checkpoint);

      await writeCheckpoint(cwd, checkpoint);

      const persisted = await readCheckpoint(cwd, checkpoint.id);

      assert.deepEqual(persisted, checkpoint);
      assert.equal(persisted.reason, "approve");
      assert.equal(persisted.workflowState?.currentUnitId, "unit-24");
      assert.match(CHECKPOINTS_RELATIVE_DIR, /checkpoints/);
      assert.match(getCheckpointFilePath(cwd, checkpoint.id), /checkpoints/);
      assert.deepEqual(
        (await readdir(join(cwd, ".storyos", "checkpoints"))).filter((entry) =>
          entry.endsWith(".tmp")
        ),
        []
      );
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("creates replan checkpoints and lists recent checkpoints", async () => {
    const cwd = await createTempDir();

    try {
      const olderCheckpoint = createCheckpoint({
        createdAt: "2026-06-28T00:00:00Z",
        id: "older-checkpoint",
        reason: "replan",
        workflowState: {
          status: "blocked",
          updatedAt: "2026-06-28T00:00:00Z"
        }
      });
      const latestCheckpoint = createCheckpoint({
        createdAt: "2026-06-28T00:05:00Z",
        id: "latest-checkpoint",
        note: "new rolling plan accepted",
        reason: "replan",
        workflowState: {
          status: "ready_to_produce",
          updatedAt: "2026-06-28T00:05:00Z"
        }
      });

      await createAndWriteCheckpoint(cwd, olderCheckpoint);
      await writeCheckpointFile(
        getCheckpointFilePath(cwd, latestCheckpoint.id),
        latestCheckpoint
      );

      assert.deepEqual(await listCheckpointIds(cwd), [
        "latest-checkpoint",
        "older-checkpoint"
      ]);
      assert.deepEqual(await readRecentCheckpoints(cwd, { limit: 1 }), [
        latestCheckpoint
      ]);
      assert.deepEqual(await readCheckpoint(cwd, "latest-checkpoint"), latestCheckpoint);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("returns no recent checkpoints when the checkpoints directory is missing", async () => {
    const cwd = await createTempDir();

    try {
      assert.deepEqual(await readRecentCheckpoints(cwd), []);
      assert.deepEqual(await listCheckpointIds(cwd), []);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("throws recovery guidance for damaged checkpoint JSON", async () => {
    const cwd = await createTempDir();
    const filePath = join(cwd, ".storyos", "checkpoints", "damaged.json");

    try {
      await mkdir(join(cwd, ".storyos", "checkpoints"), {
        recursive: true
      });
      await writeFile(filePath, "{not json", "utf8");

      await assert.rejects(
        () => readCheckpointFile(filePath),
        (error) =>
          error instanceof CheckpointFileError &&
          /Recovery suggestion/.test(error.message) &&
          /checkpoints/.test(error.recoverySuggestion)
      );
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });
});
