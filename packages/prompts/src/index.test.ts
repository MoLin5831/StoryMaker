import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  StoryPromptTemplateIds,
  getStoryPromptTemplate,
  listStoryPromptTemplates,
  renderStoryPrompt
} from "./index.js";

describe("StoryMaker prompt templates", () => {
  it("exposes the required core template set", () => {
    assert.deepEqual(StoryPromptTemplateIds, [
      "story-produce",
      "story-unit-plan",
      "story-draft",
      "story-ai-polish",
      "story-review",
      "story-consistency-check",
      "story-update-kb",
      "story-replan"
    ]);
    assert.equal(listStoryPromptTemplates().length, 8);
  });

  it("defines inputs outputs and forbidden actions for every template", () => {
    for (const template of listStoryPromptTemplates()) {
      assert.ok(template.requiredInputs.length > 0, template.id);
      assert.ok(template.expectedOutputs.length > 0, template.id);
      assert.ok(template.forbiddenActions.length > 0, template.id);
      assert.ok(template.instructions.length > 0, template.id);
      assert.equal(getStoryPromptTemplate(template.id).id, template.id);
    }
  });

  it("renders superlong production requirements for drafting", () => {
    const prompt = renderStoryPrompt({
      context: {
        gaps: ["villain motive is not confirmed"],
        sources: [
          {
            path: "bible/foreshadowing.md",
            summary: "The silver key must be mentioned before chapter 12.",
            title: "Foreshadowing Ledger"
          }
        ]
      },
      outputTarget: {
        draftPath: "outputs/chapters/0012.md",
        knowledgeUpdatePath: ".storyos/pending-knowledge-updates/pending-run-0012.json",
        qualityReportPath: "reviews/run-0012.md"
      },
      project: {
        contentType: "superlong_webnovel",
        language: "zh-CN",
        targetPlatform: "web serialization",
        title: "Ash Tower",
        unitName: "chapter",
        workflowProfile: "production"
      },
      templateId: "story-draft",
      workUnit: {
        displayTitle: "Chapter 0012",
        id: "chapter-0012",
        outputPath: "outputs/chapters/0012.md",
        targetWords: 3200,
        type: "chapter"
      }
    });

    assert.match(prompt, /# StoryMaker Prompt: story-draft/);
    assert.match(prompt, /Content type: superlong_webnovel/);
    assert.match(prompt, /Workflow profile: production/);
    assert.match(prompt, /Run context retrieval before planning or drafting/);
    assert.match(prompt, /chapter hook/);
    assert.match(prompt, /reader payoff density/);
    assert.match(prompt, /foreshadowing setup/);
    assert.match(prompt, /knowledge-base update candidates/);
    assert.match(prompt, /full production workflow/);
    assert.match(prompt, /Foreshadowing Ledger \(bible\/foreshadowing\.md\)/);
    assert.match(prompt, /villain motive is not confirmed/);
    assert.match(prompt, /Draft: outputs\/chapters\/0012\.md/);
    assert.match(prompt, /Quality report: reviews\/run-0012\.md/);
  });

  it("adapts lighter projects without superlong-only requirements", () => {
    const prompt = renderStoryPrompt({
      project: {
        contentType: "short_story",
        title: "Glass Rain",
        workflowProfile: "lite"
      },
      templateId: "story-unit-plan"
    });

    assert.match(prompt, /Protect compression, unity of effect, and scene economy/);
    assert.match(prompt, /Keep output lightweight/);
    assert.doesNotMatch(prompt, /reader payoff density/);
    assert.doesNotMatch(prompt, /chapter hook/);
  });
});
