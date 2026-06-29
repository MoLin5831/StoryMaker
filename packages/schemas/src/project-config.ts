import { z } from "zod";

import {
  ContentTypeValues,
  UnitNameValues,
  WorkflowProfileValues
} from "@storyos/core";

export const ContentTypeSchema = z.enum(ContentTypeValues);
export const WorkflowProfileSchema = z.enum(WorkflowProfileValues);
export const UnitNameSchema = z.enum(UnitNameValues);

export const ProjectSectionSchema = z.object({
  title: z.string().min(1),
  content_type: ContentTypeSchema,
  workflow_profile: WorkflowProfileSchema,
  language: z.string().min(1).default("zh-CN"),
  target_platform: z.string().min(1).optional(),
  target_words: z.number().int().positive().optional(),
  target_units: z.number().int().positive().optional(),
  unit_name: UnitNameSchema
});

export const WritingConfigSchema = z.object({
  words_per_unit_min: z.number().int().positive().optional(),
  words_per_unit_max: z.number().int().positive().optional(),
  rolling_plan_units: z.number().int().positive().optional(),
  review_frequency: z.string().min(1).optional(),
  replan_frequency: z.string().min(1).optional(),
  output_dir: z.string().min(1).optional(),
  output_format: z.string().min(1).optional(),
  chapter_filename: z.string().min(1).optional(),
  chapter_heading: z.string().min(1).optional(),
  chapter_number_padding: z.number().int().positive().optional()
}).default({});

export const ProductionConfigSchema = z.object({
  interaction_mode: z.string().min(1).optional(),
  auto_produce_unit: z.boolean().optional(),
  auto_revise_before_user_review: z.boolean().optional(),
  stop_after_unit_for_user_acceptance: z.boolean().optional(),
  progress_visible: z.boolean().optional(),
  allow_batch_production: z.boolean().optional(),
  max_batch_units_without_user_review: z.number().int().positive().optional()
}).default({});

export const KnowledgeConfigSchema = z.object({
  wiki_required: z.boolean().optional(),
  search_mode: z.string().min(1).optional(),
  fact_extraction_required: z.boolean().optional()
}).default({});

export const QualityConfigSchema = z.object({
  ai_taste_gate: z.string().min(1).optional(),
  commercial_review: z.string().min(1).optional(),
  reader_review: z.string().min(1).optional(),
  continuity_gate: z.string().min(1).optional()
}).default({});

export const McpConfigSchema = z.object({
  enabled: z.boolean().default(false)
});

export const AdaptersConfigSchema = z.object({
  installed: z.array(z.string().min(1)).default([]),
  mcp: McpConfigSchema.default({
    enabled: false
  })
});

export const ProjectConfigSchema = z.object({
  project: ProjectSectionSchema,
  writing: WritingConfigSchema,
  production: ProductionConfigSchema,
  knowledge: KnowledgeConfigSchema,
  quality: QualityConfigSchema,
  adapters: AdaptersConfigSchema.default({
    installed: [],
    mcp: {
      enabled: false
    }
  })
});

export type ContentType = z.infer<typeof ContentTypeSchema>;
export type WorkflowProfile = z.infer<typeof WorkflowProfileSchema>;
export type UnitName = z.infer<typeof UnitNameSchema>;
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type WritingConfig = z.infer<typeof WritingConfigSchema>;
export type ProductionConfig = z.infer<typeof ProductionConfigSchema>;
export type KnowledgeConfig = z.infer<typeof KnowledgeConfigSchema>;
export type QualityConfig = z.infer<typeof QualityConfigSchema>;
export type McpConfig = z.infer<typeof McpConfigSchema>;
export type AdaptersConfig = z.infer<typeof AdaptersConfigSchema>;
