import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  applyAutomaticRevisionStrategy,
  blocksAutomaticBatchProduction,
  generateUnitRetrospective,
  QualityGateError,
  QualityGateSeverityValues,
  QualityGateStatusValues,
  assertQualityGateSeverity,
  assertQualityGateStatus,
  planAutomaticRevisionStrategy,
  runAiTasteGate,
  runConsistencyGate,
  runQualityGate,
  writeUnitRetrospectiveReport,
  writeQualityGateReport
} from "./index.ts";

const createTempDir = async () => mkdtemp(join(tmpdir(), "storyos-quality-"));

describe("quality gate runtime", () => {
  it("runs a passing quality gate", async () => {
    const result = await runQualityGate(
      {
        id: "generic-pass",
        run: () => ({
          summary: "No issues."
        })
      },
      {
        now: "2026-06-28T00:00:00.000Z"
      }
    );

    assert.equal(result.gate, "generic-pass");
    assert.equal(result.status, "passed");
    assert.deepEqual(result.findings, []);
    assert.equal(result.createdAt, "2026-06-28T00:00:00.000Z");
    assert.match(result.id, /^generic-pass-/);
  });

  it("supports P0 through P3 severities and failed results", async () => {
    assert.deepEqual(QualityGateSeverityValues, ["P0", "P1", "P2", "P3"]);
    assert.deepEqual(QualityGateStatusValues, ["passed", "failed"]);

    const result = await runQualityGate(
      {
        id: "generic-fail",
        run: () => ({
          findings: QualityGateSeverityValues.map((severity) => ({
            id: `finding-${severity}`,
            message: `Finding ${severity}`,
            severity
          }))
        })
      },
      {
        now: "2026-06-28T00:00:00.000Z"
      }
    );

    assert.equal(result.status, "failed");
    assert.equal(result.findings.length, 4);
    assert.deepEqual(
      result.findings.map((finding) => finding.severity),
      ["P0", "P1", "P2", "P3"]
    );
  });

  it("validates severity and status values", () => {
    assert.equal(assertQualityGateSeverity("P2"), "P2");
    assert.equal(assertQualityGateStatus("failed"), "failed");
    assert.throws(
      () => assertQualityGateSeverity("P4"),
      (error) =>
        error instanceof QualityGateError &&
        /Invalid quality gate severity/.test(error.message)
    );
    assert.throws(
      () => assertQualityGateStatus("blocked"),
      (error) =>
        error instanceof QualityGateError &&
        /Invalid quality gate status/.test(error.message)
    );
  });

  it("saves reports under reviews", async () => {
    const cwd = await createTempDir();

    try {
      const result = await runQualityGate(
        {
          id: "generic-report",
          run: () => ({
            findings: [
              {
                id: "finding-1",
                message: "Needs attention.",
                severity: "P1",
                sourceRef: "outputs/chapters/0001.md"
              }
            ]
          })
        },
        {
          now: "2026-06-28T00:00:00.000Z"
        }
      );

      const report = await writeQualityGateReport(cwd, result);
      const saved = JSON.parse(await readFile(report.absolutePath, "utf8"));

      assert.match(report.relativePath, /^reviews\/generic-report-/);
      assert.equal(saved.gate, "generic-report");
      assert.equal(saved.status, "failed");
      assert.equal(saved.findings[0].severity, "P1");
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });
});

describe("consistency gate", () => {
  it("passes when facts do not conflict", async () => {
    const result = await runConsistencyGate(
      [
        {
          category: "character_state",
          id: "fact-1",
          key: "location",
          sourceRef: "knowledge/roles/hero.md",
          subject: "Hero",
          value: "capital"
        },
        {
          category: "character_state",
          id: "fact-2",
          key: "location",
          sourceRef: "outputs/chapters/0001.md",
          subject: "Hero",
          value: "capital"
        }
      ],
      {
        now: "2026-06-28T00:00:00.000Z"
      }
    );

    assert.equal(result.gate, "consistency");
    assert.equal(result.status, "passed");
    assert.deepEqual(result.findings, []);
    assert.equal(blocksAutomaticBatchProduction(result), false);
  });

  it("detects character state, timeline, ability, and item conflicts", async () => {
    const result = await runConsistencyGate(
      [
        {
          category: "character_state",
          id: "state-1",
          key: "location",
          sourceRef: "chapter-1",
          subject: "Hero",
          value: "capital"
        },
        {
          category: "character_state",
          id: "state-2",
          key: "location",
          sourceRef: "chapter-2",
          subject: "Hero",
          value: "frontier"
        },
        {
          category: "timeline",
          id: "timeline-1",
          key: "battle_date",
          sourceRef: "timeline/a",
          subject: "Battle of Rain",
          value: "day 3"
        },
        {
          category: "timeline",
          id: "timeline-2",
          key: "battle_date",
          sourceRef: "timeline/b",
          subject: "Battle of Rain",
          value: "day 5"
        },
        {
          category: "ability",
          id: "ability-1",
          key: "shadow_step",
          subject: "Hero",
          value: "cannot use"
        },
        {
          category: "ability",
          id: "ability-2",
          key: "shadow_step",
          subject: "Hero",
          value: "can use"
        },
        {
          category: "item",
          id: "item-1",
          key: "silver_key",
          subject: "Hero",
          value: "lost"
        },
        {
          category: "item",
          id: "item-2",
          key: "silver_key",
          subject: "Hero",
          value: "has"
        }
      ],
      {
        now: "2026-06-28T00:00:00.000Z"
      }
    );

    assert.equal(result.status, "failed");
    assert.equal(result.findings.length, 4);
    assert.deepEqual(
      result.findings.map((finding) => finding.severity).sort(),
      ["P0", "P1", "P1", "P1"]
    );
    assert.match(
      result.findings.map((finding) => finding.message).join("\n"),
      /character state conflict/
    );
    assert.match(
      result.findings.map((finding) => finding.message).join("\n"),
      /timeline conflict/
    );
    assert.match(
      result.findings.map((finding) => finding.message).join("\n"),
      /ability conflict/
    );
    assert.match(
      result.findings.map((finding) => finding.message).join("\n"),
      /item conflict/
    );
    assert.equal(blocksAutomaticBatchProduction(result), true);
  });
});

describe("AI taste gate", () => {
  it("passes clean prose", async () => {
    const result = await runAiTasteGate(
      {
        sourceRef: "outputs/chapters/0001.md",
        sourceText:
          "Mara counted the wet bootprints on the stair. The third print turned outward at the landing."
      },
      {
        now: "2026-06-28T00:00:00.000Z"
      }
    );

    assert.equal(result.gate, "ai_taste");
    assert.equal(result.status, "passed");
    assert.deepEqual(result.findings, []);
  });

  it("flags cliche, template-feel, and anti-intelligence prose with snippets and suggestions", async () => {
    const result = await runAiTasteGate(
      {
        sourceRef: "outputs/chapters/0002.md",
        sourceText:
          "Her heart pounded as the door opened. It was not just a room but a testament to fear. Somehow, the sealed lock clicked open."
      },
      {
        now: "2026-06-28T00:00:00.000Z"
      }
    );

    assert.equal(result.status, "failed");
    assert.equal(result.findings.length, 4);
    assert.match(
      result.findings.map((finding) => finding.message).join("\n"),
      /banned_cliche issue/
    );
    assert.match(
      result.findings.map((finding) => finding.message).join("\n"),
      /template_feel issue/
    );
    assert.match(
      result.findings.map((finding) => finding.message).join("\n"),
      /anti_intelligence issue/
    );

    for (const finding of result.findings) {
      assert.match(finding.sourceRef, /^outputs\/chapters\/0002\.md#sentence-\d+$/);
      assert.ok(finding.snippet.length > 0);
      assert.ok(finding.suggestion.length > 0);
    }
  });
});

describe("automatic revision strategy", () => {
  const createResult = (severity) => ({
    createdAt: "2026-06-28T00:00:00.000Z",
    findings: severity
      ? [
          {
            id: `finding-${severity}`,
            message: `Finding ${severity}`,
            severity,
            suggestion: `Fix ${severity}`
          }
        ]
      : [],
    gate: "test-gate",
    id: `result-${severity ?? "passed"}`,
    status: severity ? "failed" : "passed"
  });

  it("pauses on P0", () => {
    const plan = planAutomaticRevisionStrategy(createResult("P0"));

    assert.equal(plan.action, "pause");
    assert.equal(plan.severity, "P0");
  });

  it("auto-revises P1 once and pauses after a repeat failure", () => {
    const first = planAutomaticRevisionStrategy(createResult("P1"));
    const second = planAutomaticRevisionStrategy(createResult("P1"), {
      p1RevisionAttempts: 1
    });

    assert.equal(first.action, "auto_revise");
    assert.equal(first.mode, "rewrite");
    assert.equal(second.action, "pause");
  });

  it("auto-revises P2 and records P3 suggestions", () => {
    const p2 = planAutomaticRevisionStrategy(createResult("P2"));
    const p3 = planAutomaticRevisionStrategy(createResult("P3"));

    assert.equal(p2.action, "auto_revise");
    assert.equal(p2.mode, "light");
    assert.equal(p3.action, "record_suggestions");
    assert.deepEqual(p3.suggestions, ["Fix P3"]);
  });

  it("returns a new stagedOutputFile when applying an automatic revision", async () => {
    const result = await applyAutomaticRevisionStrategy(createResult("P2"), {
      createRevision: (request) => {
        assert.equal(request.mode, "light");
        assert.equal(request.suggestions[0], "Fix P2");

        return {
          stagedOutputFile: "outputs/chapters/0001-revised.md"
        };
      }
    });

    assert.equal(result.action, "auto_revise");
    assert.equal(result.stagedOutputFile, "outputs/chapters/0001-revised.md");
  });
});

describe("unit retrospective", () => {
  it("summarizes character progression and foreshadowing", async () => {
    const report = generateUnitRetrospective({
      createdAt: "2026-06-28T00:00:00.000Z",
      range: {
        end: 5,
        start: 1
      },
      units: [
        {
          characterProgression: [
            {
              character: "Mara",
              from: "avoids command",
              note: "takes responsibility for the bridge choice",
              to: "accepts command"
            }
          ],
          foreshadowingAdded: ["silver key"],
          foreshadowingRecovered: ["old map"],
          highlightBeats: ["bridge collapse"],
          id: "chapter-0001",
          index: 1,
          payoffBeats: ["old map"],
          title: "Bridge"
        },
        {
          foreshadowingAdded: ["hidden heir"],
          highlightBeats: ["market chase"],
          id: "chapter-0002",
          index: 2,
          title: "Market"
        }
      ]
    });

    assert.equal(report.id, "retro-1-5-2026-06-28T00-00-00.000Z");
    assert.equal(report.unitCount, 2);
    assert.equal(report.characterProgression[0].character, "Mara");
    assert.deepEqual(report.foreshadowing.added, ["hidden heir", "silver key"]);
    assert.deepEqual(report.foreshadowing.recovered, ["old map"]);
    assert.deepEqual(report.repeatedBeats, []);
  });

  it("flags repeated highlight/payoff beats and writes a report under reviews", async () => {
    const cwd = await createTempDir();

    try {
      const report = generateUnitRetrospective({
        createdAt: "2026-06-28T00:00:00.000Z",
        range: {
          end: 10,
          start: 6
        },
        units: [
          {
            foreshadowingAdded: ["mirror scar"],
            highlightBeats: ["last-second rescue"],
            id: "chapter-0006",
            index: 6,
            risks: ["villain plan still vague"],
            title: "Rescue"
          },
          {
            id: "chapter-0007",
            index: 7,
            payoffBeats: ["last-second rescue"],
            title: "Second Rescue"
          }
        ]
      });

      assert.deepEqual(report.repeatedBeats, [
        {
          beat: "last-second rescue",
          count: 2,
          unitIds: ["chapter-0006", "chapter-0007"]
        }
      ]);
      assert.match(report.risks.join("\n"), /Repeated payoff/);
      assert.match(report.risks.join("\n"), /Foreshadowing was added/);
      assert.match(report.risks.join("\n"), /villain plan still vague/);

      const written = await writeUnitRetrospectiveReport(cwd, report);
      const saved = JSON.parse(await readFile(written.absolutePath, "utf8"));

      assert.match(written.relativePath, /^reviews\/retro-6-10-/);
      assert.equal(saved.repeatedBeats[0].count, 2);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });
});
