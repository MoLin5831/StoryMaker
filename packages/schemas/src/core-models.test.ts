import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DailyIntentValues } from "@storyos/core";

import {
  CheckpointSchema,
  DailyIntentSchema,
  PendingKnowledgeUpdateSchema,
  WorkflowStateSchema,
  WorkUnitSchema
} from "./core-models.js";

describe("WorkUnitSchema", () => {
  it("requires title and displayTitle", () => {
    const result = WorkUnitSchema.safeParse({
      id: "unit-1",
      type: "chapter",
      index: 1,
      status: "planned"
    });

    assert.equal(result.success, false);
  });

  it("supports output file fields and review statuses", () => {
    for (const status of [
      "awaiting_user_review",
      "rejected",
      "approved_pending_kb_commit",
      "final"
    ]) {
      const parsed = WorkUnitSchema.parse({
        id: `unit-${status}`,
        type: "chapter",
        index: 1,
        title: "雨夜来客",
        displayTitle: "第0001章 雨夜来客",
        status,
        outputFile: "outputs/chapters/第0001章 雨夜来客.md",
        stagedOutputFile: "outputs/chapters/.staged/第0001章 雨夜来客.md",
        revisionDir: "units/chapters/unit-1/revisions"
      });

      assert.equal(parsed.status, status);
      assert.equal(parsed.title, "雨夜来客");
      assert.equal(parsed.displayTitle, "第0001章 雨夜来客");
    }
  });
});

describe("PendingKnowledgeUpdateSchema", () => {
  it("supports staged, committed, and rejected statuses", () => {
    for (const status of ["staged", "committed", "rejected"]) {
      const parsed = PendingKnowledgeUpdateSchema.parse({
        id: `pku-${status}`,
        unitId: "unit-1",
        status,
        facts: [],
        createdAt: "2026-06-28T00:00:00Z"
      });

      assert.equal(parsed.status, status);
    }
  });
});

describe("DailyIntentSchema", () => {
  it("supports every core daily intent", () => {
    assert.deepEqual(DailyIntentSchema.options, DailyIntentValues);

    for (const intent of DailyIntentValues) {
      assert.equal(DailyIntentSchema.parse(intent), intent);
    }
  });

  it("rejects unknown daily intents", () => {
    const result = DailyIntentSchema.safeParse("auto_approve_everything");

    assert.equal(result.success, false);
  });
});

describe("WorkflowStateSchema", () => {
  it("supports pending review state fields", () => {
    const parsed = WorkflowStateSchema.parse({
      status: "awaiting_user_review",
      projectId: "project-1",
      currentUnitId: "unit-23",
      stagedOutputFile: "outputs/chapters/第0023章 雨夜来客.md",
      updatedAt: "2026-06-28T00:00:00Z"
    });

    assert.equal(parsed.status, "awaiting_user_review");
    assert.equal(parsed.currentUnitId, "unit-23");
    assert.equal(
      parsed.stagedOutputFile,
      "outputs/chapters/第0023章 雨夜来客.md"
    );
  });

  it("rejects invalid workflow status", () => {
    const result = WorkflowStateSchema.safeParse({
      status: "resuming",
      updatedAt: "2026-06-28T00:00:00Z"
    });

    assert.equal(result.success, false);
  });
});

describe("CheckpointSchema", () => {
  it("supports approve and replan checkpoints", () => {
    for (const reason of ["approve", "replan"]) {
      const parsed = CheckpointSchema.parse({
        id: `2026-06-28T00-00-00Z-${reason}`,
        reason,
        createdAt: "2026-06-28T00:00:00Z",
        workflowState: {
          status: "ready_to_produce",
          updatedAt: "2026-06-28T00:00:00Z"
        },
        note: `${reason} checkpoint`
      });

      assert.equal(parsed.reason, reason);
      assert.equal(parsed.workflowState?.status, "ready_to_produce");
    }
  });

  it("rejects invalid checkpoint reason", () => {
    const result = CheckpointSchema.safeParse({
      id: "checkpoint-1",
      reason: "rollback",
      createdAt: "2026-06-28T00:00:00Z"
    });

    assert.equal(result.success, false);
  });
});
