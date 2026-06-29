import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  readDashboardSnapshot,
  renderDashboardHtml,
  runDashboardReviewAction,
  startDashboardServer
} from "./index.ts";
import { indexStoryProject } from "../../../packages/indexer/dist/index.js";

const createTempDir = async () => mkdtemp(join(tmpdir(), "storyos-dashboard-"));

const writeProject = async (cwd) => {
  await mkdir(join(cwd, ".storyos"), {
    recursive: true
  });
  await mkdir(join(cwd, ".storyos", "runs"), {
    recursive: true
  });
  await mkdir(join(cwd, "outputs", "chapters"), {
    recursive: true
  });
  await writeFile(
    join(cwd, "project.yaml"),
    `project:
  title: "Dashboard Sample"
  content_type: "superlong_webnovel"
  workflow_profile: "production"
  unit_name: "chapter"
adapters:
  mcp:
    enabled: false
`,
    "utf8"
  );
  await writeFile(
    join(cwd, ".storyos", "workflow-state.json"),
    `${JSON.stringify(
      {
        currentRunId: "draft-submit-0001",
        currentUnitId: "chapter-0001",
        stagedOutputFile: "outputs/chapters/0001.md",
        status: "awaiting_user_review",
        updatedAt: "2026-06-28T00:00:00.000Z"
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  await writeFile(
    join(cwd, "outputs", "chapters", "0001.md"),
    '---\nstatus: "staged"\n---\n# First Chapter\n\nA staged draft waits here.\n\nSecond paragraph only appears in the full body.\n',
    "utf8"
  );
  await writeFile(
    join(cwd, ".storyos", "runs", "draft-submit-0001.json"),
    `${JSON.stringify(
      {
        id: "draft-submit-0001",
        quality: {
          authorSummary: {
            approvalRecommendation: "revise_before_approval",
            majorIssues: [
              {
                affectsSetting: false,
                gate: "reader_experience",
                message: "Draft body is very short.",
                severity: "P2",
                suggestion: "Expand the scene."
              }
            ],
            overallConclusion: "Quality review found 1 issue; highest severity is P2.",
            recommendedToApprove: false,
            settingImpact: "none_detected",
            summaryText:
              "Quality review found 1 issue; revise before approval. Setting impact: none_detected."
          },
          blocksBatchContinue: false,
          highestSeverity: "P2",
          reportFile: "reviews/draft-submit-0001.md"
        },
        reportFile: "reviews/draft-submit-0001.md",
        startedAt: "2026-06-28T00:00:00.000Z",
        status: "completed",
        steps: [
          {
            id: "prepare-packet",
            name: "Prepare packet",
            status: "completed"
          },
          {
            id: "run-quality-gates",
            name: "Run quality gates",
            reportFile: "reviews/draft-submit-0001.md",
            status: "completed"
          }
        ]
      },
      null,
      2
    )}\n`,
    "utf8"
  );
};

const writeKnowledgeBrowserFixture = async (cwd) => {
  await mkdir(join(cwd, "knowledge", "characters"), {
    recursive: true
  });
  await mkdir(join(cwd, "knowledge", "places"), {
    recursive: true
  });
  await mkdir(join(cwd, "knowledge"), {
    recursive: true
  });
  await mkdir(join(cwd, "outputs", "chapters"), {
    recursive: true
  });
  await mkdir(join(cwd, "outputs", "revisions", "chapter-0001"), {
    recursive: true
  });
  await writeFile(
    join(cwd, "knowledge", "characters", "mira.md"),
    '---\nstatus: "canon"\n---\n# Mira\nMira trusts the clockmaker.\n',
    "utf8"
  );
  await writeFile(
    join(cwd, "knowledge", "places", "harbor.md"),
    '---\nstatus: "canon"\n---\n# Harbor\nFoggy harbor is a canon place.\n',
    "utf8"
  );
  await writeFile(
    join(cwd, "knowledge", "timeline.md"),
    '---\nstatus: "canon"\n---\n# Timeline\nThe midnight bell precedes the harbor fire.\n',
    "utf8"
  );
  await writeFile(
    join(cwd, "knowledge", "foreshadowing.md"),
    '---\nstatus: "canon"\n---\n# Silver Key\nSilver key payoff remains open.\n',
    "utf8"
  );
  await writeFile(
    join(cwd, "outputs", "chapters", "draft-knowledge.md"),
    '---\nstatus: "staged"\n---\n# Draft Knowledge\nStaged comet clue waits for approval.\n',
    "utf8"
  );
  await writeFile(
    join(cwd, "outputs", "revisions", "chapter-0001", "rejected.md"),
    '---\nstatus: "rejected"\n---\n# Rejected Draft\nRejected bridge version remains visible.\n',
    "utf8"
  );
  await indexStoryProject({
    cwd,
    includeStaged: true,
    rebuild: true
  });
};

const readDashboardCsrfToken = (html) => {
  const match = /name="csrfToken" type="hidden" value="([^"]+)"/.exec(html);

  assert.ok(match, "Dashboard review forms should include a CSRF token");
  return match[1];
};

describe("StoryOS Dashboard skeleton", () => {
  it("reads project config workflow state and pending review chapter", async () => {
    const cwd = await createTempDir();

    try {
      await writeProject(cwd);

      const snapshot = await readDashboardSnapshot(cwd);

      assert.equal(snapshot.project.title, "Dashboard Sample");
      assert.equal(snapshot.project.contentType, "superlong_webnovel");
      assert.equal(snapshot.project.workflowProfile, "production");
      assert.equal(snapshot.project.unitName, "chapter");
      assert.equal(snapshot.workflow.status, "awaiting_user_review");
      assert.equal(snapshot.pendingReviewChapters[0].title, "First Chapter");
      assert.equal(snapshot.pendingReviewChapters[0].unitId, "chapter-0001");
      assert.match(
        snapshot.pendingReviewChapters[0].contentBody,
        /Second paragraph only appears in the full body/
      );
      assert.equal(snapshot.qualitySummary.reportPath, "reviews/draft-submit-0001.md");
      assert.equal(snapshot.qualitySummary.approvalRecommendation, "revise_before_approval");
      assert.equal(snapshot.qualitySummary.majorIssues[0].severity, "P2");
      assert.equal(snapshot.productionRun.id, "draft-submit-0001");
      assert.equal(snapshot.productionRun.status, "completed");
      assert.equal(snapshot.productionRun.steps[0].name, "Prepare packet");
      assert.equal(snapshot.productionRun.steps[1].status, "completed");
      assert.equal(snapshot.reviewActions[0].command, "storyctl approve --unit chapter-0001");
      assert.equal(
        snapshot.reviewActions[1].command,
        "storyctl reject --unit chapter-0001 --reason <reason>"
      );
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("reads a Markdown quality report when the run has only reportFile", async () => {
    const cwd = await createTempDir();

    try {
      await writeProject(cwd);
      await mkdir(join(cwd, "reviews"), {
        recursive: true
      });
      await writeFile(
        join(cwd, ".storyos", "runs", "draft-submit-0001.json"),
        `${JSON.stringify(
          {
            id: "draft-submit-0001",
            reportFile: "reviews/draft-submit-0001.md",
            startedAt: "2026-06-28T00:00:00.000Z",
            status: "completed",
            steps: [
              {
                id: "run-quality-gates",
                name: "Run quality gates",
                reportFile: "reviews/draft-submit-0001.md",
                status: "completed"
              }
            ],
            unitId: "chapter-0001"
          },
          null,
          2
        )}\n`,
        "utf8"
      );
      await writeFile(
        join(cwd, "reviews", "draft-submit-0001.md"),
        `# StoryMaker Quality Report

## Overall

Chapter meets the target and can be approved.

## Quality Gates

- Continuity: passed.
- Reader clarity: passed with note.

## Pending Knowledge Summary

- Mira knows the harbor route.
- The silver key remains staged.

## Final User Prompt

Chapter 0001 is complete. Approve it?
`,
        "utf8"
      );

      const snapshot = await readDashboardSnapshot(cwd);
      const html = renderDashboardHtml(snapshot);

      assert.equal(
        snapshot.qualitySummary.overallConclusion,
        "Chapter meets the target and can be approved."
      );
      assert.deepEqual(snapshot.qualitySummary.qualityGates, [
        "Continuity: passed.",
        "Reader clarity: passed with note."
      ]);
      assert.deepEqual(snapshot.qualitySummary.pendingKnowledgeSummary, [
        "Mira knows the harbor route.",
        "The silver key remains staged."
      ]);
      assert.equal(snapshot.qualitySummary.approvalPrompt, "Chapter 0001 is complete. Approve it?");
      assert.match(html, /Overall/);
      assert.match(html, /Quality Gates/);
      assert.match(html, /Continuity: passed/);
      assert.match(html, /Pending Knowledge Summary/);
      assert.match(html, /Mira knows the harbor route/);
      assert.match(html, /Final User Prompt/);
      assert.match(html, /Chapter 0001 is complete. Approve it/);
      assert.doesNotMatch(html, /No quality report available/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("keeps a safe fallback when a report file is missing", async () => {
    const cwd = await createTempDir();

    try {
      await writeProject(cwd);
      await writeFile(
        join(cwd, ".storyos", "runs", "draft-submit-0001.json"),
        `${JSON.stringify(
          {
            id: "draft-submit-0001",
            reportFile: "reviews/missing.md",
            startedAt: "2026-06-28T00:00:00.000Z",
            status: "completed",
            steps: [],
            unitId: "chapter-0001"
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      const snapshot = await readDashboardSnapshot(cwd);
      const html = renderDashboardHtml(snapshot);

      assert.equal(snapshot.qualitySummary, undefined);
      assert.match(html, /No quality report available/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("renders an HTML dashboard view", async () => {
    const cwd = await createTempDir();

    try {
      await writeProject(cwd);

      const html = renderDashboardHtml(await readDashboardSnapshot(cwd));

      assert.match(html, /Dashboard Sample/);
      assert.match(html, /Workflow State/);
      assert.match(html, /awaiting_user_review/);
      assert.match(html, /First Chapter/);
      assert.match(html, /Second paragraph only appears in the full body/);
      assert.match(html, /Quality Report/);
      assert.match(html, /revise_before_approval/);
      assert.match(html, /Draft body is very short/);
      assert.match(html, /storyctl approve --unit chapter-0001/);
      assert.match(html, /method="post" action="\/actions\/approve"/);
      assert.match(html, /method="post" action="\/actions\/reject"/);
      assert.match(html, /textarea name="reason" required/);
      assert.match(html, /Production Progress/);
      assert.match(html, /draft-submit-0001/);
      assert.match(html, /Prepare packet/);
      assert.match(html, /Run quality gates/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("prioritizes quality and review actions before the full chapter body", async () => {
    const cwd = await createTempDir();

    try {
      await writeProject(cwd);

      const html = renderDashboardHtml(await readDashboardSnapshot(cwd));

      assert.ok(
        html.indexOf("Quality Report") < html.indexOf("Pending Review"),
        "quality summary should be visible before the pending-review chapter body"
      );
      assert.ok(
        html.indexOf("Review Actions") < html.indexOf("Pending Review"),
        "approve/reject actions should be visible before the pending-review chapter body"
      );
      assert.match(html, /<details class="chapter-body">/);
      assert.match(html, /<summary>Full chapter text<\/summary>/);
      assert.match(html, /Second paragraph only appears in the full body/);
      assert.match(html, /textarea name="reason" required/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("serves the dashboard over a local HTTP port", async () => {
    const cwd = await createTempDir();
    let dashboard = null;

    try {
      await writeProject(cwd);

      dashboard = await startDashboardServer({
        cwd,
        port: 0
      });

      const response = await fetch(dashboard.url);
      const html = await response.text();

      assert.equal(response.status, 200);
      assert.match(dashboard.url, /^http:\/\/127\.0\.0\.1:\d+\/$/);
      assert.match(html, /Dashboard Sample/);
      assert.match(html, /First Chapter/);
      assert.match(html, /Second paragraph only appears in the full body/);
      assert.match(html, /awaiting_user_review/);
      assert.match(html, /Production Progress/);
      assert.match(html, /Prepare packet/);

      const health = await fetch(new URL("/healthz", dashboard.url));

      assert.equal(health.status, 200);
      assert.equal(await health.text(), "ok\n");
    } finally {
      if (dashboard !== null) {
        await dashboard.close();
      }
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("routes approve and reject actions through a CLI runner", async () => {
    const calls = [];
    const runner = async (argv, io, options) => {
      calls.push({
        argv,
        options
      });
      io.stdout.write("ok\n");
      return 0;
    };

    const approved = await runDashboardReviewAction(
      {
        action: "approve",
        cwd: "project-root",
        now: "2026-06-28T00:00:00.000Z",
        unit: "chapter-0001"
      },
      runner
    );
    const rejected = await runDashboardReviewAction(
      {
        action: "reject",
        cwd: "project-root",
        reason: "pace too slow",
        unit: "chapter-0001"
      },
      runner
    );

    assert.equal(approved.exitCode, 0);
    assert.equal(rejected.exitCode, 0);
    assert.deepEqual(calls[0].argv, ["approve", "--unit", "chapter-0001"]);
    assert.deepEqual(calls[1].argv, [
      "reject",
      "--unit",
      "chapter-0001",
      "--reason",
      "pace too slow"
    ]);
  });

  it("handles approve and reject POST actions through the shared runner path", async () => {
    const cwd = await createTempDir();
    const calls = [];
    let dashboard = null;
    const runner = async (argv, io, options) => {
      calls.push({
        argv,
        options
      });
      io.stdout.write(`ok:${argv[0]}\n`);
      return 0;
    };

    try {
      await writeProject(cwd);
      dashboard = await startDashboardServer({
        cwd,
        port: 0,
        runner
      });
      const html = await (await fetch(dashboard.url)).text();
      const csrfToken = readDashboardCsrfToken(html);

      const approved = await fetch(new URL("/actions/approve", dashboard.url), {
        body: `unit=chapter-0001&csrfToken=${encodeURIComponent(csrfToken)}`,
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        },
        method: "POST"
      });
      const rejectedWithoutReason = await fetch(new URL("/actions/reject", dashboard.url), {
        body: `unit=chapter-0001&reason=&csrfToken=${encodeURIComponent(csrfToken)}`,
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        },
        method: "POST"
      });
      const rejected = await fetch(new URL("/actions/reject", dashboard.url), {
        body: `unit=chapter-0001&reason=pace+too+slow&csrfToken=${encodeURIComponent(csrfToken)}`,
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        },
        method: "POST"
      });

      assert.equal(approved.status, 200);
      assert.equal(await approved.text(), "ok:approve\n");
      assert.equal(rejectedWithoutReason.status, 400);
      assert.match(await rejectedWithoutReason.text(), /Reject action requires a reason/);
      assert.equal(rejected.status, 200);
      assert.equal(await rejected.text(), "ok:reject\n");
      assert.deepEqual(calls[0].argv, ["approve", "--unit", "chapter-0001"]);
      assert.deepEqual(calls[1].argv, [
        "reject",
        "--unit",
        "chapter-0001",
        "--reason",
        "pace too slow"
      ]);
      assert.equal(calls.length, 2);
    } finally {
      if (dashboard !== null) {
        await dashboard.close();
      }
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("rejects dashboard POST actions without the page CSRF token", async () => {
    const cwd = await createTempDir();
    const calls = [];
    let dashboard = null;
    const runner = async (argv, io, options) => {
      calls.push({
        argv,
        options
      });
      io.stdout.write("ok\n");
      return 0;
    };

    try {
      await writeProject(cwd);
      dashboard = await startDashboardServer({
        cwd,
        port: 0,
        runner
      });

      const response = await fetch(new URL("/actions/approve", dashboard.url), {
        body: "unit=chapter-0001",
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        },
        method: "POST"
      });

      assert.equal(response.status, 403);
      assert.match(await response.text(), /Invalid Dashboard action token/);
      assert.equal(calls.length, 0);
    } finally {
      if (dashboard !== null) {
        await dashboard.close();
      }
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("restores production progress and blocker state from disk on fresh reads", async () => {
    const cwd = await createTempDir();

    try {
      await writeProject(cwd);
      await writeFile(
        join(cwd, ".storyos", "workflow-state.json"),
        `${JSON.stringify(
          {
            blockedBy: "Quality gate P1",
            currentRunId: "run-blocked",
            currentUnitId: "chapter-0002",
            status: "blocked",
            updatedAt: "2026-06-28T00:01:00.000Z"
          },
          null,
          2
        )}\n`,
        "utf8"
      );
      await writeFile(
        join(cwd, ".storyos", "runs", "run-blocked.json"),
        `${JSON.stringify(
          {
            id: "run-blocked",
            reportFile: "reviews/run-blocked.md",
            startedAt: "2026-06-28T00:01:00.000Z",
            status: "failed",
            steps: [
              {
                id: "write-draft",
                name: "Write draft",
                status: "completed"
              },
              {
                error: "Adapter timed out",
                id: "quality-gate",
                name: "Quality gate",
                status: "failed"
              }
            ]
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      const first = await readDashboardSnapshot(cwd);
      const second = await readDashboardSnapshot(cwd);
      const html = renderDashboardHtml(second);

      assert.equal(first.productionRun.id, "run-blocked");
      assert.equal(second.productionRun.status, "failed");
      assert.equal(second.productionRun.blocker, "Quality gate P1");
      assert.equal(second.productionRun.steps[1].error, "Adapter timed out");
      assert.match(html, /run-blocked/);
      assert.match(html, /Write draft/);
      assert.match(html, /quality-gate - failed/);
      assert.match(html, /Quality gate P1/);
      assert.match(html, /Adapter timed out/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("renders a read-only searchable knowledge browser with status labels", async () => {
    const cwd = await createTempDir();

    try {
      await writeProject(cwd);
      await writeKnowledgeBrowserFixture(cwd);

      const snapshot = await readDashboardSnapshot(cwd);
      const statuses = new Set(snapshot.knowledgeBrowser.entries.map((entry) => entry.status));
      const types = new Set(snapshot.knowledgeBrowser.entries.map((entry) => entry.type));
      const html = renderDashboardHtml(snapshot);
      const searchSnapshot = await readDashboardSnapshot(cwd, {
        knowledgeQuery: "comet"
      });
      const searchHtml = renderDashboardHtml(searchSnapshot);

      assert.ok(statuses.has("canon"));
      assert.ok(statuses.has("staged"));
      assert.ok(statuses.has("rejected"));
      assert.ok(types.has("character"));
      assert.ok(types.has("place"));
      assert.ok(types.has("timeline"));
      assert.ok(types.has("foreshadowing"));
      assert.match(html, /Knowledge Browser/);
      assert.match(html, /Characters/);
      assert.match(html, /Places/);
      assert.match(html, /Timeline/);
      assert.match(html, /Foreshadowing/);
      assert.match(html, /status-canon/);
      assert.match(html, /status-staged/);
      assert.match(html, /status-rejected/);
      assert.doesNotMatch(html, /action="\/knowledge\/edit/);
      assert.equal(searchSnapshot.knowledgeBrowser.entries.length, 1);
      assert.equal(searchSnapshot.knowledgeBrowser.entries[0].status, "staged");
      assert.match(searchHtml, /value="comet"/);
      assert.match(searchHtml, /Staged comet clue waits for approval/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("requires a reject reason before calling the CLI runner", async () => {
    await assert.rejects(
      () =>
        runDashboardReviewAction(
          {
            action: "reject",
            cwd: "project-root",
            unit: "chapter-0001"
          },
          async () => 0
        ),
      /Reject action requires a reason/
    );
  });
});
