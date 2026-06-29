import type {
  ContentType,
  UnitName,
  WorkflowProfile
} from "./project-config.js";

export const WorkUnitTypeValues = [
  "chapter",
  "scene",
  "episode",
  "panel",
  "branch",
  "node",
  "quest",
  "dialogue_node"
] as const;

export type WorkUnitType = (typeof WorkUnitTypeValues)[number];

export const WorkUnitStatusValues = [
  "planned",
  "producing",
  "drafted",
  "reviewed",
  "revised",
  "awaiting_user_review",
  "rejected",
  "approved_pending_kb_commit",
  "final"
] as const;

export type WorkUnitStatus = (typeof WorkUnitStatusValues)[number];

export const FactStatusValues = [
  "assumption",
  "staged",
  "canon",
  "rejected"
] as const;

export type FactStatus = (typeof FactStatusValues)[number];

export const PendingKnowledgeUpdateStatusValues = [
  "staged",
  "committed",
  "rejected"
] as const;

export type PendingKnowledgeUpdateStatus =
  (typeof PendingKnowledgeUpdateStatusValues)[number];

export const DailyIntentValues = [
  "continue_next_unit",
  "approve_current_unit",
  "reject_current_unit",
  "revise_current_unit",
  "show_status",
  "show_pending_review",
  "stop_auto_production"
] as const;

export type DailyIntent = (typeof DailyIntentValues)[number];

export const WorkflowStatusValues = [
  "idle",
  "ready_to_produce",
  "producing",
  "awaiting_user_review",
  "blocked"
] as const;

export type WorkflowStatus = (typeof WorkflowStatusValues)[number];

export const ProductionRunStatusValues = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled"
] as const;

export type ProductionRunStatus = (typeof ProductionRunStatusValues)[number];

export const ProductionStepStatusValues = [
  "pending",
  "running",
  "completed",
  "failed",
  "skipped"
] as const;

export type ProductionStepStatus =
  (typeof ProductionStepStatusValues)[number];

export const QualityGateSeverityValues = ["P0", "P1", "P2", "P3"] as const;

export type QualityGateSeverity = (typeof QualityGateSeverityValues)[number];

export const QualityGateStatusValues = ["passed", "failed"] as const;

export type QualityGateStatus = (typeof QualityGateStatusValues)[number];

export type StoryProject = {
  id: string;
  title: string;
  contentType: ContentType;
  workflowProfile: WorkflowProfile;
  language: string;
  targetPlatform?: string;
  targetWords?: number;
  targetUnits?: number;
  unitName: UnitName;
};

export type WorkUnit = {
  id: string;
  type: WorkUnitType;
  index: number;
  title: string;
  displayTitle: string;
  filenameTitle?: string;
  slug?: string;
  status: WorkUnitStatus;
  outputFile?: string;
  stagedOutputFile?: string;
  revisionDir?: string;
};

export type NarrativeEntity = {
  id: string;
  type: string;
  name: string;
  aliases?: string[];
  status: FactStatus;
  sourceRefs?: string[];
};

export type WorkflowState = {
  status: WorkflowStatus;
  projectId?: string;
  currentUnitId?: string;
  currentRunId?: string;
  blockedBy?: string;
  updatedAt: string;
};

export type ProductionStep = {
  id: string;
  name: string;
  status: ProductionStepStatus;
  startedAt?: string;
  endedAt?: string;
  error?: string;
  reportFile?: string;
};

export type ProductionRun = {
  id: string;
  status: ProductionRunStatus;
  unitId?: string;
  steps: ProductionStep[];
  startedAt: string;
  endedAt?: string;
  reportFile?: string;
};

export type PendingKnowledgeUpdate = {
  id: string;
  unitId: string;
  status: PendingKnowledgeUpdateStatus;
  facts: unknown[];
  createdAt: string;
  committedAt?: string;
  rejectedAt?: string;
};

export type QualityGateFinding = {
  id: string;
  severity: QualityGateSeverity;
  message: string;
  sourceRef?: string;
};

export type QualityGateResult = {
  id: string;
  gate: string;
  status: QualityGateStatus;
  findings: QualityGateFinding[];
  createdAt: string;
};
