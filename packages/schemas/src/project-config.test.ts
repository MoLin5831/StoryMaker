import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ProjectConfigSchema } from "./project-config.js";

describe("ProjectConfigSchema", () => {
  it("accepts superlong_webnovel + production", () => {
    const config = ProjectConfigSchema.parse({
      project: {
        title: "未定名项目",
        content_type: "superlong_webnovel",
        workflow_profile: "production",
        language: "zh-CN",
        target_platform: "番茄小说",
        target_words: 1_500_000,
        target_units: 650,
        unit_name: "chapter"
      },
      writing: {
        words_per_unit_min: 2000,
        words_per_unit_max: 2500,
        rolling_plan_units: 10,
        review_frequency: "every_unit",
        replan_frequency: "every_10_units",
        output_dir: "outputs/chapters",
        output_format: "md",
        chapter_filename: "numbered_title",
        chapter_heading: "numbered_title",
        chapter_number_padding: 4
      },
      production: {
        interaction_mode: "guided_auto",
        auto_produce_unit: true,
        auto_revise_before_user_review: true,
        stop_after_unit_for_user_acceptance: true,
        progress_visible: true,
        allow_batch_production: true,
        max_batch_units_without_user_review: 5
      },
      knowledge: {
        wiki_required: true,
        search_mode: "hybrid",
        fact_extraction_required: true
      },
      quality: {
        ai_taste_gate: "required",
        commercial_review: "required",
        reader_review: "every_5_units",
        continuity_gate: "required"
      }
    });

    assert.equal(config.project.content_type, "superlong_webnovel");
    assert.equal(config.project.workflow_profile, "production");
    assert.deepEqual(config.adapters.installed, []);
    assert.equal(config.adapters.mcp.enabled, false);
  });

  it("accepts short_story + lite", () => {
    const config = ProjectConfigSchema.parse({
      project: {
        title: "未定名短篇",
        content_type: "short_story",
        workflow_profile: "lite",
        language: "zh-CN",
        target_words: 12000,
        target_units: 5,
        unit_name: "scene"
      },
      writing: {
        rolling_plan_units: 5,
        review_frequency: "final_only"
      },
      production: {
        interaction_mode: "guided_auto",
        auto_produce_unit: true,
        stop_after_unit_for_user_acceptance: true
      },
      knowledge: {
        wiki_required: false,
        search_mode: "keyword",
        fact_extraction_required: false
      },
      quality: {
        ai_taste_gate: "required",
        continuity_gate: "basic"
      }
    });

    assert.equal(config.project.content_type, "short_story");
    assert.equal(config.project.workflow_profile, "lite");
  });

  it("rejects invalid content_type", () => {
    const result = ProjectConfigSchema.safeParse({
      project: {
        title: "bad",
        content_type: "essay",
        workflow_profile: "lite",
        language: "zh-CN",
        unit_name: "chapter"
      }
    });

    assert.equal(result.success, false);
  });

  it("rejects invalid workflow_profile", () => {
    const result = ProjectConfigSchema.safeParse({
      project: {
        title: "bad",
        content_type: "short_story",
        workflow_profile: "enterprise",
        language: "zh-CN",
        unit_name: "chapter"
      }
    });

    assert.equal(result.success, false);
  });
});
