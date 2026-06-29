import { z } from "zod";

import {
  DailyIntentValues,
  FactStatusValues,
  PendingKnowledgeUpdateStatusValues,
  ProductionRunStatusValues,
  ProductionStepStatusValues,
  QualityGateSeverityValues,
  QualityGateStatusValues,
  WorkUnitStatusValues,
  WorkUnitTypeValues,
  WorkflowStatusValues
} from "@storyos/core";

import {
  ContentTypeSchema,
  UnitNameSchema,
  WorkflowProfileSchema
} from "./project-config.js";

export const StoryProjectSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  contentType: ContentTypeSchema,
  workflowProfile: WorkflowProfileSchema,
  language: z.string().min(1),
  targetPlatform: z.string().min(1).optional(),
  targetWords: z.number().int().positive().optional(),
  targetUnits: z.number().int().positive().optional(),
  unitName: UnitNameSchema
});

export const WorkUnitTypeSchema = z.enum(WorkUnitTypeValues);
export const WorkUnitStatusSchema = z.enum(WorkUnitStatusValues);
export const FactStatusSchema = z.enum(FactStatusValues);
export const PendingKnowledgeUpdateStatusSchema = z.enum(
  PendingKnowledgeUpdateStatusValues
);
export const DailyIntentSchema = z.enum(DailyIntentValues);
export const WorkflowStatusSchema = z.enum(WorkflowStatusValues);
export const ProductionRunStatusSchema = z.enum(ProductionRunStatusValues);
export const ProductionStepStatusSchema = z.enum(ProductionStepStatusValues);
export const QualityGateSeveritySchema = z.enum(QualityGateSeverityValues);
export const QualityGateStatusSchema = z.enum(QualityGateStatusValues);
export const CheckpointReasonValues = ["approve", "replan", "manual"] as const;
export const CheckpointReasonSchema = z.enum(CheckpointReasonValues);

export const WorkUnitSchema = z.object({
  id: z.string().min(1),
  type: WorkUnitTypeSchema,
  index: z.number().int().nonnegative(),
  title: z.string().min(1),
  displayTitle: z.string().min(1),
  filenameTitle: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  status: WorkUnitStatusSchema,
  outputFile: z.string().min(1).optional(),
  stagedOutputFile: z.string().min(1).optional(),
  revisionDir: z.string().min(1).optional()
});

export const NarrativeEntitySchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  name: z.string().min(1),
  aliases: z.array(z.string().min(1)).optional(),
  status: FactStatusSchema,
  sourceRefs: z.array(z.string().min(1)).optional()
});

export const WorkflowStateSchema = z.object({
  status: WorkflowStatusSchema,
  projectId: z.string().min(1).optional(),
  currentUnitId: z.string().min(1).optional(),
  currentUnit: z.string().min(1).optional(),
  currentRunId: z.string().min(1).optional(),
  stagedOutputFile: z.string().min(1).optional(),
  blockedBy: z.string().min(1).optional(),
  lastError: z.string().min(1).optional(),
  updatedAt: z.string().min(1)
});

export const ProductionStepSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: ProductionStepStatusSchema,
  startedAt: z.string().min(1).optional(),
  endedAt: z.string().min(1).optional(),
  error: z.string().min(1).optional(),
  reportFile: z.string().min(1).optional()
});

export const ProductionRunSchema = z.object({
  id: z.string().min(1),
  status: ProductionRunStatusSchema,
  unitId: z.string().min(1).optional(),
  steps: z.array(ProductionStepSchema),
  startedAt: z.string().min(1),
  endedAt: z.string().min(1).optional(),
  reportFile: z.string().min(1).optional()
});

export const PendingKnowledgeUpdateSchema = z.object({
  id: z.string().min(1),
  unitId: z.string().min(1),
  status: PendingKnowledgeUpdateStatusSchema,
  facts: z.array(z.unknown()),
  createdAt: z.string().min(1),
  committedAt: z.string().min(1).optional(),
  rejectedAt: z.string().min(1).optional()
});

export const QualityGateFindingSchema = z.object({
  id: z.string().min(1),
  severity: QualityGateSeveritySchema,
  message: z.string().min(1),
  sourceRef: z.string().min(1).optional()
});

export const QualityGateResultSchema = z.object({
  id: z.string().min(1),
  gate: z.string().min(1),
  status: QualityGateStatusSchema,
  findings: z.array(QualityGateFindingSchema),
  createdAt: z.string().min(1)
});

export const CheckpointSchema = z.object({
  id: z.string().min(1),
  reason: CheckpointReasonSchema,
  createdAt: z.string().min(1),
  workflowState: WorkflowStateSchema.optional(),
  productionRun: ProductionRunSchema.optional(),
  note: z.string().min(1).optional()
});

export type StoryProject = z.infer<typeof StoryProjectSchema>;
export type WorkUnit = z.infer<typeof WorkUnitSchema>;
export type NarrativeEntity = z.infer<typeof NarrativeEntitySchema>;
export type FactStatus = z.infer<typeof FactStatusSchema>;
export type DailyIntent = z.infer<typeof DailyIntentSchema>;
export type WorkflowState = z.infer<typeof WorkflowStateSchema>;
export type ProductionRun = z.infer<typeof ProductionRunSchema>;
export type ProductionStep = z.infer<typeof ProductionStepSchema>;
export type PendingKnowledgeUpdate = z.infer<
  typeof PendingKnowledgeUpdateSchema
>;
export type QualityGateResult = z.infer<typeof QualityGateResultSchema>;
export type CheckpointReason = z.infer<typeof CheckpointReasonSchema>;
export type Checkpoint = z.infer<typeof CheckpointSchema>;
