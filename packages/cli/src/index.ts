import { constants } from "node:fs";
import { access, mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import process from "node:process";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  findMissingCodexAgentsRules,
  upsertCodexAgentsSection
} from "../../adapters-codex/dist/index.js";
import {
  findMissingClaudeDailyFlowRules,
  renderClaudeSkillFiles,
  upsertClaudeMdSection
} from "../../adapters-claude/dist/index.js";
import {
  assertNovelExportFormat,
  createNovelExport,
  type NovelExportChapter,
  type NovelExportFormat
} from "../../exporters/dist/index.js";
import {
  indexStoryProject,
  initializeStoryDatabase,
  readStructuredStoryContext,
  searchStoryIndex,
  type IndexStoryProjectResult,
  type SearchStoryIndexHit,
  type SearchStoryIndexResult,
  type StructuredStoryContextSource
} from "../../indexer/dist/index.js";
import {
  commitPendingKnowledgeUpdate,
  createPendingKnowledgeUpdate,
  listPendingKnowledgeUpdateIds,
  readMarkdownWithFrontMatter,
  readPendingKnowledgeUpdate,
  rejectPendingKnowledgeUpdate,
  validatePendingKnowledgeFactDraft,
  writeMarkdownWithFrontMatter,
  writePendingKnowledgeUpdate,
  type PendingKnowledgeFactDraft,
  type PendingKnowledgeUpdate,
  type PendingKnowledgeUpdatePayload
} from "../../knowledge/dist/index.js";
import {
  renderStoryPrompt,
  type ContentType as PromptContentType,
  type StoryPromptContextSource,
  type WorkflowProfile as PromptWorkflowProfile
} from "../../prompts/dist/index.js";
import {
  blocksAutomaticBatchProduction,
  planAutomaticRevisionStrategy,
  runAiTasteGate,
  runConsistencyGate,
  runQualityGate,
  writeQualityGateReport,
  type AutomaticRevisionPlan,
  type QualityGateFinding,
  type QualityGateResult,
  type QualityGateSeverity,
  type QualityGateStatus
} from "../../quality-gates/dist/index.js";
import {
  createWorkUnit,
  createNextWorkUnit,
  formatWorkUnitDisplayTitle,
  sanitizeFilenameTitle,
  validateWorkUnit,
  type WorkUnit
} from "../../workflow-engine/dist/work-unit.js";

export const VERSION = "0.0.0";

const ContentTypeValues = [
  "short_story",
  "novella",
  "novel",
  "webnovel",
  "superlong_webnovel",
  "screenplay",
  "short_drama",
  "audio_drama",
  "comic_script",
  "interactive_story",
  "game_narrative",
  "story_bible"
] as const;

const WorkflowProfileValues = ["lite", "standard", "longform", "production"] as const;

type ContentType = (typeof ContentTypeValues)[number];
type WorkflowProfile = (typeof WorkflowProfileValues)[number];

type Writable = {
  write(chunk: string): unknown;
};

export type StoryctlIO = {
  stdout: Writable;
  stderr: Writable;
};

type ProjectConfig = {
  project: {
    title: string;
    content_type: ContentType;
    workflow_profile: WorkflowProfile;
    language: string;
    target_platform: string;
    target_words: number;
    target_units: number;
    unit_name: "chapter";
  };
  writing: {
    words_per_unit_min: number;
    words_per_unit_max: number;
    rolling_plan_units: number;
    review_frequency: string;
    replan_frequency: string;
    output_dir: string;
    output_format: string;
    chapter_filename: string;
    chapter_heading: string;
    chapter_number_padding: number;
  };
  production: {
    interaction_mode: string;
    auto_produce_unit: boolean;
    auto_revise_before_user_review: boolean;
    stop_after_unit_for_user_acceptance: boolean;
    progress_visible: boolean;
    allow_batch_production: boolean;
    max_batch_units_without_user_review: number;
  };
  knowledge: {
    wiki_required: boolean;
    search_mode: string;
    fact_extraction_required: boolean;
  };
  quality: {
    ai_taste_gate: string;
    commercial_review: string;
    reader_review: string;
    continuity_gate: string;
  };
  adapters: {
    installed: string[];
    mcp: {
      enabled: boolean;
    };
  };
};

type InitOptions = {
  contentType: ContentType;
  cwd: string;
  force: boolean;
  now: string;
  workflowProfile: WorkflowProfile;
};

type AdapterName = "codex" | "claude-code";

type DoctorOptions = {
  adapter?: AdapterName;
  cwd: string;
};

type AdapterInstallOptions = {
  adapter: AdapterName;
  cliOnly: boolean;
  cwd: string;
};

type IndexOptions = {
  cwd: string;
  includeStaged: boolean;
  rebuild: boolean;
};

type SearchOptions = {
  cwd: string;
  includeStaged: boolean;
  query: string;
};

type ContextOptions = {
  cwd: string;
  unit: string;
};

type ProduceNextOptions = {
  cwd: string;
  now: string;
  onProgress?: (event: ProduceProgressEvent) => void;
};

type ProducePacketOptions = {
  cwd: string;
  now: string;
  unit: string;
};

type DraftSubmitOptions = {
  cwd: string;
  fromFile: string;
  now: string;
  title: string;
  unit: string;
};

type ContinueOptions = {
  cwd: string;
  now: string;
  onProgress?: (event: ProduceProgressEvent) => void;
};

type ApproveOptions = {
  continueProduction: boolean;
  cwd: string;
  now: string;
  unit: string;
};

type RejectOptions = {
  cwd: string;
  now: string;
  reason: string;
  unit: string;
};

type ReviseMode = "light" | "rewrite" | "add_hook" | "reduce_fluff";

type ReviseOptions = {
  cwd: string;
  mode: ReviseMode;
  now: string;
  unit: string;
};

type RenameOptions = {
  cwd: string;
  now: string;
  title: string;
  unit: string;
};

type ReplanRange = {
  end: number;
  label: string;
  start: number;
};

type ReplanOptions = {
  cwd: string;
  now: string;
  range: ReplanRange;
};

type StoryExportOptions = {
  cwd: string;
  format: NovelExportFormat;
  includeStaged: boolean;
};

type ImportChaptersOptions = {
  cwd: string;
  fromDir: string;
  now: string;
};

type McpEnableOptions = {
  cwd: string;
};

type WorkflowStatus =
  | "idle"
  | "ready_to_produce"
  | "producing"
  | "awaiting_user_review"
  | "blocked";

type ProductionRunStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

type ProductionStepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

type WorkflowState = {
  blockedBy?: string;
  currentRunId?: string;
  currentUnit?: string;
  currentUnitId?: string;
  lastError?: string;
  stagedOutputFile?: string;
  status: WorkflowStatus;
  updatedAt?: string;
};

type ProductionStep = {
  endedAt?: string;
  error?: string;
  id: string;
  name: string;
  reportFile?: string;
  startedAt?: string;
  status: ProductionStepStatus;
};

type ProductionRun = {
  endedAt?: string;
  id: string;
  pendingKnowledgeUpdateFile?: string;
  quality?: DraftQualitySummary;
  reportFile?: string;
  startedAt: string;
  status: ProductionRunStatus;
  steps: ProductionStep[];
  stagedOutputFile?: string;
  unitId?: string;
};

type ResumeReport = {
  currentUnitId: string | null;
  currentWorkUnit: string;
  failedStep: ProductionStep | null;
  indexStatus: string;
  latestRun: ProductionRun | null;
  nextAction: string;
  pendingReview: string;
  stagedOutputFile: string;
  workflowStatus: string;
};

type CheckLevel = "ok" | "warn" | "error";

type DoctorCheck = {
  level: CheckLevel;
  label: string;
  message: string;
};

type RuntimeDirectoryReport = {
  level: CheckLevel;
  message: string;
  storymakerExists: boolean;
  storyosExists: boolean;
};

type StatusReport = {
  adapters: string[];
  contentType: string;
  currentUnitId: string | null;
  currentWorkUnit: string;
  indexStatus: string;
  pendingReview: string;
  projectTitle: string;
  stagedOutputFile: string | null;
  workflowProfile: string;
  workflowStatus: string;
};

type ContextSource = {
  origins: string[];
  sourcePath: string;
  summary: string;
  title: string;
};

type ContextReport = {
  gaps: string[];
  indexStatus: string;
  promptReadyContext: string;
  sources: ContextSource[];
  unit: string;
};

type ProduceNextReport = {
  acceptance: FinalAcceptanceSummary;
  completedSteps: number;
  pendingKnowledgeUpdateFile: string;
  reportFile: string;
  runFile: string;
  runId: string;
  stagedOutputFile: string;
  totalSteps: number;
  workUnit: WorkUnit;
};

type WorkPacketProjectSummary = {
  contentType: ContentType;
  language: string;
  targetPlatform: string;
  title: string;
  unitName: string;
  workflowProfile: WorkflowProfile;
};

type WorkPacketOutputTarget = {
  draftPath: string;
  format: string;
  knowledgeUpdatePath: string;
  qualityReportPath: string;
};

type WorkPacket = {
  constraints: string[];
  contentFormat: string;
  context: {
    gaps: string[];
    indexStatus: string;
    promptReadyContext: string;
    sources: ContextSource[];
    unit: string;
  };
  generatedAt: string;
  generation: {
    prompt: string;
    templateId: "story-draft";
  };
  id: string;
  outputTarget: WorkPacketOutputTarget;
  project: WorkPacketProjectSummary;
  qualityGates: string[];
  unitSelector: string;
  workUnit: WorkUnit;
};

type DraftSubmitReport = {
  pendingKnowledgeUpdateFile: string;
  quality: DraftQualitySummary;
  reportFile: string;
  runFile: string;
  runId: string;
  sourceFile: string;
  stagedOutputFile: string;
  unitId: string;
  workflowStatus: WorkflowStatus;
  workUnit: WorkUnit;
};

type DraftQualityGateSummary = {
  findingCount: number;
  findings: QualityGateFinding[];
  gate: string;
  highestSeverity: QualityGateSeverity | null;
  reportFile: string;
  status: QualityGateStatus;
  summary?: string;
};

type DraftQualityApprovalRecommendation =
  | "approve"
  | "approve_with_notes"
  | "revise_before_approval"
  | "manual_review_required";

type DraftQualitySettingImpact =
  | "none_detected"
  | "possible_setting_impact"
  | "setting_review_required";

type DraftQualityAuthorIssue = {
  affectsSetting: boolean;
  gate: string;
  message: string;
  severity: QualityGateSeverity;
  snippet?: string;
  sourceRef?: string;
  suggestion?: string;
};

type DraftQualityAuthorSummary = {
  approvalRecommendation: DraftQualityApprovalRecommendation;
  majorIssues: DraftQualityAuthorIssue[];
  overallConclusion: string;
  recommendedToApprove: boolean;
  settingImpact: DraftQualitySettingImpact;
  summaryText: string;
};

type DraftQualitySummary = {
  automaticRevision: AutomaticRevisionPlan;
  authorSummary: DraftQualityAuthorSummary;
  blocksBatchContinue: boolean;
  gateReports: DraftQualityGateSummary[];
  highestSeverity: QualityGateSeverity | null;
  p2Suggestions: string[];
  p3Suggestions: string[];
  reportFile: string;
  status: QualityGateStatus;
  totalFindings: number;
};

type ContinueReport = {
  action: "produced_next_unit" | "show_pending_review" | "show_resume_guidance" | "show_blocker";
  acceptance: FinalAcceptanceSummary | null;
  currentUnitId: string | null;
  nextAction: string;
  production: ProduceNextReport | null;
  reportFile: string | null;
  resume: ResumeReport;
  stagedOutputFile: string | null;
  status: string;
};

type ApproveReport = {
  checkpointFile: string;
  committedKnowledgeFile: string;
  outputFile: string;
  pendingKnowledgeUpdateFile: string;
  unitId: string;
  workflowStatus: WorkflowStatus;
  workUnit: WorkUnit;
};

type RejectReport = {
  pendingKnowledgeUpdateFile: string;
  reasonFile: string;
  rejectedRevisionFile: string;
  revisionDir: string;
  unitId: string;
  workflowStatus: WorkflowStatus;
  workUnit: WorkUnit;
};

type JsonOutputSelection = {
  args: string[];
  json: boolean;
};

type ReviseReport = {
  mode: ReviseMode;
  pendingKnowledgeUpdateFile: string;
  quality: DraftQualitySummary;
  reportFile: string;
  runFile: string;
  runId: string;
  stagedOutputFile: string;
  unitId: string;
  workflowStatus: WorkflowStatus;
  workUnit: WorkUnit;
};

type RenameReport = {
  newOutputFile: string;
  oldOutputFile: string;
  title: string;
  unitId: string;
  workflowStatus: WorkflowStatus;
  workUnit: WorkUnit;
};

type ReplanOption = {
  advantages: string[];
  id: number;
  readerExpectations: string[];
  risks: string[];
  summary: string;
  title: string;
};

type ReplanReport = {
  changeLogFile: string;
  options: ReplanOption[];
  range: ReplanRange;
  status: "pending_user_confirmation";
};

type StoryExportReport = {
  exportFile: string;
  fidelity: "placeholder" | "real";
  format: NovelExportFormat;
  includedChapters: Array<{
    id: string;
    sourcePath: string;
    title: string;
  }>;
  placeholderNote?: string;
  skippedChapters: Array<{
    id: string;
    sourcePath: string;
    title: string;
  }>;
};

type ImportedChapter = {
  id: string;
  outputFile: string;
  sourceFile: string;
  title: string;
};

type ImportChaptersReport = {
  importedChapters: ImportedChapter[];
  indexResult: IndexStoryProjectResult;
  knowledgeFile: string;
};

type McpEnableReport = {
  enabled: boolean;
  projectFile: string;
};

type AdapterInstallReport = {
  adapter: AdapterName;
  agentsFile?: string;
  backupFiles: string[];
  claudeFile?: string;
  installedAdapters: string[];
  mode: "cli-only";
  projectFile: string;
  skillFiles: string[];
};

export type ProduceProgressEvent = {
  error?: string;
  index: number;
  status: ProductionStepStatus;
  stepId: string;
  stepName: string;
  total: number;
};

export type FinalAcceptanceSummary = {
  draftPath: string | null;
  qualityReportPath: string | null;
  question: string;
  unitId: string | null;
};

export type ChapterMarkdownOutputPlanOptions = {
  outputDir: string;
  outputFormat: string;
  title: string;
};

export type ChapterMarkdownOutputPlan = {
  markdownTitle: string;
  relativePath: string;
};

export type StoryctlRunOptions = {
  cwd?: string;
  now?: string;
};

export type DashboardCommandOptions = {
  cwd: string;
  host: string;
  once: boolean;
  port: number;
};

type DashboardServerHandle = {
  close: () => Promise<void>;
  host: string;
  port: number;
  url: string;
};

type DashboardModule = {
  startDashboardServer: (options: {
    cwd: string;
    host?: string;
    port?: number;
  }) => Promise<DashboardServerHandle>;
};

const DASHBOARD_BUILD_COMMAND = "corepack pnpm build:dashboard";
const DASHBOARD_MODULE_PATH = "../../../apps/dashboard/dist/index.js";

export const HELP_TEXT = `StoryMaker command line interface

Usage:
  storymaker init --type <content_type> --profile <workflow_profile> [--force]
  storymaker adapter install codex --cli-only
  storymaker adapter install claude-code --cli-only
  storymaker status
  storymaker doctor [--adapter codex|claude-code]
  storymaker index [rebuild] [--include-staged]
  storymaker search [--include-staged] <query>
  storymaker context --unit <unit>
  storymaker dashboard [--host <host>] [--port <port>]
  storymaker produce next --placeholder
  storymaker produce packet --unit next [--json]
  storymaker draft submit --unit <unit> --from <file> --title <title>
  storymaker continue [--json]
  storymaker approve --unit <unit> [--continue]
  storymaker reject --unit <unit> --reason <reason>
  storymaker revise --unit <unit> --mode light|rewrite|add_hook|reduce_fluff
  storymaker rename --unit <unit> --title <title>
  storymaker replan --range <start-end>
  storymaker export --format txt|md|docx|epub [--include-staged]
  storymaker import chapters --from <dir>
  storymaker mcp enable
  storymaker resume
  storymaker --help
  storymaker --version

Commands:
  init          Initialize a CLI-only StoryMaker project in the current directory.
  adapter       Install StoryMaker client adapters.
  status        Show current StoryMaker project status.
  doctor        Check project and adapter health.
  index         Update or rebuild the SQLite Markdown index.
  search        Search the SQLite Markdown index.
  context       Build prompt-ready context for a work unit.
  dashboard     Start the local StoryMaker Dashboard.
  produce       Run production helpers such as next or packet.
  draft         Submit AI-generated drafts into the staged review workflow.
  continue      Advance to the next safe workflow step.
  approve       Approve a staged work unit and commit canon knowledge.
  reject        Reject a staged work unit and preserve it as a revision.
  revise        Create a new staged revision for a rejected work unit.
  rename        Rename a work unit title and synchronize chapter output files.
  replan        Propose follow-up plan options for a unit range.
  export        Export novel chapters.
  import        Import existing novel chapters.
  mcp           Enable or inspect optional MCP integration.
  resume        Show how to continue the current StoryMaker workflow.

Options:
  --type        Content type, for example superlong_webnovel.
  --profile     Workflow profile, for example production.
  --adapter     Adapter to check with doctor.
  --cli-only    Install an adapter using files + storyctl only.
  --include-staged Include staged Markdown in index commands.
  --unit        Work unit number or id for context/approve.
  --reason      Reason text for rejecting a staged work unit.
  --mode        Revision mode for revise.
  --title       New title for rename.
  --range       Unit range for replan, for example 21-30.
  --format      Export format: txt, md, docx, or epub.
  --from        Source directory for import chapters, or source Markdown for draft submit.
  --host        Dashboard bind host, defaults to 127.0.0.1.
  --port        Dashboard bind port, defaults to 4173. Use 0 to auto-pick.
  --once        Start dashboard, print the URL, then stop; intended for automation.
  --continue    Continue to the next production run after approve.
  --json        Print machine-readable JSON for agent-facing commands.
  --force       Overwrite StoryOS-managed template files.
  -h, --help    Show this help text.
  -v, --version Show the CLI version.

Compatibility:
  storyctl remains supported as an alias for storymaker during the StoryMaker transition.
`;

class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliError";
  }
}

const createDefaultIO = (): StoryctlIO => ({
  stdout: process.stdout,
  stderr: process.stderr
});

const isContentType = (value: string): value is ContentType =>
  ContentTypeValues.includes(value as ContentType);

const isWorkflowProfile = (value: string): value is WorkflowProfile =>
  WorkflowProfileValues.includes(value as WorkflowProfile);

const requireOptionValue = (args: readonly string[], index: number, option: string): string => {
  const value = args[index + 1];

  if (value === undefined || value.startsWith("-")) {
    throw new CliError(`Missing value for ${option}.`);
  }

  return value;
};

const resolveTargetCwd = (runOptions: StoryctlRunOptions): string =>
  resolve(runOptions.cwd ?? process.env.STORYOS_CWD ?? process.env.INIT_CWD ?? process.cwd());

const parseDashboardPort = (value: string): number => {
  const port = Number(value);

  if (!Number.isInteger(port) || port < 0 || port > 65_535 || !Number.isFinite(port)) {
    throw new CliError(`Invalid dashboard port: ${value}.`);
  }

  return port;
};

const parseDashboardArgs = (
  args: readonly string[],
  runOptions: StoryctlRunOptions
): DashboardCommandOptions => {
  let host = "127.0.0.1";
  let once = false;
  let port = 4173;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--once") {
      once = true;
      continue;
    }

    if (arg === "--host") {
      host = requireOptionValue(args, index, "--host");
      index += 1;
      continue;
    }

    if (arg.startsWith("--host=")) {
      host = arg.slice("--host=".length);
      continue;
    }

    if (arg === "--port") {
      port = parseDashboardPort(requireOptionValue(args, index, "--port"));
      index += 1;
      continue;
    }

    if (arg.startsWith("--port=")) {
      port = parseDashboardPort(arg.slice("--port=".length));
      continue;
    }

    throw new CliError(`Unknown dashboard option: ${arg}.`);
  }

  if (!host.trim()) {
    throw new CliError("Dashboard host cannot be empty.");
  }

  return {
    cwd: resolveTargetCwd(runOptions),
    host,
    once,
    port
  };
};

const parseInitArgs = (args: readonly string[], runOptions: StoryctlRunOptions): InitOptions => {
  let contentType: ContentType = "superlong_webnovel";
  let workflowProfile: WorkflowProfile = "production";
  let force = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--force") {
      force = true;
      continue;
    }

    if (arg === "--type") {
      const value = requireOptionValue(args, index, "--type");

      if (!isContentType(value)) {
        throw new CliError(`Invalid content type: ${value}.`);
      }

      contentType = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--type=")) {
      const value = arg.slice("--type=".length);

      if (!isContentType(value)) {
        throw new CliError(`Invalid content type: ${value}.`);
      }

      contentType = value;
      continue;
    }

    if (arg === "--profile") {
      const value = requireOptionValue(args, index, "--profile");

      if (!isWorkflowProfile(value)) {
        throw new CliError(`Invalid workflow profile: ${value}.`);
      }

      workflowProfile = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--profile=")) {
      const value = arg.slice("--profile=".length);

      if (!isWorkflowProfile(value)) {
        throw new CliError(`Invalid workflow profile: ${value}.`);
      }

      workflowProfile = value;
      continue;
    }

    throw new CliError(`Unknown init option: ${arg}.`);
  }

  return {
    contentType,
    cwd: resolveTargetCwd(runOptions),
    force,
    now: runOptions.now ?? new Date().toISOString(),
    workflowProfile
  };
};

const parseAdapterName = (value: string): AdapterName => {
  if (value === "codex" || value === "claude-code") {
    return value;
  }

  throw new CliError(`Invalid adapter: ${value}.`);
};

const parseDoctorArgs = (
  args: readonly string[],
  runOptions: StoryctlRunOptions
): DoctorOptions => {
  let adapter: AdapterName | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--adapter") {
      adapter = parseAdapterName(requireOptionValue(args, index, "--adapter"));
      index += 1;
      continue;
    }

    if (arg.startsWith("--adapter=")) {
      adapter = parseAdapterName(arg.slice("--adapter=".length));
      continue;
    }

    throw new CliError(`Unknown doctor option: ${arg}.`);
  }

  return {
    adapter,
    cwd: resolveTargetCwd(runOptions)
  };
};

const parseAdapterInstallArgs = (
  args: readonly string[],
  runOptions: StoryctlRunOptions
): AdapterInstallOptions => {
  const [subcommand, adapter, ...rest] = args;

  if (subcommand !== "install") {
    throw new CliError(
      "Unknown adapter subcommand. Use: storyctl adapter install <codex|claude-code> --cli-only."
    );
  }

  if (adapter !== "codex" && adapter !== "claude-code") {
    throw new CliError(
      "Unknown adapter. Use: storyctl adapter install <codex|claude-code> --cli-only."
    );
  }

  let cliOnly = false;

  for (const arg of rest) {
    if (arg === "--cli-only") {
      cliOnly = true;
      continue;
    }

    throw new CliError(`Unknown adapter install option: ${arg}.`);
  }

  if (!cliOnly) {
    throw new CliError("Missing --cli-only for adapter install.");
  }

  return {
    adapter,
    cliOnly,
    cwd: resolveTargetCwd(runOptions)
  };
};

const parseIndexArgs = (args: readonly string[], runOptions: StoryctlRunOptions): IndexOptions => {
  let includeStaged = false;
  let rebuild = false;

  for (const arg of args) {
    if (arg === "rebuild") {
      rebuild = true;
      continue;
    }

    if (arg === "--include-staged") {
      includeStaged = true;
      continue;
    }

    throw new CliError(`Unknown index option: ${arg}.`);
  }

  return {
    cwd: resolveTargetCwd(runOptions),
    includeStaged,
    rebuild
  };
};

const parseSearchArgs = (
  args: readonly string[],
  runOptions: StoryctlRunOptions
): SearchOptions => {
  let includeStaged = false;
  const queryParts: string[] = [];

  for (const arg of args) {
    if (arg === "--include-staged") {
      includeStaged = true;
      continue;
    }

    queryParts.push(arg);
  }

  const query = queryParts.join(" ").trim();

  if (!query) {
    throw new CliError("Missing search query.");
  }

  return {
    cwd: resolveTargetCwd(runOptions),
    includeStaged,
    query
  };
};

const parseContextArgs = (
  args: readonly string[],
  runOptions: StoryctlRunOptions
): ContextOptions => {
  let unit = "";

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--unit") {
      unit = requireOptionValue(args, index, "--unit").trim();
      index += 1;
      continue;
    }

    if (arg.startsWith("--unit=")) {
      unit = arg.slice("--unit=".length).trim();
      continue;
    }

    throw new CliError(`Unknown context option: ${arg}.`);
  }

  if (!unit) {
    throw new CliError("Missing value for --unit.");
  }

  return {
    cwd: resolveTargetCwd(runOptions),
    unit
  };
};

const PLACEHOLDER_FALLBACK_MESSAGE =
  "Placeholder production is a development fallback. For the real daily path, run storymaker produce packet --unit next --json, write the draft, then run storymaker draft submit. To run the deterministic fallback, use storymaker produce next --placeholder.";

const parseProduceArgs = (
  args: readonly string[],
  runOptions: StoryctlRunOptions
): ProduceNextOptions => {
  const [subcommand, ...rest] = args;

  if (subcommand !== "next") {
    throw new CliError(
      "Unknown produce subcommand. Use: storymaker produce packet --unit next or storymaker produce next --placeholder."
    );
  }

  let placeholder = false;

  for (const arg of rest) {
    if (arg === "--placeholder") {
      placeholder = true;
      continue;
    }

    throw new CliError(`Unknown produce next option: ${arg}.`);
  }

  if (!placeholder) {
    throw new CliError(PLACEHOLDER_FALLBACK_MESSAGE);
  }

  return {
    cwd: resolveTargetCwd(runOptions),
    now: runOptions.now ?? new Date().toISOString()
  };
};

const parseProducePacketArgs = (
  args: readonly string[],
  runOptions: StoryctlRunOptions
): ProducePacketOptions => {
  const [subcommand, ...rest] = args;

  if (subcommand !== "packet") {
    throw new CliError(
      "Unknown produce subcommand. Use: storymaker produce packet --unit next or storymaker produce next --placeholder."
    );
  }

  let unit = "";

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];

    if (arg === "--unit") {
      unit = requireOptionValue(rest, index, "--unit").trim();
      index += 1;
      continue;
    }

    if (arg.startsWith("--unit=")) {
      unit = arg.slice("--unit=".length).trim();
      continue;
    }

    throw new CliError(`Unknown produce packet option: ${arg}.`);
  }

  if (!unit) {
    throw new CliError("Missing value for --unit.");
  }

  return {
    cwd: resolveTargetCwd(runOptions),
    now: runOptions.now ?? new Date().toISOString(),
    unit
  };
};

const parseApproveArgs = (
  args: readonly string[],
  runOptions: StoryctlRunOptions
): ApproveOptions => {
  let continueProduction = false;
  let unit = "";

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--unit") {
      unit = requireOptionValue(args, index, "--unit").trim();
      index += 1;
      continue;
    }

    if (arg.startsWith("--unit=")) {
      unit = arg.slice("--unit=".length).trim();
      continue;
    }

    if (arg === "--continue") {
      continueProduction = true;
      continue;
    }

    throw new CliError(`Unknown approve option: ${arg}.`);
  }

  if (!unit) {
    throw new CliError("Missing value for --unit.");
  }

  return {
    continueProduction,
    cwd: resolveTargetCwd(runOptions),
    now: runOptions.now ?? new Date().toISOString(),
    unit
  };
};

const parseDraftSubmitArgs = (
  args: readonly string[],
  runOptions: StoryctlRunOptions
): DraftSubmitOptions => {
  const [subcommand, ...rest] = args;

  if (subcommand !== "submit") {
    throw new CliError(
      "Unknown draft subcommand. Use: storyctl draft submit --unit <unit> --from <file> --title <title>."
    );
  }

  let fromFile = "";
  let title = "";
  let unit = "";

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];

    if (arg === "--unit") {
      unit = requireOptionValue(rest, index, "--unit").trim();
      index += 1;
      continue;
    }

    if (arg.startsWith("--unit=")) {
      unit = arg.slice("--unit=".length).trim();
      continue;
    }

    if (arg === "--from") {
      fromFile = requireOptionValue(rest, index, "--from").trim();
      index += 1;
      continue;
    }

    if (arg.startsWith("--from=")) {
      fromFile = arg.slice("--from=".length).trim();
      continue;
    }

    if (arg === "--title") {
      title = requireOptionValue(rest, index, "--title").trim();
      index += 1;
      continue;
    }

    if (arg.startsWith("--title=")) {
      title = arg.slice("--title=".length).trim();
      continue;
    }

    throw new CliError(`Unknown draft submit option: ${arg}.`);
  }

  if (!unit) {
    throw new CliError("Missing value for --unit.");
  }

  if (!fromFile) {
    throw new CliError("Missing value for --from.");
  }

  if (!title) {
    throw new CliError("Missing value for --title.");
  }

  return {
    cwd: resolveTargetCwd(runOptions),
    fromFile,
    now: runOptions.now ?? new Date().toISOString(),
    title,
    unit
  };
};

const parseRejectArgs = (
  args: readonly string[],
  runOptions: StoryctlRunOptions
): RejectOptions => {
  let reason = "";
  let unit = "";

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--unit") {
      unit = requireOptionValue(args, index, "--unit").trim();
      index += 1;
      continue;
    }

    if (arg.startsWith("--unit=")) {
      unit = arg.slice("--unit=".length).trim();
      continue;
    }

    if (arg === "--reason") {
      reason = requireOptionValue(args, index, "--reason").trim();
      index += 1;
      continue;
    }

    if (arg.startsWith("--reason=")) {
      reason = arg.slice("--reason=".length).trim();
      continue;
    }

    throw new CliError(`Unknown reject option: ${arg}.`);
  }

  if (!unit) {
    throw new CliError("Missing value for --unit.");
  }

  if (!reason) {
    throw new CliError("Missing value for --reason.");
  }

  return {
    cwd: resolveTargetCwd(runOptions),
    now: runOptions.now ?? new Date().toISOString(),
    reason,
    unit
  };
};

const ReviseModeValues: readonly ReviseMode[] = ["light", "rewrite", "add_hook", "reduce_fluff"];

const parseReviseMode = (value: string): ReviseMode => {
  if (ReviseModeValues.includes(value as ReviseMode)) {
    return value as ReviseMode;
  }

  throw new CliError(`Invalid revise mode: ${value}. Use one of: ${ReviseModeValues.join(", ")}.`);
};

const parseReviseArgs = (
  args: readonly string[],
  runOptions: StoryctlRunOptions
): ReviseOptions => {
  let mode: ReviseMode | undefined;
  let unit = "";

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--unit") {
      unit = requireOptionValue(args, index, "--unit").trim();
      index += 1;
      continue;
    }

    if (arg.startsWith("--unit=")) {
      unit = arg.slice("--unit=".length).trim();
      continue;
    }

    if (arg === "--mode") {
      mode = parseReviseMode(requireOptionValue(args, index, "--mode").trim());
      index += 1;
      continue;
    }

    if (arg.startsWith("--mode=")) {
      mode = parseReviseMode(arg.slice("--mode=".length).trim());
      continue;
    }

    throw new CliError(`Unknown revise option: ${arg}.`);
  }

  if (!unit) {
    throw new CliError("Missing value for --unit.");
  }

  if (mode === undefined) {
    throw new CliError("Missing value for --mode.");
  }

  return {
    cwd: resolveTargetCwd(runOptions),
    mode,
    now: runOptions.now ?? new Date().toISOString(),
    unit
  };
};

const parseRenameArgs = (
  args: readonly string[],
  runOptions: StoryctlRunOptions
): RenameOptions => {
  let title = "";
  let unit = "";

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--unit") {
      unit = requireOptionValue(args, index, "--unit").trim();
      index += 1;
      continue;
    }

    if (arg.startsWith("--unit=")) {
      unit = arg.slice("--unit=".length).trim();
      continue;
    }

    if (arg === "--title") {
      title = requireOptionValue(args, index, "--title").trim();
      index += 1;
      continue;
    }

    if (arg.startsWith("--title=")) {
      title = arg.slice("--title=".length).trim();
      continue;
    }

    throw new CliError(`Unknown rename option: ${arg}.`);
  }

  if (!unit) {
    throw new CliError("Missing value for --unit.");
  }

  if (!title) {
    throw new CliError("Missing value for --title.");
  }

  return {
    cwd: resolveTargetCwd(runOptions),
    now: runOptions.now ?? new Date().toISOString(),
    title,
    unit
  };
};

const parseReplanRange = (value: string): ReplanRange => {
  const normalized = value.trim();
  const match = /^(\d+)-(\d+)$/.exec(normalized);

  if (match === null) {
    throw new CliError(`Invalid replan range: ${value}. Use <start-end>, for example 21-30.`);
  }

  const start = Number(match[1]);
  const end = Number(match[2]);

  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start) {
    throw new CliError(`Invalid replan range: ${value}. Use positive integers with start <= end.`);
  }

  return {
    end,
    label: `${start}-${end}`,
    start
  };
};

const parseReplanArgs = (
  args: readonly string[],
  runOptions: StoryctlRunOptions
): ReplanOptions => {
  let range: ReplanRange | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--range") {
      range = parseReplanRange(requireOptionValue(args, index, "--range"));
      index += 1;
      continue;
    }

    if (arg.startsWith("--range=")) {
      range = parseReplanRange(arg.slice("--range=".length));
      continue;
    }

    throw new CliError(`Unknown replan option: ${arg}.`);
  }

  if (range === undefined) {
    throw new CliError("Missing value for --range.");
  }

  return {
    cwd: resolveTargetCwd(runOptions),
    now: runOptions.now ?? new Date().toISOString(),
    range
  };
};

const parseStoryExportArgs = (
  args: readonly string[],
  runOptions: StoryctlRunOptions
): StoryExportOptions => {
  let format: NovelExportFormat | undefined;
  let includeStaged = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--format") {
      format = assertNovelExportFormat(requireOptionValue(args, index, "--format").trim());
      index += 1;
      continue;
    }

    if (arg.startsWith("--format=")) {
      format = assertNovelExportFormat(arg.slice("--format=".length).trim());
      continue;
    }

    if (arg === "--include-staged") {
      includeStaged = true;
      continue;
    }

    throw new CliError(`Unknown export option: ${arg}.`);
  }

  if (format === undefined) {
    throw new CliError("Missing value for --format.");
  }

  return {
    cwd: resolveTargetCwd(runOptions),
    format,
    includeStaged
  };
};

const parseImportChaptersArgs = (
  args: readonly string[],
  runOptions: StoryctlRunOptions
): ImportChaptersOptions => {
  const [subcommand, ...rest] = args;

  if (subcommand !== "chapters") {
    throw new CliError("Unknown import subcommand. Use: storyctl import chapters --from <dir>.");
  }

  const cwd = resolveTargetCwd(runOptions);
  let fromDir = "";

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];

    if (arg === "--from") {
      fromDir = requireOptionValue(rest, index, "--from").trim();
      index += 1;
      continue;
    }

    if (arg.startsWith("--from=")) {
      fromDir = arg.slice("--from=".length).trim();
      continue;
    }

    throw new CliError(`Unknown import chapters option: ${arg}.`);
  }

  if (!fromDir) {
    throw new CliError("Missing value for --from.");
  }

  return {
    cwd,
    fromDir: resolve(cwd, fromDir),
    now: runOptions.now ?? new Date().toISOString()
  };
};

const parseMcpArgs = (
  args: readonly string[],
  runOptions: StoryctlRunOptions
): McpEnableOptions => {
  const [subcommand, ...rest] = args;

  if (subcommand !== "enable") {
    throw new CliError("Unknown mcp subcommand. Use: storyctl mcp enable.");
  }

  if (rest.length > 0) {
    throw new CliError(`Unknown mcp enable option: ${rest[0]}.`);
  }

  return {
    cwd: resolveTargetCwd(runOptions)
  };
};

const parseNoArgsCommand = (
  command: string,
  args: readonly string[],
  runOptions: StoryctlRunOptions
): { cwd: string } => {
  if (args.length > 0) {
    throw new CliError(`Unknown ${command} option: ${args[0]}.`);
  }

  return {
    cwd: resolveTargetCwd(runOptions)
  };
};

export const buildProjectConfig = (
  contentType: ContentType,
  workflowProfile: WorkflowProfile
): ProjectConfig => {
  const config: ProjectConfig = {
    project: {
      title: "未定名项目",
      content_type: contentType,
      workflow_profile: workflowProfile,
      language: "zh-CN",
      target_platform: "未指定",
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
    },
    adapters: {
      installed: [],
      mcp: {
        enabled: false
      }
    }
  };

  validateProjectConfig(config);
  return config;
};

const validatePositiveInteger = (value: number, field: string): void => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new CliError(`Invalid project config field: ${field}.`);
  }
};

const validateProjectConfig = (config: ProjectConfig): void => {
  if (!config.project.title) {
    throw new CliError("Invalid project config field: project.title.");
  }

  if (!isContentType(config.project.content_type)) {
    throw new CliError("Invalid project config field: project.content_type.");
  }

  if (!isWorkflowProfile(config.project.workflow_profile)) {
    throw new CliError("Invalid project config field: project.workflow_profile.");
  }

  validatePositiveInteger(config.project.target_words, "project.target_words");
  validatePositiveInteger(config.project.target_units, "project.target_units");
  validatePositiveInteger(config.writing.words_per_unit_min, "writing.words_per_unit_min");
  validatePositiveInteger(config.writing.words_per_unit_max, "writing.words_per_unit_max");
  validatePositiveInteger(config.writing.rolling_plan_units, "writing.rolling_plan_units");
  validatePositiveInteger(config.writing.chapter_number_padding, "writing.chapter_number_padding");
  validatePositiveInteger(
    config.production.max_batch_units_without_user_review,
    "production.max_batch_units_without_user_review"
  );
};

const quoteYaml = (value: string): string =>
  `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;

const renderYamlStringArray = (values: readonly string[]): string =>
  values.length === 0 ? "[]" : `[${values.map(quoteYaml).join(", ")}]`;

export const renderProjectYaml = (config: ProjectConfig): string => `project:
  title: ${quoteYaml(config.project.title)}
  content_type: ${quoteYaml(config.project.content_type)}
  workflow_profile: ${quoteYaml(config.project.workflow_profile)}
  language: ${quoteYaml(config.project.language)}
  target_platform: ${quoteYaml(config.project.target_platform)}
  target_words: ${config.project.target_words}
  target_units: ${config.project.target_units}
  unit_name: ${quoteYaml(config.project.unit_name)}

writing:
  words_per_unit_min: ${config.writing.words_per_unit_min}
  words_per_unit_max: ${config.writing.words_per_unit_max}
  rolling_plan_units: ${config.writing.rolling_plan_units}
  review_frequency: ${quoteYaml(config.writing.review_frequency)}
  replan_frequency: ${quoteYaml(config.writing.replan_frequency)}
  output_dir: ${quoteYaml(config.writing.output_dir)}
  output_format: ${quoteYaml(config.writing.output_format)}
  chapter_filename: ${quoteYaml(config.writing.chapter_filename)}
  chapter_heading: ${quoteYaml(config.writing.chapter_heading)}
  chapter_number_padding: ${config.writing.chapter_number_padding}

production:
  interaction_mode: ${quoteYaml(config.production.interaction_mode)}
  auto_produce_unit: ${config.production.auto_produce_unit}
  auto_revise_before_user_review: ${config.production.auto_revise_before_user_review}
  stop_after_unit_for_user_acceptance: ${config.production.stop_after_unit_for_user_acceptance}
  progress_visible: ${config.production.progress_visible}
  allow_batch_production: ${config.production.allow_batch_production}
  max_batch_units_without_user_review: ${config.production.max_batch_units_without_user_review}

knowledge:
  wiki_required: ${config.knowledge.wiki_required}
  search_mode: ${quoteYaml(config.knowledge.search_mode)}
  fact_extraction_required: ${config.knowledge.fact_extraction_required}

quality:
  ai_taste_gate: ${quoteYaml(config.quality.ai_taste_gate)}
  commercial_review: ${quoteYaml(config.quality.commercial_review)}
  reader_review: ${quoteYaml(config.quality.reader_review)}
  continuity_gate: ${quoteYaml(config.quality.continuity_gate)}

adapters:
  installed: ${renderYamlStringArray(config.adapters.installed)}
  mcp:
    enabled: ${config.adapters.mcp.enabled}
`;

const getTemplateRoot = (): string =>
  resolve(dirname(fileURLToPath(import.meta.url)), "../../..", "templates", "base");

const directoryPaths = [
  "bible",
  "knowledge",
  "plans",
  join("outputs", "chapters"),
  "units",
  "reviews",
  "logs",
  "exports",
  ".storyos",
  join(".storyos", "index"),
  join(".storyos", "runs"),
  join(".storyos", "work-units"),
  join(".storyos", "pending-knowledge-updates"),
  join(".storyos", "checkpoints"),
  join(".storyos", "logs")
];

const managedFilePaths = [
  "project.yaml",
  "00-项目企划案.md",
  "00-项目假设.md",
  join(".storyos", "story.db"),
  join(".storyos", "workflow-state.json")
];

const fileExists = async (path: string): Promise<boolean> => {
  try {
    const existing = await stat(path);
    return existing.isFile();
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
};

const pathExists = async (path: string): Promise<boolean> => {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
};

const directoryExists = async (path: string): Promise<boolean> => {
  try {
    const existing = await stat(path);
    return existing.isDirectory();
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
};

const isNodeError = (error: unknown): error is NodeJS.ErrnoException =>
  error instanceof Error && "code" in error;

const assertWritableDirectory = async (path: string): Promise<void> => {
  await access(path);
};

export const initializeProject = async (options: InitOptions): Promise<void> => {
  const config = buildProjectConfig(options.contentType, options.workflowProfile);
  const templateRoot = getTemplateRoot();

  if (!options.force) {
    for (const relativePath of managedFilePaths) {
      const targetPath = join(options.cwd, relativePath);

      if (await fileExists(targetPath)) {
        throw new CliError(
          `Refusing to overwrite existing file: ${relativePath}. Use --force to replace StoryOS-managed files.`
        );
      }
    }
  }

  for (const relativePath of directoryPaths) {
    await mkdir(join(options.cwd, relativePath), {
      recursive: true
    });
  }

  await writeFile(join(options.cwd, "project.yaml"), renderProjectYaml(config), "utf8");

  for (const fileName of ["00-项目企划案.md", "00-项目假设.md"]) {
    const template = await readFile(join(templateRoot, fileName), "utf8");
    await writeFile(join(options.cwd, fileName), template, "utf8");
  }

  const storyDbPath = join(options.cwd, ".storyos", "story.db");
  if (options.force) {
    await writeFile(storyDbPath, "");
  }
  initializeStoryDatabase(storyDbPath);
  await writeFile(
    join(options.cwd, ".storyos", "workflow-state.json"),
    `${JSON.stringify(
      {
        status: "idle",
        updatedAt: options.now
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  await assertWritableDirectory(join(options.cwd, ".storyos"));
};

const addInstalledAdapter = (
  installed: readonly string[],
  canonicalAdapter: "codex" | "claude_code"
): string[] => {
  const aliases =
    canonicalAdapter === "claude_code"
      ? new Set(["claude_code", "claude-code"])
      : new Set([canonicalAdapter]);

  return [...installed.filter((adapter) => !aliases.has(adapter)), canonicalAdapter];
};

const nextBackupPath = async (filePath: string): Promise<string> => {
  const baseBackupPath = `${filePath}.bak`;

  if (!(await fileExists(baseBackupPath))) {
    return baseBackupPath;
  }

  for (let index = 1; index < 1000; index += 1) {
    const candidate = `${baseBackupPath}.${index}`;
    if (!(await fileExists(candidate))) {
      return candidate;
    }
  }

  throw new CliError(`Unable to choose a backup path for ${filePath}.`);
};

const writeGeneratedFileWithBackup = async (
  filePath: string,
  content: string
): Promise<string | null> => {
  await mkdir(dirname(filePath), {
    recursive: true
  });

  if (!(await fileExists(filePath))) {
    await writeFile(filePath, content, "utf8");
    return null;
  }

  const existing = await readFile(filePath, "utf8");

  if (existing === content) {
    return null;
  }

  const backupPath = await nextBackupPath(filePath);
  await writeFile(backupPath, existing, "utf8");
  await writeFile(filePath, content, "utf8");
  return backupPath;
};

export const installCodexAdapter = async (
  options: AdapterInstallOptions
): Promise<AdapterInstallReport> => {
  const projectYamlPath = join(options.cwd, "project.yaml");

  if (!(await fileExists(projectYamlPath))) {
    throw new CliError("Not a StoryOS project: missing project.yaml. Run storyctl init first.");
  }

  if (!options.cliOnly) {
    throw new CliError("Only --cli-only adapter installation is supported.");
  }

  if (options.adapter !== "codex") {
    throw new CliError("Expected codex adapter installation options.");
  }

  const config = parseProjectYaml(await readFile(projectYamlPath, "utf8"));
  const installedAdapters = addInstalledAdapter(config.adapters.installed, "codex");

  await writeFile(
    projectYamlPath,
    renderProjectYaml({
      ...config,
      adapters: {
        ...config.adapters,
        installed: installedAdapters
      }
    }),
    "utf8"
  );

  const agentsPath = join(options.cwd, "AGENTS.md");
  const existingAgents = (await fileExists(agentsPath))
    ? await readFile(agentsPath, "utf8")
    : undefined;

  await writeFile(agentsPath, upsertCodexAgentsSection(existingAgents), "utf8");

  return {
    adapter: options.adapter,
    agentsFile: "AGENTS.md",
    backupFiles: [],
    installedAdapters,
    mode: "cli-only",
    projectFile: "project.yaml",
    skillFiles: []
  };
};

export const installClaudeAdapter = async (
  options: AdapterInstallOptions
): Promise<AdapterInstallReport> => {
  const projectYamlPath = join(options.cwd, "project.yaml");

  if (!(await fileExists(projectYamlPath))) {
    throw new CliError("Not a StoryOS project: missing project.yaml. Run storyctl init first.");
  }

  if (!options.cliOnly) {
    throw new CliError("Only --cli-only adapter installation is supported.");
  }

  if (options.adapter !== "claude-code") {
    throw new CliError("Expected claude-code adapter installation options.");
  }

  const config = parseProjectYaml(await readFile(projectYamlPath, "utf8"));
  const installedAdapters = addInstalledAdapter(config.adapters.installed, "claude_code");

  await writeFile(
    projectYamlPath,
    renderProjectYaml({
      ...config,
      adapters: {
        ...config.adapters,
        installed: installedAdapters
      }
    }),
    "utf8"
  );

  const claudePath = join(options.cwd, "CLAUDE.md");
  const existingClaude = (await fileExists(claudePath))
    ? await readFile(claudePath, "utf8")
    : undefined;
  await writeFile(claudePath, upsertClaudeMdSection(existingClaude), "utf8");

  const backupFiles: string[] = [];
  const skillFiles = renderClaudeSkillFiles();

  for (const skillFile of skillFiles) {
    const absolutePath = join(options.cwd, skillFile.relativePath);
    const backupPath = await writeGeneratedFileWithBackup(absolutePath, skillFile.content);

    if (backupPath) {
      backupFiles.push(relative(options.cwd, backupPath).replaceAll("\\", "/"));
    }
  }

  return {
    adapter: options.adapter,
    backupFiles,
    claudeFile: "CLAUDE.md",
    installedAdapters,
    mode: "cli-only",
    projectFile: "project.yaml",
    skillFiles: skillFiles.map((skillFile) => skillFile.relativePath)
  };
};

const formatAdapterInstallReport = (report: AdapterInstallReport): string => {
  const lines = [
    "StoryMaker adapter install",
    `Adapter: ${report.adapter}`,
    `Mode: ${report.mode}`,
    `Project: ${report.projectFile}`
  ];

  if (report.agentsFile) {
    lines.push(`Agents: ${report.agentsFile}`);
  }

  if (report.claudeFile) {
    lines.push(`Claude: ${report.claudeFile}`);
  }

  for (const skillFile of report.skillFiles) {
    lines.push(`Skill: ${skillFile}`);
  }

  if (report.backupFiles.length > 0) {
    lines.push(`Backups: ${report.backupFiles.join(", ")}`);
  }

  lines.push(`Installed adapters: ${report.installedAdapters.join(", ")}`);

  return `${lines.join("\n")}\n`;
};

const parseYamlScalar = (value: string): unknown => {
  const trimmed = value.trim();

  if (trimmed === "[]") {
    return [];
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const content = trimmed.slice(1, -1).trim();
    if (!content) {
      return [];
    }

    return content.split(",").map((entry) => {
      const item = entry.trim();
      return String(parseYamlScalar(item));
    });
  }

  if (trimmed === "true") {
    return true;
  }

  if (trimmed === "false") {
    return false;
  }

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replaceAll('\\"', '"').replaceAll("\\\\", "\\");
  }

  return trimmed;
};

const parseProjectYaml = (text: string): ProjectConfig => {
  const parsed: Record<string, Record<string, unknown>> = {};
  let section = "";
  let nested = "";

  for (const rawLine of text.split(/\r?\n/)) {
    if (!rawLine.trim()) {
      continue;
    }

    const indent = rawLine.match(/^ */)?.[0].length ?? 0;
    const line = rawLine.trim();

    if (indent === 0 && line.endsWith(":")) {
      section = line.slice(0, -1);
      parsed[section] = {};
      nested = "";
      continue;
    }

    if (indent === 2 && section) {
      const [key, ...rest] = line.split(":");
      const value = rest.join(":").trim();

      if (!value) {
        const nestedObject: Record<string, unknown> = {};
        parsed[section][key] = nestedObject;
        nested = key;
      } else {
        parsed[section][key] = parseYamlScalar(value);
        nested = "";
      }
      continue;
    }

    if (indent === 4 && section && nested) {
      const [key, ...rest] = line.split(":");
      const parent = parsed[section][nested];

      if (parent && typeof parent === "object" && !Array.isArray(parent)) {
        (parent as Record<string, unknown>)[key] = parseYamlScalar(rest.join(":").trim());
      }
    }
  }

  const config = parsed as unknown as ProjectConfig;
  validateProjectConfig(config);

  if (!Array.isArray(config.adapters.installed)) {
    throw new CliError("Invalid project config field: adapters.installed.");
  }

  if (typeof config.adapters.mcp.enabled !== "boolean") {
    throw new CliError("Invalid project config field: adapters.mcp.enabled.");
  }

  return config;
};

const checkFileReadWrite = async (path: string): Promise<boolean> => {
  try {
    await access(path, constants.R_OK | constants.W_OK);
    return true;
  } catch {
    return false;
  }
};

const readRuntimeDirectoryReport = async (cwd: string): Promise<RuntimeDirectoryReport> => {
  const storyosExists = await directoryExists(join(cwd, ".storyos"));
  const storymakerExists = await directoryExists(join(cwd, ".storymaker"));

  if (storyosExists && storymakerExists) {
    return {
      level: "ok",
      message: ".storyos active; .storymaker also exists, but no automatic migration is performed",
      storymakerExists,
      storyosExists
    };
  }

  if (storyosExists) {
    return {
      level: "ok",
      message: ".storyos active; no migration required",
      storymakerExists,
      storyosExists
    };
  }

  if (storymakerExists) {
    return {
      level: "warn",
      message:
        ".storymaker detected, but .storyos remains the active compatibility runtime until an explicit migration command exists; no data moved",
      storymakerExists,
      storyosExists
    };
  }

  return {
    level: "error",
    message: ".storyos missing; run storymaker init first",
    storymakerExists,
    storyosExists
  };
};

const collectMarkdownMtimes = async (root: string): Promise<number[]> => {
  if (!(await directoryExists(root))) {
    return [];
  }

  const entries = await readdir(root, {
    withFileTypes: true
  });
  const mtimes: number[] = [];

  for (const entry of entries) {
    const entryPath = join(root, entry.name);

    if (entry.isDirectory()) {
      mtimes.push(...(await collectMarkdownMtimes(entryPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      mtimes.push((await stat(entryPath)).mtimeMs);
    }
  }

  return mtimes;
};

const normalizeInstalledAdapter = (adapter: string): AdapterName | null => {
  if (adapter === "codex") {
    return "codex";
  }

  if (adapter === "claude_code" || adapter === "claude-code") {
    return "claude-code";
  }

  return null;
};

const checkAdapter = async (
  cwd: string,
  adapter: AdapterName,
  checks: DoctorCheck[]
): Promise<void> => {
  if (adapter === "codex") {
    const agentsPath = join(cwd, "AGENTS.md");

    if (!(await fileExists(agentsPath))) {
      checks.push({
        level: "error",
        label: "adapter codex",
        message: "AGENTS.md"
      });
      return;
    }

    const agentsContent = await readFile(agentsPath, "utf8");
    const missingRules = findMissingCodexAgentsRules(agentsContent);

    checks.push({
      level: "ok",
      label: "adapter codex",
      message: "AGENTS.md"
    });

    for (const rule of missingRules) {
      checks.push({
        level: "error",
        label: "adapter codex",
        message: `missing AGENTS.md rule: ${rule.label}`
      });
    }

    if (missingRules.length === 0) {
      checks.push({
        level: "ok",
        label: "adapter codex",
        message: "AGENTS.md required daily flow rules"
      });
    }

    return;
  }

  const claudeMdPath = join(cwd, "CLAUDE.md");
  const claudeMdExists = await fileExists(claudeMdPath);
  const claudeSkillsDir = join(cwd, ".claude", "skills");
  const claudeSkillsExists = await directoryExists(claudeSkillsDir);
  const storyProduceSkillPath = join(cwd, ".claude", "skills", "story-produce", "SKILL.md");
  const storyProduceExists = await fileExists(storyProduceSkillPath);

  checks.push({
    level: claudeMdExists ? "ok" : "error",
    label: "adapter claude-code",
    message: "CLAUDE.md"
  });
  checks.push({
    level: claudeSkillsExists ? "ok" : "error",
    label: "adapter claude-code",
    message: ".claude/skills"
  });

  checks.push({
    level: storyProduceExists ? "ok" : "error",
    label: "adapter claude-code",
    message: ".claude/skills/story-produce/SKILL.md"
  });

  if (!claudeMdExists || !storyProduceExists) {
    return;
  }

  const missingRules = findMissingClaudeDailyFlowRules(
    await readFile(claudeMdPath, "utf8"),
    await readFile(storyProduceSkillPath, "utf8")
  );

  for (const rule of missingRules) {
    checks.push({
      level: "error",
      label: "adapter claude-code",
      message: `missing ${rule.file} rule: ${rule.label}`
    });
  }

  if (missingRules.length === 0) {
    checks.push({
      level: "ok",
      label: "adapter claude-code",
      message: "Claude Code daily flow rules"
    });
  }
};

export const runDoctor = async (options: DoctorOptions): Promise<DoctorCheck[]> => {
  const checks: DoctorCheck[] = [
    {
      level: "ok",
      label: "storyctl",
      message: `running version ${VERSION}`
    }
  ];

  const projectYamlPath = join(options.cwd, "project.yaml");
  let config: ProjectConfig | null = null;

  if (!(await fileExists(projectYamlPath))) {
    checks.push({
      level: "error",
      label: "project.yaml",
      message: "missing; run storyctl init first"
    });
  } else {
    try {
      config = parseProjectYaml(await readFile(projectYamlPath, "utf8"));
      checks.push({
        level: "ok",
        label: "project.yaml",
        message: `${config.project.title} (${config.project.content_type}/${config.project.workflow_profile})`
      });
    } catch (error) {
      checks.push({
        level: "error",
        label: "project.yaml",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const runtimeDirectoryReport = await readRuntimeDirectoryReport(options.cwd);
  checks.push({
    level: runtimeDirectoryReport.level,
    label: "runtime directory",
    message: runtimeDirectoryReport.message
  });

  const storyosDir = join(options.cwd, ".storyos");
  checks.push({
    level: runtimeDirectoryReport.storyosExists ? "ok" : "error",
    label: ".storyos",
    message: runtimeDirectoryReport.storyosExists
      ? "compatibility runtime directory present"
      : "compatibility runtime directory missing"
  });

  const storyDbPath = join(storyosDir, "story.db");
  const hasStoryDb = await fileExists(storyDbPath);
  checks.push({
    level: hasStoryDb && (await checkFileReadWrite(storyDbPath)) ? "ok" : "error",
    label: "story.db",
    message: hasStoryDb
      ? "readable and writable"
      : "missing; run storyctl index rebuild after database migrations are available"
  });

  const workflowStatePath = join(storyosDir, "workflow-state.json");
  const workflowStateReadable = await fileExists(workflowStatePath);
  if (!workflowStateReadable) {
    checks.push({
      level: "error",
      label: "workflow-state",
      message: "missing"
    });
  } else if (!(await checkFileReadWrite(workflowStatePath))) {
    checks.push({
      level: "error",
      label: "workflow-state",
      message: "not readable/writable"
    });
  } else {
    try {
      JSON.parse((await readFile(workflowStatePath, "utf8")).replace(/^\uFEFF/, ""));
      checks.push({
        level: "ok",
        label: "workflow-state",
        message: "readable, writable, and valid JSON"
      });
    } catch {
      checks.push({
        level: "error",
        label: "workflow-state",
        message: "invalid JSON"
      });
    }
  }

  if (hasStoryDb) {
    const storyDbMtime = (await stat(storyDbPath)).mtimeMs;
    const sourceRoots = ["bible", "knowledge", "plans", "outputs", "units"].map((relativePath) =>
      join(options.cwd, relativePath)
    );
    const sourceMtimes = (
      await Promise.all(sourceRoots.map((root) => collectMarkdownMtimes(root)))
    ).flat();
    const hasStaleSource = sourceMtimes.some((mtime) => mtime > storyDbMtime);
    checks.push({
      level: hasStaleSource ? "warn" : "ok",
      label: "index",
      message: hasStaleSource
        ? "source Markdown is newer than story.db; run storyctl index rebuild when available"
        : "no stale Markdown sources detected"
    });
  } else {
    checks.push({
      level: "warn",
      label: "index",
      message: "story.db missing; run storyctl index rebuild when available"
    });
  }

  const adaptersToCheck = options.adapter
    ? [options.adapter]
    : (config?.adapters.installed ?? [])
        .map(normalizeInstalledAdapter)
        .filter((adapter): adapter is AdapterName => adapter !== null);

  if (adaptersToCheck.length === 0) {
    checks.push({
      level: "ok",
      label: "adapters",
      message: "none installed"
    });
  } else {
    for (const adapter of adaptersToCheck) {
      await checkAdapter(options.cwd, adapter, checks);
    }
  }

  return checks;
};

const formatDoctorReport = (checks: readonly DoctorCheck[]): string =>
  `StoryMaker doctor\n${checks
    .map((check) => `[${check.level}] ${check.label}: ${check.message}`)
    .join("\n")}\n`;

const describeIndexStatus = async (cwd: string): Promise<string> => {
  const storyDbPath = join(cwd, ".storyos", "story.db");

  if (!(await fileExists(storyDbPath))) {
    return "story.db missing; run storyctl index rebuild";
  }

  const storyDbMtime = (await stat(storyDbPath)).mtimeMs;
  const sourceRoots = ["bible", "knowledge", "plans", "outputs", "units"].map((relativePath) =>
    join(cwd, relativePath)
  );
  const sourceMtimes = (
    await Promise.all(sourceRoots.map((root) => collectMarkdownMtimes(root)))
  ).flat();

  if (sourceMtimes.some((mtime) => mtime > storyDbMtime)) {
    return "stale; run storyctl index rebuild";
  }

  return "ok";
};

const stringifyOptional = (value: unknown): string | null => {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
};

const WorkflowStatusValues: readonly WorkflowStatus[] = [
  "idle",
  "ready_to_produce",
  "producing",
  "awaiting_user_review",
  "blocked"
];

const ProductionRunStatusValues: readonly ProductionRunStatus[] = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled"
];

const ProductionStepStatusValues: readonly ProductionStepStatus[] = [
  "pending",
  "running",
  "completed",
  "failed",
  "skipped"
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const parseJsonFile = async (path: string, label: string): Promise<unknown> => {
  try {
    return JSON.parse((await readFile(path, "utf8")).replace(/^\uFEFF/, ""));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new CliError(`Invalid ${label}: file is not valid JSON.`);
    }

    throw error;
  }
};

const optionalString = (record: Record<string, unknown>, key: string): string | undefined => {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const optionalBoolean = (record: Record<string, unknown>, key: string): boolean | undefined => {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
};

const isQualityGateSeverityValue = (value: unknown): value is QualityGateSeverity =>
  value === "P0" || value === "P1" || value === "P2" || value === "P3";

const isQualityGateStatusValue = (value: unknown): value is QualityGateStatus =>
  value === "passed" || value === "failed";

const parseStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const parseQualityGateFinding = (value: unknown): QualityGateFinding | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = optionalString(value, "id");
  const message = optionalString(value, "message");
  const severity = value.severity;

  if (id === undefined || message === undefined || !isQualityGateSeverityValue(severity)) {
    return null;
  }

  return {
    id,
    message,
    severity,
    snippet: optionalString(value, "snippet"),
    sourceRef: optionalString(value, "sourceRef"),
    suggestion: optionalString(value, "suggestion")
  };
};

const isApprovalRecommendationValue = (
  value: unknown
): value is DraftQualityApprovalRecommendation =>
  value === "approve" ||
  value === "approve_with_notes" ||
  value === "revise_before_approval" ||
  value === "manual_review_required";

const isSettingImpactValue = (value: unknown): value is DraftQualitySettingImpact =>
  value === "none_detected" ||
  value === "possible_setting_impact" ||
  value === "setting_review_required";

const parseDraftQualityAuthorIssue = (value: unknown): DraftQualityAuthorIssue | null => {
  if (!isRecord(value) || !isQualityGateSeverityValue(value.severity)) {
    return null;
  }

  const gate = optionalString(value, "gate");
  const message = optionalString(value, "message");

  if (gate === undefined || message === undefined) {
    return null;
  }

  return {
    affectsSetting: optionalBoolean(value, "affectsSetting") ?? false,
    gate,
    message,
    severity: value.severity,
    snippet: optionalString(value, "snippet"),
    sourceRef: optionalString(value, "sourceRef"),
    suggestion: optionalString(value, "suggestion")
  };
};

const createFallbackAuthorSummary = (
  quality: Pick<DraftQualitySummary, "blocksBatchContinue" | "highestSeverity" | "totalFindings">
): DraftQualityAuthorSummary => {
  const approvalRecommendation = quality.blocksBatchContinue
    ? "manual_review_required"
    : quality.totalFindings > 0
      ? "revise_before_approval"
      : "approve";

  return {
    approvalRecommendation,
    majorIssues: [],
    overallConclusion:
      quality.totalFindings === 0
        ? "No quality blockers were found."
        : `Quality review found ${quality.totalFindings} issue(s); highest severity is ${
            quality.highestSeverity ?? "none"
          }.`,
    recommendedToApprove: approvalRecommendation === "approve",
    settingImpact: "none_detected",
    summaryText:
      quality.totalFindings === 0
        ? "Quality report is clean; approval is recommended."
        : "Review the quality report before approval."
  };
};

const parseDraftQualityAuthorSummary = (
  value: unknown,
  fallback: Pick<DraftQualitySummary, "blocksBatchContinue" | "highestSeverity" | "totalFindings">
): DraftQualityAuthorSummary => {
  if (!isRecord(value)) {
    return createFallbackAuthorSummary(fallback);
  }

  const approvalRecommendation = isApprovalRecommendationValue(value.approvalRecommendation)
    ? value.approvalRecommendation
    : createFallbackAuthorSummary(fallback).approvalRecommendation;
  const majorIssues = Array.isArray(value.majorIssues)
    ? value.majorIssues
        .map(parseDraftQualityAuthorIssue)
        .filter((item): item is DraftQualityAuthorIssue => item !== null)
    : [];

  return {
    approvalRecommendation,
    majorIssues,
    overallConclusion:
      optionalString(value, "overallConclusion") ??
      createFallbackAuthorSummary(fallback).overallConclusion,
    recommendedToApprove:
      optionalBoolean(value, "recommendedToApprove") ??
      (approvalRecommendation === "approve" || approvalRecommendation === "approve_with_notes"),
    settingImpact: isSettingImpactValue(value.settingImpact)
      ? value.settingImpact
      : "none_detected",
    summaryText:
      optionalString(value, "summaryText") ?? createFallbackAuthorSummary(fallback).summaryText
  };
};

const parseDraftQualityGateSummary = (value: unknown): DraftQualityGateSummary | null => {
  if (!isRecord(value)) {
    return null;
  }

  const gate = optionalString(value, "gate");
  const reportFile = optionalString(value, "reportFile");
  const status = value.status;

  if (gate === undefined || reportFile === undefined || !isQualityGateStatusValue(status)) {
    return null;
  }

  const highestSeverity = isQualityGateSeverityValue(value.highestSeverity)
    ? value.highestSeverity
    : null;
  const findingCount =
    typeof value.findingCount === "number" && Number.isInteger(value.findingCount)
      ? value.findingCount
      : 0;
  const findings = Array.isArray(value.findings)
    ? value.findings
        .map(parseQualityGateFinding)
        .filter((item): item is QualityGateFinding => item !== null)
    : [];

  return {
    findingCount,
    findings,
    gate,
    highestSeverity,
    reportFile,
    status,
    summary: optionalString(value, "summary")
  };
};

const parseAutomaticRevisionPlan = (value: unknown): AutomaticRevisionPlan => {
  if (!isRecord(value)) {
    return {
      action: "record_suggestions",
      reason: "Quality summary did not include an automatic revision plan.",
      suggestions: []
    };
  }

  const action =
    value.action === "auto_revise" ||
    value.action === "pause" ||
    value.action === "record_suggestions"
      ? value.action
      : "record_suggestions";
  const mode =
    value.mode === "light" ||
    value.mode === "rewrite" ||
    value.mode === "add_hook" ||
    value.mode === "reduce_fluff"
      ? value.mode
      : undefined;
  const severity = isQualityGateSeverityValue(value.severity) ? value.severity : undefined;

  return {
    action,
    mode,
    reason:
      typeof value.reason === "string" && value.reason.length > 0
        ? value.reason
        : "No automatic revision reason recorded.",
    severity,
    suggestions: parseStringArray(value.suggestions)
  };
};

const parseDraftQualitySummary = (value: unknown): DraftQualitySummary | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const reportFile = optionalString(value, "reportFile");
  const status = value.status;

  if (reportFile === undefined || !isQualityGateStatusValue(status)) {
    return undefined;
  }

  const gateReports = Array.isArray(value.gateReports)
    ? value.gateReports
        .map(parseDraftQualityGateSummary)
        .filter((item): item is DraftQualityGateSummary => item !== null)
    : [];
  const highestSeverity = isQualityGateSeverityValue(value.highestSeverity)
    ? value.highestSeverity
    : null;
  const totalFindings =
    typeof value.totalFindings === "number" && Number.isInteger(value.totalFindings)
      ? value.totalFindings
      : gateReports.reduce((total, gate) => total + gate.findingCount, 0);

  const fallback = {
    blocksBatchContinue: optionalBoolean(value, "blocksBatchContinue") ?? false,
    highestSeverity,
    totalFindings
  };

  return {
    automaticRevision: parseAutomaticRevisionPlan(value.automaticRevision),
    authorSummary: parseDraftQualityAuthorSummary(value.authorSummary, fallback),
    blocksBatchContinue: fallback.blocksBatchContinue,
    gateReports,
    highestSeverity,
    p2Suggestions: parseStringArray(value.p2Suggestions),
    p3Suggestions: parseStringArray(value.p3Suggestions),
    reportFile,
    status,
    totalFindings
  };
};

const validateWorkflowStateForResume = (value: unknown): WorkflowState => {
  if (!isRecord(value)) {
    throw new CliError("Invalid workflow-state.json: expected an object.");
  }

  if (
    typeof value.status !== "string" ||
    !WorkflowStatusValues.includes(value.status as WorkflowStatus)
  ) {
    throw new CliError("Invalid workflow-state.json: unknown workflow status.");
  }

  return {
    blockedBy: optionalString(value, "blockedBy"),
    currentRunId: optionalString(value, "currentRunId"),
    currentUnit: optionalString(value, "currentUnit"),
    currentUnitId: optionalString(value, "currentUnitId"),
    lastError: optionalString(value, "lastError"),
    stagedOutputFile: optionalString(value, "stagedOutputFile"),
    status: value.status as WorkflowStatus,
    updatedAt: optionalString(value, "updatedAt")
  };
};

const validateProductionStepForResume = (value: unknown): ProductionStep => {
  if (!isRecord(value)) {
    throw new CliError("Invalid ProductionRun: step must be an object.");
  }

  if (typeof value.id !== "string" || value.id.length === 0) {
    throw new CliError("Invalid ProductionRun: step.id is required.");
  }

  if (typeof value.name !== "string" || value.name.length === 0) {
    throw new CliError("Invalid ProductionRun: step.name is required.");
  }

  if (
    typeof value.status !== "string" ||
    !ProductionStepStatusValues.includes(value.status as ProductionStepStatus)
  ) {
    throw new CliError("Invalid ProductionRun: step.status is invalid.");
  }

  return {
    endedAt: optionalString(value, "endedAt"),
    error: optionalString(value, "error"),
    id: value.id,
    name: value.name,
    reportFile: optionalString(value, "reportFile"),
    startedAt: optionalString(value, "startedAt"),
    status: value.status as ProductionStepStatus
  };
};

const validateProductionRunForResume = (value: unknown): ProductionRun => {
  if (!isRecord(value)) {
    throw new CliError("Invalid ProductionRun: expected an object.");
  }

  if (typeof value.id !== "string" || value.id.length === 0) {
    throw new CliError("Invalid ProductionRun: id is required.");
  }

  if (typeof value.startedAt !== "string" || value.startedAt.length === 0) {
    throw new CliError("Invalid ProductionRun: startedAt is required.");
  }

  if (
    typeof value.status !== "string" ||
    !ProductionRunStatusValues.includes(value.status as ProductionRunStatus)
  ) {
    throw new CliError("Invalid ProductionRun: status is invalid.");
  }

  if (!Array.isArray(value.steps)) {
    throw new CliError("Invalid ProductionRun: steps must be an array.");
  }

  return {
    endedAt: optionalString(value, "endedAt"),
    id: value.id,
    pendingKnowledgeUpdateFile: optionalString(value, "pendingKnowledgeUpdateFile"),
    quality: parseDraftQualitySummary(value.quality),
    reportFile: optionalString(value, "reportFile"),
    startedAt: value.startedAt,
    status: value.status as ProductionRunStatus,
    steps: value.steps.map(validateProductionStepForResume),
    stagedOutputFile: optionalString(value, "stagedOutputFile"),
    unitId: optionalString(value, "unitId")
  };
};

const readWorkflowStateForResume = async (cwd: string): Promise<WorkflowState> => {
  const workflowStatePath = join(cwd, ".storyos", "workflow-state.json");

  if (!(await fileExists(workflowStatePath))) {
    return {
      status: "idle",
      updatedAt: new Date().toISOString()
    };
  }

  return validateWorkflowStateForResume(
    await parseJsonFile(workflowStatePath, "workflow-state.json")
  );
};

const getProductionRunTimestamp = (run: ProductionRun): number => {
  const timestamp = Date.parse(run.startedAt);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const readLatestProductionRunForResume = async (
  cwd: string
): Promise<ProductionRun | undefined> => {
  const runsDir = join(cwd, ".storyos", "runs");

  if (!(await directoryExists(runsDir))) {
    return undefined;
  }

  const fileNames = (await readdir(runsDir))
    .filter((fileName) => fileName.endsWith(".json"))
    .sort();
  const runs: ProductionRun[] = [];

  for (const fileName of fileNames) {
    runs.push(
      validateProductionRunForResume(
        await parseJsonFile(join(runsDir, fileName), `ProductionRun ${fileName}`)
      )
    );
  }

  return runs
    .sort((left, right) => {
      const byTimestamp = getProductionRunTimestamp(right) - getProductionRunTimestamp(left);
      return byTimestamp === 0 ? right.id.localeCompare(left.id) : byTimestamp;
    })
    .at(0);
};

const getCurrentWorkUnit = (workflowState: WorkflowState): string =>
  stringifyOptional(workflowState.currentUnitId) ??
  stringifyOptional(workflowState.currentUnit) ??
  "none";

const formatProductionStep = (step: ProductionStep): string => `${step.id} (${step.name})`;

const findFailedProductionStep = (run: ProductionRun | undefined): ProductionStep | null =>
  run?.steps.find((step) => step.status === "failed") ?? null;

const describePendingReview = (workflowState: WorkflowState, currentWorkUnit: string): string => {
  if (workflowState.status !== "awaiting_user_review") {
    return "none";
  }

  return [currentWorkUnit, workflowState.stagedOutputFile]
    .filter((value) => value !== undefined && value !== "none")
    .join(" ");
};

const formatQualityBlockedNextAction = (
  quality: DraftQualitySummary,
  fallbackReportFile: string | null
): string =>
  `Quality gates found ${
    quality.highestSeverity ?? "P0/P1"
  } issue(s); batch continue is blocked. Review ${
    quality.reportFile || fallbackReportFile || "the quality report"
  }, then approve, reject, or request revision manually.`;

const buildPendingReviewNextAction = (latestRun: ProductionRun | null): string => {
  const quality = latestRun?.quality;

  if (quality?.blocksBatchContinue === true) {
    return formatQualityBlockedNextAction(quality, latestRun?.reportFile ?? null);
  }

  return "Review the staged output. A draft is already waiting for review; approve, reject, or ask for revision.";
};

const buildResumeNextAction = (
  workflowState: WorkflowState,
  report: Omit<ResumeReport, "nextAction">
): string => {
  if (report.indexStatus.startsWith("story.db missing")) {
    return "Run storyctl index rebuild before resuming.";
  }

  if (workflowState.status === "awaiting_user_review") {
    return buildPendingReviewNextAction(report.latestRun);
  }

  if (workflowState.status === "producing") {
    if (report.failedStep !== null) {
      return `Production stopped at ${formatProductionStep(
        report.failedStep
      )}; inspect the error, then rerun or continue production when storyctl produce is available.`;
    }

    if (report.latestRun !== null) {
      return `Latest run is ${report.latestRun.status}; inspect .storyos/runs/${report.latestRun.id}.json, then rerun or continue production when storyctl produce is available.`;
    }

    return "Workflow is producing, but no production run was found; rerun production when storyctl produce is available.";
  }

  if (workflowState.status === "ready_to_produce") {
    return "Next production step: run storymaker produce packet --unit next --json, write the draft, then run storymaker draft submit. Use storymaker produce next --placeholder only for deterministic development fallback.";
  }

  if (workflowState.status === "blocked") {
    return `Resolve blocker: ${workflowState.blockedBy ?? workflowState.lastError ?? "unknown"}.`;
  }

  return "No active workflow. Select or plan the next work unit before producing.";
};

export const readResume = async (cwd: string): Promise<ResumeReport> => {
  const projectYamlPath = join(cwd, "project.yaml");

  if (!(await fileExists(projectYamlPath))) {
    throw new CliError("Not a StoryOS project: missing project.yaml. Run storyctl init first.");
  }

  const workflowState = await readWorkflowStateForResume(cwd);
  const latestRun = await readLatestProductionRunForResume(cwd);
  const currentWorkUnit = getCurrentWorkUnit(workflowState);
  const currentUnitId = workflowState.currentUnitId ?? null;
  const stagedOutputFile = workflowState.stagedOutputFile ?? "none";
  const reportWithoutAction: Omit<ResumeReport, "nextAction"> = {
    currentUnitId,
    currentWorkUnit,
    failedStep: findFailedProductionStep(latestRun),
    indexStatus: await describeIndexStatus(cwd),
    latestRun: latestRun ?? null,
    pendingReview: describePendingReview(workflowState, currentWorkUnit),
    stagedOutputFile,
    workflowStatus: workflowState.status
  };

  return {
    ...reportWithoutAction,
    nextAction: buildResumeNextAction(workflowState, reportWithoutAction)
  };
};

export const readStatus = async (cwd: string): Promise<StatusReport> => {
  const projectYamlPath = join(cwd, "project.yaml");

  if (!(await fileExists(projectYamlPath))) {
    throw new CliError("Not a StoryOS project: missing project.yaml. Run storyctl init first.");
  }

  const config = parseProjectYaml(await readFile(projectYamlPath, "utf8"));
  const workflowStatePath = join(cwd, ".storyos", "workflow-state.json");
  let workflowState: Record<string, unknown> = {};

  if (await fileExists(workflowStatePath)) {
    try {
      workflowState = JSON.parse(
        (await readFile(workflowStatePath, "utf8")).replace(/^\uFEFF/, "")
      ) as Record<string, unknown>;
    } catch {
      workflowState = {
        status: "invalid"
      };
    }
  } else {
    workflowState = {
      status: "missing"
    };
  }

  const workflowStatus = stringifyOptional(workflowState.status) ?? "unknown";
  const currentUnitId = stringifyOptional(workflowState.currentUnitId);
  const currentWorkUnit = currentUnitId ?? stringifyOptional(workflowState.currentUnit) ?? "none";
  const stagedOutputFile = stringifyOptional(workflowState.stagedOutputFile);
  const pendingReview =
    workflowStatus === "awaiting_user_review"
      ? [currentWorkUnit, stagedOutputFile].filter((value) => value !== null).join(" ")
      : "none";

  return {
    adapters: config.adapters.installed,
    contentType: config.project.content_type,
    currentUnitId,
    currentWorkUnit,
    indexStatus: await describeIndexStatus(cwd),
    pendingReview,
    projectTitle: config.project.title,
    stagedOutputFile,
    workflowProfile: config.project.workflow_profile,
    workflowStatus
  };
};

const formatStatusReport = (report: StatusReport): string => `StoryMaker status
Project: ${report.projectTitle}
content_type: ${report.contentType}
workflow_profile: ${report.workflowProfile}
Current WorkUnit: ${report.currentWorkUnit}
WorkflowState: ${report.workflowStatus}
Installed adapters: ${report.adapters.length > 0 ? report.adapters.join(", ") : "none"}
Index status: ${report.indexStatus}
Pending review: ${report.pendingReview}
`;

const loadDashboardModule = async (): Promise<DashboardModule> => {
  let module: Partial<DashboardModule>;

  try {
    module = (await import(DASHBOARD_MODULE_PATH)) as Partial<DashboardModule>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(
      `Dashboard module is unavailable. From the StoryMaker source repository, run ${DASHBOARD_BUILD_COMMAND}, then retry storymaker dashboard. Original error: ${message}`
    );
  }

  if (typeof module.startDashboardServer !== "function") {
    throw new CliError(
      `Dashboard module is unavailable. From the StoryMaker source repository, run ${DASHBOARD_BUILD_COMMAND}, then retry storymaker dashboard.`
    );
  }

  return module as DashboardModule;
};

const formatDashboardReport = (
  options: DashboardCommandOptions,
  server: DashboardServerHandle
): string => `StoryMaker dashboard
URL: ${server.url}
Project: ${options.cwd}
Host: ${server.host}
Port: ${server.port}
Mode: ${options.once ? "one-shot" : "serving"}
`;

const formatResumeReport = (report: ResumeReport): string => {
  const lines = [
    "StoryMaker resume",
    `WorkflowState: ${report.workflowStatus}`,
    `Current WorkUnit: ${report.currentWorkUnit}`,
    `Staged output: ${report.stagedOutputFile}`,
    `Index status: ${report.indexStatus}`,
    `Pending review: ${report.pendingReview}`
  ];

  if (report.latestRun === null) {
    lines.push("Latest run: none");
  } else {
    lines.push(
      `Latest run: ${report.latestRun.id} (${report.latestRun.status})`,
      `Latest run report: ${report.latestRun.reportFile ?? "none"}`
    );
  }

  if (report.failedStep === null) {
    lines.push("Failed step: none");
  } else {
    lines.push(
      `Failed step: ${formatProductionStep(report.failedStep)}`,
      `Failed step error: ${report.failedStep.error ?? "none"}`,
      `Failed step report: ${report.failedStep.reportFile ?? "none"}`
    );
  }

  lines.push(`Next action: ${report.nextAction}`);

  return `${lines.join("\n")}\n`;
};

const formatIndexReport = (report: IndexStoryProjectResult): string => `StoryMaker index
Mode: ${report.mode}
Included statuses: ${report.includedStatuses.join(", ")}
Scanned Markdown files: ${report.scannedFiles}
Indexed files: ${report.indexedFiles}
Removed stale records: ${report.removedFiles}
Database: ${report.databasePath}
`;

const formatSearchReport = (report: SearchStoryIndexResult): string => {
  const lines = [`StoryMaker search`, `Query: ${report.query}`, `Search mode: ${report.mode}`];

  if (report.fallbackReason !== undefined) {
    lines.push(`Search fallback: ${report.fallbackReason}`);
  }

  if (report.results.length === 0) {
    lines.push("No results.");
    return `${lines.join("\n")}\n`;
  }

  report.results.forEach((result, index) => {
    lines.push(
      `${index + 1}. ${result.title}`,
      `Path: ${result.sourcePath}`,
      `Summary: ${result.summary}`,
      `Reason: ${result.reason}`
    );
  });

  return `${lines.join("\n")}\n`;
};

const contextSourceRootNames = ["bible", "knowledge", "plans", "outputs", "units"];

const collectMarkdownPaths = async (root: string): Promise<string[]> => {
  if (!(await directoryExists(root))) {
    return [];
  }

  const entries = await readdir(root, {
    withFileTypes: true
  });
  const paths: string[] = [];

  for (const entry of entries) {
    const entryPath = join(root, entry.name);

    if (entry.isDirectory()) {
      paths.push(...(await collectMarkdownPaths(entryPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      paths.push(entryPath);
    }
  }

  return paths;
};

const normalizeContextPath = (cwd: string, path: string): string =>
  relative(cwd, path).split("\\").join("/");

const extractMarkdownTitle = (sourcePath: string, body: string): string => {
  const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading && heading.length > 0 ? heading : sourcePath;
};

const stripMarkdownFrontMatter = (body: string): string => {
  const match = body.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return match ? body.slice(match[0].length) : body;
};

const summarizeMarkdownBody = (body: string): string => {
  const summary =
    body
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0 && !line.startsWith("---") && !line.startsWith("#")) ?? "";

  return summary.length > 120 ? `${summary.slice(0, 117)}...` : summary;
};

const normalizeContextText = (value: string): string => value.toLocaleLowerCase("zh-CN");

const getUnitSearchTerms = (unit: string): string[] => {
  const terms = new Set([unit, `unit-${unit}`, `unit ${unit}`, `chapter ${unit}`]);
  const numericUnit = Number(unit);

  if (Number.isInteger(numericUnit) && numericUnit >= 0) {
    const padded = String(numericUnit).padStart(4, "0");
    terms.add(padded);
    terms.add(`第 ${padded} 章`);
    terms.add(`第${padded}章`);
  }

  return [...terms].map(normalizeContextText);
};

const isBaselineContextPath = (sourcePath: string): boolean =>
  sourcePath.startsWith("bible/") ||
  sourcePath === "plans/master-plan.md" ||
  sourcePath === "plans/rolling-plan.md" ||
  sourcePath.endsWith("style.md") ||
  sourcePath.includes("style-guide") ||
  sourcePath.includes("timeline") ||
  sourcePath.includes("foreshadowing");

const collectMarkdownContextSources = async (
  cwd: string,
  unit: string
): Promise<ContextSource[]> => {
  const markdownPaths = (
    await Promise.all(
      contextSourceRootNames.map((rootName) => collectMarkdownPaths(join(cwd, rootName)))
    )
  )
    .flat()
    .sort();
  const terms = getUnitSearchTerms(unit);
  const sources: ContextSource[] = [];

  for (const path of markdownPaths) {
    const sourcePath = normalizeContextPath(cwd, path);
    const body = await readFile(path, "utf8");
    const markdownBody = stripMarkdownFrontMatter(body);
    const haystack = normalizeContextText(`${sourcePath}\n${markdownBody}`);

    if (isBaselineContextPath(sourcePath) || terms.some((term) => haystack.includes(term))) {
      sources.push({
        origins: ["markdown"],
        sourcePath,
        summary: summarizeMarkdownBody(markdownBody) || "No summary available.",
        title: extractMarkdownTitle(sourcePath, markdownBody)
      });
    }
  }

  return sources;
};

const mergeContextSource = (sources: Map<string, ContextSource>, source: ContextSource): void => {
  const existing = sources.get(source.sourcePath);

  if (existing === undefined) {
    sources.set(source.sourcePath, source);
    return;
  }

  existing.origins = [...new Set([...existing.origins, ...source.origins])].sort();
  if (existing.summary === "No summary available." && source.summary) {
    existing.summary = source.summary;
  }
};

const contextSourceFromSearchHit = (hit: SearchStoryIndexHit): ContextSource => ({
  origins: ["index"],
  sourcePath: hit.sourcePath,
  summary: hit.summary || "No summary available.",
  title: hit.title
});

const contextSourceFromStructuredHit = (source: StructuredStoryContextSource): ContextSource => ({
  origins: ["structured-index"],
  sourcePath: source.sourcePath,
  summary: source.summary || "No summary available.",
  title: source.title
});

const collectIndexedContextSources = async (
  cwd: string,
  unit: string,
  indexStatus: string
): Promise<ContextSource[]> => {
  if (indexStatus.startsWith("story.db missing")) {
    return [];
  }

  const sources = new Map<string, ContextSource>();

  for (const query of getUnitSearchTerms(unit).slice(0, 4)) {
    const searchResult = await searchStoryIndex({
      cwd,
      limit: 5,
      query
    });

    for (const hit of searchResult.results) {
      mergeContextSource(sources, contextSourceFromSearchHit(hit));
    }
  }

  return [...sources.values()];
};

const collectStructuredContextSources = async (
  cwd: string,
  indexStatus: string
): Promise<ContextSource[]> => {
  if (indexStatus.startsWith("story.db missing")) {
    return [];
  }

  return (await readStructuredStoryContext({ cwd })).map(contextSourceFromStructuredHit);
};

const buildContextGaps = (sources: readonly ContextSource[], indexStatus: string): string[] => {
  const sourcePaths = sources.map((source) => source.sourcePath);
  const gaps: string[] = [];

  if (indexStatus.startsWith("story.db missing")) {
    gaps.push("SQLite index unavailable; run storyctl index rebuild.");
  }

  if (!sourcePaths.some((sourcePath) => sourcePath.startsWith("units/"))) {
    gaps.push("Current unit plan not found.");
  }

  if (!sourcePaths.some((sourcePath) => sourcePath.startsWith("knowledge/characters"))) {
    gaps.push("Character state not found.");
  }

  if (!sourcePaths.some((sourcePath) => sourcePath.includes("timeline"))) {
    gaps.push("Timeline context not found.");
  }

  if (!sourcePaths.some((sourcePath) => sourcePath.includes("foreshadowing"))) {
    gaps.push("Foreshadowing context not found.");
  }

  if (
    !sourcePaths.some((sourcePath) => sourcePath.includes("style") || sourcePath.includes("风格"))
  ) {
    gaps.push("Style guide not found.");
  }

  return gaps;
};

const buildPromptReadyContext = (report: Omit<ContextReport, "promptReadyContext">): string => {
  const lines = [
    `Unit: ${report.unit}`,
    `Index status: ${report.indexStatus}`,
    "Use these sources:"
  ];

  if (report.sources.length === 0) {
    lines.push("- none");
  } else {
    for (const source of report.sources) {
      lines.push(`- ${source.sourcePath}: ${source.summary}`);
    }
  }

  lines.push("Known gaps:");
  for (const gap of report.gaps) {
    lines.push(`- ${gap}`);
  }

  return lines.join("\n");
};

export const readContext = async (options: ContextOptions): Promise<ContextReport> => {
  const projectYamlPath = join(options.cwd, "project.yaml");

  if (!(await fileExists(projectYamlPath))) {
    throw new CliError("Not a StoryOS project: missing project.yaml. Run storyctl init first.");
  }

  const indexStatus = await describeIndexStatus(options.cwd);
  const sources = new Map<string, ContextSource>();

  for (const source of await collectMarkdownContextSources(options.cwd, options.unit)) {
    mergeContextSource(sources, source);
  }

  for (const source of await collectIndexedContextSources(options.cwd, options.unit, indexStatus)) {
    mergeContextSource(sources, source);
  }

  for (const source of await collectStructuredContextSources(options.cwd, indexStatus)) {
    mergeContextSource(sources, source);
  }

  const reportWithoutPrompt = {
    gaps: buildContextGaps([...sources.values()], indexStatus),
    indexStatus,
    sources: [...sources.values()].sort((left, right) =>
      left.sourcePath.localeCompare(right.sourcePath)
    ),
    unit: options.unit
  };

  return {
    ...reportWithoutPrompt,
    promptReadyContext: buildPromptReadyContext(reportWithoutPrompt)
  };
};

const formatContextReport = (report: ContextReport): string => {
  const lines = [
    "StoryMaker context",
    `Unit: ${report.unit}`,
    `Index status: ${report.indexStatus}`,
    "Sources:"
  ];

  if (report.sources.length === 0) {
    lines.push("- none");
  } else {
    report.sources.forEach((source, index) => {
      lines.push(
        `${index + 1}. ${source.title}`,
        `Path: ${source.sourcePath}`,
        `Origin: ${source.origins.join(", ")}`,
        `Summary: ${source.summary}`
      );
    });
  }

  lines.push("Gaps:");
  if (report.gaps.length === 0) {
    lines.push("- none");
  } else {
    for (const gap of report.gaps) {
      lines.push(`- ${gap}`);
    }
  }

  lines.push("Prompt-ready context:", report.promptReadyContext);

  return `${lines.join("\n")}\n`;
};

const WORK_UNITS_RELATIVE_DIR = join(".storyos", "work-units");

const produceStepDefinitions = [
  ["load-project-config", "Load project configuration"],
  ["allocate-work-unit", "Allocate next WorkUnit"],
  ["gather-context", "Gather prompt-ready context"],
  ["build-generation-prompt", "Build generation prompt skeleton"],
  ["draft-placeholder", "Create placeholder draft"],
  ["run-continuity-gate", "Run continuity gate placeholder"],
  ["run-commercial-gate", "Run commercial gate placeholder"],
  ["run-reader-gate", "Run reader gate placeholder"],
  ["prepare-revision-placeholder", "Prepare revision placeholder"],
  ["write-staged-output", "Write staged output"],
  ["write-production-report", "Write production report"],
  ["update-workflow-state", "Update workflow state"]
] as const;

const normalizeRelativeOutputPath = (path: string): string => path.split("\\").join("/");

const createSafeRunIdPart = (value: string): string =>
  value
    .replace(/[:/\\\s]/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const getWorkUnitFilePath = (cwd: string, unitId: string): string =>
  join(cwd, WORK_UNITS_RELATIVE_DIR, `${createSafeRunIdPart(unitId)}.json`);

const readPersistedWorkUnits = async (cwd: string): Promise<WorkUnit[]> => {
  const workUnitsDir = join(cwd, WORK_UNITS_RELATIVE_DIR);

  if (!(await directoryExists(workUnitsDir))) {
    return [];
  }

  const fileNames = (await readdir(workUnitsDir))
    .filter((fileName) => fileName.endsWith(".json"))
    .sort();
  const workUnits: WorkUnit[] = [];

  for (const fileName of fileNames) {
    workUnits.push(
      validateWorkUnit(await parseJsonFile(join(workUnitsDir, fileName), `WorkUnit ${fileName}`))
    );
  }

  return workUnits;
};

const writeJsonFile = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(dirname(filePath), {
    recursive: true
  });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const writeWorkUnit = async (cwd: string, workUnit: WorkUnit): Promise<void> => {
  await writeJsonFile(getWorkUnitFilePath(cwd, workUnit.id), workUnit);
};

const getProductionRunFilePathForProduce = (cwd: string, runId: string): string =>
  join(cwd, ".storyos", "runs", `${runId}.json`);

const writeProductionRunForProduce = async (cwd: string, run: ProductionRun): Promise<void> => {
  await writeJsonFile(getProductionRunFilePathForProduce(cwd, run.id), run);
};

const createPendingProductionSteps = (): ProductionStep[] =>
  produceStepDefinitions.map(([id, name]) => ({
    id,
    name,
    status: "pending"
  }));

export const formatProduceProgressLine = (event: ProduceProgressEvent): string => {
  const statusLabel = event.status === "failed" ? "failed" : event.status;
  const errorSuffix = event.status === "failed" && event.error ? ` - ${event.error}` : "";

  return `[${event.index}/${event.total}] ${statusLabel}: ${event.stepName} (${event.stepId})${errorSuffix}`;
};

const FINAL_ACCEPTANCE_QUESTION = "Approve this chapter?";

const createFinalAcceptanceSummary = (options: {
  draftPath: string | null;
  qualityReportPath: string | null;
  unitId: string | null;
}): FinalAcceptanceSummary => ({
  draftPath: options.draftPath,
  qualityReportPath: options.qualityReportPath,
  question: FINAL_ACCEPTANCE_QUESTION,
  unitId: options.unitId
});

export const formatFinalAcceptanceSummary = (summary: FinalAcceptanceSummary): string =>
  [
    "Final acceptance",
    `WorkUnit: ${summary.unitId ?? "none"}`,
    `Draft path: ${summary.draftPath ?? "none"}`,
    `Quality report path: ${summary.qualityReportPath ?? "none"}`,
    `Question: ${summary.question}`
  ].join("\n");

const emitProduceProgress = (
  run: ProductionRun,
  step: ProductionStep,
  onProgress: ProduceNextOptions["onProgress"]
): void => {
  if (onProgress === undefined) {
    return;
  }

  const index = run.steps.findIndex((candidate) => candidate.id === step.id) + 1;

  onProgress({
    error: step.error,
    index,
    status: step.status,
    stepId: step.id,
    stepName: step.name,
    total: run.steps.length
  });
};

const completeProduceStep = async (
  cwd: string,
  run: ProductionRun,
  stepId: string,
  now: string,
  details: {
    onProgress?: ProduceNextOptions["onProgress"];
    reportFile?: string;
  } = {}
): Promise<void> => {
  const step = run.steps.find((candidate) => candidate.id === stepId);

  if (step === undefined) {
    throw new CliError(`Unknown production step: ${stepId}.`);
  }

  step.startedAt = step.startedAt ?? now;
  step.endedAt = now;
  step.status = "completed";
  step.reportFile = details.reportFile ?? step.reportFile;
  await writeProductionRunForProduce(cwd, run);
  emitProduceProgress(run, step, details.onProgress);
};

const createUniqueRunId = async (cwd: string, now: string, workUnit: WorkUnit): Promise<string> => {
  const baseRunId = `run-${createSafeRunIdPart(now)}-${createSafeRunIdPart(workUnit.id)}`;
  let candidate = baseRunId;
  let index = 2;

  while (await fileExists(getProductionRunFilePathForProduce(cwd, candidate))) {
    candidate = `${baseRunId}-${index}`;
    index += 1;
  }

  return candidate;
};

const sanitizeOutputExtension = (outputFormat: string): string => {
  const extension = outputFormat.replace(/^\./, "").replace(/[^A-Za-z0-9]/g, "");

  return extension || "md";
};

export const createChapterMarkdownOutputPlan = (
  options: ChapterMarkdownOutputPlanOptions
): ChapterMarkdownOutputPlan => {
  const markdownTitle = sanitizeFilenameTitle(options.title);
  const extension = sanitizeOutputExtension(options.outputFormat);

  return {
    markdownTitle,
    relativePath: normalizeRelativeOutputPath(
      join(options.outputDir, `${markdownTitle}.${extension}`)
    )
  };
};

const resolveWorkPacketWorkUnit = async (
  cwd: string,
  config: ProjectConfig,
  unitSelector: string
): Promise<WorkUnit> => {
  const existingUnits = await readPersistedWorkUnits(cwd);

  if (unitSelector === "next") {
    return createNextWorkUnit({
      existingUnits,
      numberPadding: config.writing.chapter_number_padding,
      status: "planned",
      title: "Placeholder Chapter",
      type: config.project.unit_name
    });
  }

  const numericUnit = Number(unitSelector);
  const workUnit = existingUnits.find((candidate) => {
    if (candidate.id === unitSelector || candidate.displayTitle === unitSelector) {
      return true;
    }

    return Number.isInteger(numericUnit) && candidate.index + 1 === numericUnit;
  });

  if (workUnit === undefined) {
    throw new CliError(`WorkUnit not found for --unit ${unitSelector}.`);
  }

  return workUnit;
};

const getWorkPacketContextUnit = (unitSelector: string, workUnit: WorkUnit): string =>
  unitSelector === "next" ? String(workUnit.index + 1) : unitSelector;

const buildWorkPacketConstraints = (config: ProjectConfig): string[] => [
  `Write in ${config.project.language}.`,
  `Target platform: ${config.project.target_platform}.`,
  `Target words: ${config.writing.words_per_unit_min}-${config.writing.words_per_unit_max}.`,
  `Output format: ${config.writing.output_format}.`,
  `Review frequency: ${config.writing.review_frequency}.`,
  "Keep assumptions separate from canon until user approval.",
  "Stop after one unit reaches awaiting user review."
];

const buildWorkPacketQualityGates = (config: ProjectConfig): string[] => {
  const gates = [
    "Continuity gate: check canon, timeline, character state, and foreshadowing.",
    "Reader gate: check hook, escalation, payoff, and clarity.",
    "AI taste gate: remove generic phrasing, filler, and template-feel prose.",
    "Knowledge gate: prepare pending knowledge updates without committing canon."
  ];

  if (config.project.workflow_profile === "production") {
    gates.push("Production gate: report blockers and do not auto-approve.");
  }

  return gates;
};

const describeContentFormat = (contentType: ContentType): string => {
  if (contentType === "screenplay" || contentType === "short_drama") {
    return "script scenes with action, dialogue, and transitions";
  }

  if (contentType === "comic_script") {
    return "comic script with page, panel, action, dialogue, and caption beats";
  }

  if (contentType === "interactive_story" || contentType === "game_narrative") {
    return "interactive narrative unit with choices, state changes, and branch notes";
  }

  return "reader-facing prose chapter in Markdown";
};

export const buildProduceWorkPacket = async (
  options: ProducePacketOptions
): Promise<WorkPacket> => {
  const projectYamlPath = join(options.cwd, "project.yaml");

  if (!(await fileExists(projectYamlPath))) {
    throw new CliError("Not a StoryOS project: missing project.yaml. Run storyctl init first.");
  }

  const config = parseProjectYaml(await readFile(projectYamlPath, "utf8"));
  const workUnit = await resolveWorkPacketWorkUnit(options.cwd, config, options.unit);
  const contextUnit = getWorkPacketContextUnit(options.unit, workUnit);
  const contextReport = await readContext({
    cwd: options.cwd,
    unit: contextUnit
  });
  const chapterOutput = createChapterMarkdownOutputPlan({
    outputDir: config.writing.output_dir,
    outputFormat: config.writing.output_format,
    title: workUnit.filenameTitle ?? workUnit.displayTitle
  });
  const packetId = `packet-${createSafeRunIdPart(options.now)}-${createSafeRunIdPart(workUnit.id)}`;
  const outputTarget: WorkPacketOutputTarget = {
    draftPath: chapterOutput.relativePath,
    format: config.writing.output_format,
    knowledgeUpdatePath: normalizeRelativeOutputPath(
      join(".storyos", "pending-knowledge-updates", `pending-${packetId}.json`)
    ),
    qualityReportPath: normalizeRelativeOutputPath(join("reviews", `${packetId}.md`))
  };
  const constraints = buildWorkPacketConstraints(config);
  const promptSources: StoryPromptContextSource[] = contextReport.sources.map((source) => ({
    path: source.sourcePath,
    summary: source.summary,
    title: source.title
  }));
  const prompt = renderStoryPrompt({
    context: {
      constraints,
      gaps: contextReport.gaps,
      notes: [
        "Use this packet as the complete writing brief for the current unit.",
        "Do not request the full project documents unless a listed gap blocks drafting."
      ],
      sources: promptSources
    },
    outputTarget: {
      draftPath: outputTarget.draftPath,
      knowledgeUpdatePath: outputTarget.knowledgeUpdatePath,
      qualityReportPath: outputTarget.qualityReportPath
    },
    project: {
      contentType: config.project.content_type as PromptContentType,
      language: config.project.language,
      targetPlatform: config.project.target_platform,
      title: config.project.title,
      unitName: config.project.unit_name,
      workflowProfile: config.project.workflow_profile as PromptWorkflowProfile
    },
    templateId: "story-draft",
    workUnit: {
      displayTitle: workUnit.displayTitle,
      id: workUnit.id,
      index: workUnit.index,
      outputPath: outputTarget.draftPath,
      targetWords: config.writing.words_per_unit_max,
      type: workUnit.type
    }
  });

  return {
    constraints,
    contentFormat: describeContentFormat(config.project.content_type),
    context: {
      gaps: contextReport.gaps,
      indexStatus: contextReport.indexStatus,
      promptReadyContext: contextReport.promptReadyContext,
      sources: contextReport.sources,
      unit: contextUnit
    },
    generatedAt: options.now,
    generation: {
      prompt,
      templateId: "story-draft"
    },
    id: packetId,
    outputTarget,
    project: {
      contentType: config.project.content_type,
      language: config.project.language,
      targetPlatform: config.project.target_platform,
      title: config.project.title,
      unitName: config.project.unit_name,
      workflowProfile: config.project.workflow_profile
    },
    qualityGates: buildWorkPacketQualityGates(config),
    unitSelector: options.unit,
    workUnit
  };
};

const formatProduceWorkPacket = (packet: WorkPacket): string => {
  const lines = [
    "StoryMaker produce packet",
    `Packet: ${packet.id}`,
    `Generated at: ${packet.generatedAt}`,
    `WorkUnit: ${packet.workUnit.id}`,
    `Display title: ${packet.workUnit.displayTitle}`,
    `Unit selector: ${packet.unitSelector}`,
    `Context unit: ${packet.context.unit}`,
    `Content format: ${packet.contentFormat}`,
    "Output target:",
    `- Draft: ${packet.outputTarget.draftPath}`,
    `- Quality report: ${packet.outputTarget.qualityReportPath}`,
    `- Knowledge update: ${packet.outputTarget.knowledgeUpdatePath}`,
    "Sources:"
  ];

  if (packet.context.sources.length === 0) {
    lines.push("- none");
  } else {
    packet.context.sources.forEach((source, index) => {
      lines.push(
        `${index + 1}. ${source.title}`,
        `Path: ${source.sourcePath}`,
        `Summary: ${source.summary}`
      );
    });
  }

  lines.push("Gaps:");
  if (packet.context.gaps.length === 0) {
    lines.push("- none");
  } else {
    for (const gap of packet.context.gaps) {
      lines.push(`- ${gap}`);
    }
  }

  lines.push(
    "Quality gates:",
    ...packet.qualityGates.map((gate) => `- ${gate}`),
    "Generation prompt:",
    packet.generation.prompt,
    "Next: give this packet to an AI writer, then submit the draft when draft submit is available."
  );

  return `${lines.join("\n")}\n`;
};

const resolveDraftSubmitWorkUnit = async (
  cwd: string,
  config: ProjectConfig,
  unitSelector: string,
  title: string
): Promise<{
  existingUnits: WorkUnit[];
  workUnit: WorkUnit;
}> => {
  const existingUnits = await readPersistedWorkUnits(cwd);
  const numericUnit = Number(unitSelector);
  const existingWorkUnit = existingUnits.find((candidate) => {
    if (candidate.id === unitSelector || candidate.displayTitle === unitSelector) {
      return true;
    }

    return Number.isInteger(numericUnit) && candidate.index + 1 === numericUnit;
  });

  if (existingWorkUnit !== undefined) {
    return {
      existingUnits,
      workUnit: existingWorkUnit
    };
  }

  const nextWorkUnit = createNextWorkUnit({
    existingUnits,
    numberPadding: config.writing.chapter_number_padding,
    status: "planned",
    title,
    type: config.project.unit_name
  });

  const selectorMatchesNext =
    unitSelector === "next" ||
    unitSelector === nextWorkUnit.id ||
    unitSelector === nextWorkUnit.displayTitle ||
    (Number.isInteger(numericUnit) && nextWorkUnit.index + 1 === numericUnit);

  if (!selectorMatchesNext) {
    throw new CliError(`WorkUnit not found for --unit ${unitSelector}.`);
  }

  return {
    existingUnits,
    workUnit: nextWorkUnit
  };
};

const buildSubmittedWorkUnit = (details: {
  config: ProjectConfig;
  existingUnits: readonly WorkUnit[];
  stagedOutputFile: string;
  title: string;
  workUnit: WorkUnit;
}): WorkUnit => {
  const existingUnits = details.existingUnits.filter((unit) => unit.id !== details.workUnit.id);
  const titledWorkUnit = createWorkUnit({
    existingUnits,
    id: details.workUnit.id,
    index: details.workUnit.index,
    numberPadding: details.config.writing.chapter_number_padding,
    status: "awaiting_user_review",
    title: details.title,
    type: details.workUnit.type
  });

  return validateWorkUnit({
    ...details.workUnit,
    ...titledWorkUnit,
    stagedOutputFile: details.stagedOutputFile,
    status: "awaiting_user_review"
  });
};

const stripLeadingMarkdownHeading = (body: string): string =>
  body.replace(/^#\s+.+(?:\r?\n|$)/, "").trimStart();

const factDraftBlockPattern =
  /```(?:storymaker-facts|storymaker-fact-drafts)\s*\r?\n([\s\S]*?)```/gi;

const removeFactDraftBlocks = (markdown: string): string =>
  markdown.replace(factDraftBlockPattern, "").replace(/\n{3,}/g, "\n\n");

const normalizeFactDraftSourceRef = (
  draft: PendingKnowledgeFactDraft,
  sourceRef: string
): PendingKnowledgeFactDraft => ({
  ...draft,
  sourceRef: draft.sourceRef ?? sourceRef
});

const parseFactDraftsFromBlock = (
  blockText: string,
  sourceRef: string
): PendingKnowledgeFactDraft[] => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(blockText);
  } catch {
    throw new CliError("Invalid storymaker-facts block: expected JSON.");
  }

  const candidates = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.factDrafts)
      ? parsed.factDrafts
      : isRecord(parsed) && Array.isArray(parsed.facts)
        ? parsed.facts
        : undefined;

  if (candidates === undefined) {
    throw new CliError(
      "Invalid storymaker-facts block: expected an array or an object with factDrafts."
    );
  }

  return candidates.map((candidate) =>
    normalizeFactDraftSourceRef(validatePendingKnowledgeFactDraft(candidate), sourceRef)
  );
};

const extractFactDraftsFromMarkdown = (
  markdown: string,
  sourceRef: string
): PendingKnowledgeFactDraft[] => {
  const drafts: PendingKnowledgeFactDraft[] = [];
  const pattern = new RegExp(factDraftBlockPattern);
  let match = pattern.exec(markdown);

  while (match !== null) {
    drafts.push(...parseFactDraftsFromBlock(match[1], sourceRef));
    match = pattern.exec(markdown);
  }

  return drafts;
};

const renderSubmittedDraft = (details: {
  body: string;
  markdownTitle: string;
  now: string;
  sourceFile: string;
  workUnit: WorkUnit;
}): string => {
  const body = stripLeadingMarkdownHeading(stripMarkdownFrontMatter(details.body)).trim();
  const normalizedBody =
    body.length === 0 ? `# ${details.markdownTitle}\n` : `# ${details.markdownTitle}\n\n${body}\n`;

  return writeMarkdownWithFrontMatter(
    {
      source: "draft submit",
      source_file: details.sourceFile,
      status: "staged",
      submitted_at: details.now,
      title: details.markdownTitle,
      work_unit_id: details.workUnit.id
    },
    normalizedBody
  );
};

const qualitySeverityRank: Record<QualityGateSeverity, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3
};

const getHighestQualitySeverity = (
  findings: readonly QualityGateFinding[]
): QualityGateSeverity | null => {
  const [highest] = [...findings]
    .map((finding) => finding.severity)
    .sort((left, right) => qualitySeverityRank[left] - qualitySeverityRank[right]);

  return highest ?? null;
};

const collectQualitySuggestions = (
  findings: readonly QualityGateFinding[],
  severity: QualityGateSeverity
): string[] => [
  ...new Set(
    findings
      .filter((finding) => finding.severity === severity)
      .map((finding) => finding.suggestion)
      .filter((suggestion): suggestion is string => suggestion !== undefined)
  )
];

const createQualityFinding = (details: {
  id: string;
  message: string;
  severity: QualityGateSeverity;
  sourceRef: string;
  snippet?: string;
  suggestion: string;
}): QualityGateFinding => ({
  id: details.id,
  message: details.message,
  severity: details.severity,
  snippet: details.snippet,
  sourceRef: details.sourceRef,
  suggestion: details.suggestion
});

const findReaderExperienceFindings = (
  sourceText: string,
  sourceRef: string
): QualityGateFinding[] => {
  const findings: QualityGateFinding[] = [];
  const body = stripLeadingMarkdownHeading(sourceText).trim();
  const blockerPattern = /\b(?:TODO|FIXME)\b|\[[^\]]*(?:insert|rewrite|placeholder)[^\]]*\]/gi;
  const blockerMatch = blockerPattern.exec(body);

  if (blockerMatch !== null) {
    findings.push(
      createQualityFinding({
        id: "reader-experience-unresolved-author-note",
        message:
          "Reader experience blocker: unresolved author note or placeholder remains in the draft.",
        severity: "P1",
        snippet: blockerMatch[0],
        sourceRef,
        suggestion: "Resolve the author note in scene prose before continuing batch production."
      })
    );
  }

  if (body.length > 0 && body.length < 200) {
    findings.push(
      createQualityFinding({
        id: "reader-experience-thin-unit",
        message: "Reader experience issue: draft body is very short for a complete unit.",
        severity: "P2",
        sourceRef,
        suggestion: "Expand the unit with concrete scene action, escalation, and a clearer payoff."
      })
    );
  }

  return findings;
};

const findCommercialReviewFindings = (
  sourceText: string,
  sourceRef: string
): QualityGateFinding[] => {
  const body = stripLeadingMarkdownHeading(sourceText).trim();
  const findings: QualityGateFinding[] = [];
  const finalParagraph = body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .at(-1);

  if (/\bNO_HOOK\b/i.test(body)) {
    findings.push(
      createQualityFinding({
        id: "commercial-review-missing-hook",
        message: "Commercial review issue: draft is marked as missing a hook.",
        severity: "P2",
        sourceRef,
        suggestion: "Add a concrete open loop, reversal, or pressure point before user review."
      })
    );
  }

  if (finalParagraph !== undefined && finalParagraph.length < 80) {
    findings.push(
      createQualityFinding({
        id: "commercial-review-abrupt-ending",
        message:
          "Commercial review suggestion: final beat may be too abrupt for reader pull-through.",
        severity: "P3",
        snippet: finalParagraph,
        sourceRef,
        suggestion: "Consider adding a sharper consequence, question, or next-scene pressure."
      })
    );
  }

  return findings;
};

const runReaderExperienceGate = (
  sourceText: string,
  sourceRef: string,
  options: {
    now: string;
    unitId: string;
  }
): Promise<QualityGateResult> =>
  runQualityGate(
    {
      id: "reader_experience",
      run: () => ({
        findings: findReaderExperienceFindings(sourceText, sourceRef),
        summary: "Checked unresolved author notes, placeholder text, and unit depth."
      })
    },
    {
      now: options.now,
      sourceText,
      unitId: options.unitId
    }
  );

const runCommercialReviewGate = (
  sourceText: string,
  sourceRef: string,
  options: {
    now: string;
    unitId: string;
  }
): Promise<QualityGateResult> =>
  runQualityGate(
    {
      id: "commercial_review",
      run: () => ({
        findings: findCommercialReviewFindings(sourceText, sourceRef),
        summary: "Checked hook markers and final beat pull-through."
      })
    },
    {
      now: options.now,
      sourceText,
      unitId: options.unitId
    }
  );

const createCombinedDraftQualityResult = (details: {
  findings: QualityGateFinding[];
  now: string;
  unitId: string;
}): QualityGateResult => ({
  createdAt: details.now,
  findings: details.findings,
  gate: "production_quality",
  id: `production-quality-${createSafeRunIdPart(details.now)}-${createSafeRunIdPart(
    details.unitId
  )}`,
  status: details.findings.length > 0 ? "failed" : "passed",
  summary: `Collected ${details.findings.length} production quality findings.`
});

const summarizeGateResult = (details: {
  reportFile: string;
  result: QualityGateResult;
}): DraftQualityGateSummary => ({
  findingCount: details.result.findings.length,
  findings: details.result.findings,
  gate: details.result.gate,
  highestSeverity: getHighestQualitySeverity(details.result.findings),
  reportFile: details.reportFile,
  status: details.result.status,
  summary: details.result.summary
});

const findingAffectsSetting = (gate: string, finding: QualityGateFinding): boolean =>
  gate === "consistency" ||
  finding.message.toLowerCase().includes("canon") ||
  finding.message.toLowerCase().includes("setting");

const toAuthorIssue = (
  gate: DraftQualityGateSummary,
  finding: QualityGateFinding
): DraftQualityAuthorIssue => ({
  affectsSetting: findingAffectsSetting(gate.gate, finding),
  gate: gate.gate,
  message: finding.message,
  severity: finding.severity,
  snippet: finding.snippet,
  sourceRef: finding.sourceRef,
  suggestion: finding.suggestion
});

const createAuthorQualitySummary = (details: {
  blocksBatchContinue: boolean;
  gateReports: DraftQualityGateSummary[];
  highestSeverity: QualityGateSeverity | null;
  totalFindings: number;
}): DraftQualityAuthorSummary => {
  const issues = details.gateReports.flatMap((gate) =>
    gate.findings.map((finding) => toAuthorIssue(gate, finding))
  );
  const majorIssues = issues
    .filter((issue) => issue.severity !== "P3")
    .sort((left, right) => qualitySeverityRank[left.severity] - qualitySeverityRank[right.severity])
    .slice(0, 5);
  const settingImpact: DraftQualitySettingImpact = issues.some(
    (issue) => issue.affectsSetting && (issue.severity === "P0" || issue.severity === "P1")
  )
    ? "setting_review_required"
    : issues.some((issue) => issue.affectsSetting)
      ? "possible_setting_impact"
      : "none_detected";
  const approvalRecommendation: DraftQualityApprovalRecommendation = details.blocksBatchContinue
    ? "manual_review_required"
    : details.highestSeverity === "P2"
      ? "revise_before_approval"
      : details.highestSeverity === "P3"
        ? "approve_with_notes"
        : "approve";
  const recommendedToApprove =
    approvalRecommendation === "approve" || approvalRecommendation === "approve_with_notes";
  const overallConclusion =
    details.totalFindings === 0
      ? "Quality review found no issues that should block approval."
      : details.blocksBatchContinue
        ? `Quality review found ${details.highestSeverity} issue(s) that block batch continuation and require manual review.`
        : `Quality review found ${details.totalFindings} issue(s); highest severity is ${
            details.highestSeverity ?? "none"
          }.`;
  const summaryText = `${overallConclusion} Approval recommendation: ${approvalRecommendation}. Setting impact: ${settingImpact}.`;

  return {
    approvalRecommendation,
    majorIssues,
    overallConclusion,
    recommendedToApprove,
    settingImpact,
    summaryText
  };
};

const formatDraftQualityStatusForUser = (
  quality: Pick<DraftQualitySummary, "blocksBatchContinue" | "highestSeverity" | "status">
): string => {
  if (
    quality.status === "failed" &&
    quality.highestSeverity === "P3" &&
    !quality.blocksBatchContinue
  ) {
    return "passed_with_notes";
  }

  return quality.status;
};

const formatDraftQualityGateStatusForUser = (
  gate: Pick<DraftQualityGateSummary, "highestSeverity" | "status">
): string => {
  if (gate.status === "failed" && gate.highestSeverity === "P3") {
    return "passed_with_notes";
  }

  return gate.status;
};

const runDraftQualityChecks = async (details: {
  cwd: string;
  now: string;
  reportFile: string;
  sourceRef: string;
  sourceText: string;
  unitId: string;
}): Promise<DraftQualitySummary> => {
  const sourceText = stripMarkdownFrontMatter(details.sourceText);
  const gateResults = await Promise.all([
    runAiTasteGate(
      {
        sourceRef: details.sourceRef,
        sourceText
      },
      {
        now: details.now,
        unitId: details.unitId
      }
    ),
    runConsistencyGate([], {
      now: details.now,
      sourceText,
      unitId: details.unitId
    }),
    runReaderExperienceGate(sourceText, details.sourceRef, {
      now: details.now,
      unitId: details.unitId
    }),
    runCommercialReviewGate(sourceText, details.sourceRef, {
      now: details.now,
      unitId: details.unitId
    })
  ]);
  const writtenGateReports = await Promise.all(
    gateResults.map((result) => writeQualityGateReport(details.cwd, result))
  );
  const allFindings = gateResults.flatMap((result) => result.findings);
  const combinedResult = createCombinedDraftQualityResult({
    findings: allFindings,
    now: details.now,
    unitId: details.unitId
  });
  const automaticRevision = planAutomaticRevisionStrategy(combinedResult);
  const gateReports = gateResults.map((result, index) =>
    summarizeGateResult({
      reportFile: writtenGateReports[index].relativePath,
      result
    })
  );
  const highestSeverity = getHighestQualitySeverity(allFindings);
  const blocksBatchContinue = blocksAutomaticBatchProduction(combinedResult);
  const authorSummary = createAuthorQualitySummary({
    blocksBatchContinue,
    gateReports,
    highestSeverity,
    totalFindings: allFindings.length
  });

  return {
    automaticRevision,
    authorSummary,
    blocksBatchContinue,
    gateReports,
    highestSeverity,
    p2Suggestions: collectQualitySuggestions(allFindings, "P2"),
    p3Suggestions: collectQualitySuggestions(allFindings, "P3"),
    reportFile: details.reportFile,
    status: combinedResult.status,
    totalFindings: allFindings.length
  };
};

const renderFindingLine = (finding: QualityGateFinding): string => {
  const details = [
    finding.sourceRef ? `source: ${finding.sourceRef}` : undefined,
    finding.suggestion ? `suggestion: ${finding.suggestion}` : undefined
  ].filter((value): value is string => value !== undefined);

  return `- [${finding.severity}] ${finding.message}${
    details.length > 0 ? ` (${details.join("; ")})` : ""
  }`;
};

const renderAuthorIssue = (issue: DraftQualityAuthorIssue): string => {
  const lines = [
    `- [${issue.severity}] ${issue.message}`,
    `  - Gate: ${issue.gate}`,
    `  - Affects setting: ${issue.affectsSetting ? "yes" : "no"}`
  ];

  if (issue.sourceRef) {
    lines.push(`  - Source: ${issue.sourceRef}`);
  }

  if (issue.snippet) {
    lines.push(`  - Concrete evidence: ${issue.snippet}`);
  }

  if (issue.suggestion) {
    lines.push(`  - Revision suggestion: ${issue.suggestion}`);
  }

  return lines.join("\n");
};

const renderDraftSubmitReport = (
  report: Omit<DraftSubmitReport, "workUnit"> & { workUnit: WorkUnit }
): string => {
  const authorSummary = report.quality.authorSummary;
  const lines = [
    "# StoryMaker Draft Submit Quality Report",
    "",
    `Run: ${report.runId}`,
    `WorkUnit: ${report.unitId}`,
    `Display title: ${report.workUnit.displayTitle}`,
    `Source file: ${report.sourceFile}`,
    `Staged output: ${report.stagedOutputFile}`,
    `PendingKnowledgeUpdate: ${report.pendingKnowledgeUpdateFile}`,
    "Canon committed: no",
    `Workflow status: ${report.workflowStatus}`,
    "",
    "## Quality Summary",
    "",
    `Status: ${formatDraftQualityStatusForUser(report.quality)}`,
    `Highest severity: ${report.quality.highestSeverity ?? "none"}`,
    `Total findings: ${report.quality.totalFindings}`,
    `Blocks batch continue: ${report.quality.blocksBatchContinue ? "yes" : "no"}`,
    `Automatic revision action: ${report.quality.automaticRevision.action}`,
    `Automatic revision reason: ${report.quality.automaticRevision.reason}`,
    "",
    "## Overall Conclusion",
    "",
    authorSummary.overallConclusion,
    "",
    "## Approval Recommendation",
    "",
    `Recommendation: ${authorSummary.approvalRecommendation}`,
    `Recommended to approve: ${authorSummary.recommendedToApprove ? "yes" : "no"}`,
    `Setting impact: ${authorSummary.settingImpact}`,
    "",
    "## Major Issues",
    "",
    ...(authorSummary.majorIssues.length === 0
      ? ["- none"]
      : authorSummary.majorIssues.map(renderAuthorIssue)),
    "",
    "## AI Reply Summary",
    "",
    authorSummary.summaryText,
    "",
    "## Gate Results"
  ];

  for (const gate of report.quality.gateReports) {
    lines.push(
      "",
      `### ${gate.gate}`,
      "",
      `Status: ${formatDraftQualityGateStatusForUser(gate)}`,
      `Highest severity: ${gate.highestSeverity ?? "none"}`,
      `Findings: ${gate.findingCount}`,
      `JSON report: ${gate.reportFile}`,
      `Summary: ${gate.summary ?? "none"}`
    );

    if (gate.findings.length === 0) {
      lines.push("", "- none");
    } else {
      lines.push("", ...gate.findings.map(renderFindingLine));
    }
  }

  if (report.quality.p2Suggestions.length > 0) {
    lines.push(
      "",
      "## P2 Revision Suggestions",
      "",
      ...report.quality.p2Suggestions.map((item) => `- ${item}`)
    );
  }

  if (report.quality.p3Suggestions.length > 0) {
    lines.push(
      "",
      "## P3 Suggestions",
      "",
      ...report.quality.p3Suggestions.map((item) => `- ${item}`)
    );
  }

  lines.push("");

  return `${lines.join("\n")}\n`;
};

export const submitDraft = async (options: DraftSubmitOptions): Promise<DraftSubmitReport> => {
  const projectYamlPath = join(options.cwd, "project.yaml");

  if (!(await fileExists(projectYamlPath))) {
    throw new CliError("Not a StoryOS project: missing project.yaml. Run storyctl init first.");
  }

  const sourcePath = resolve(options.cwd, options.fromFile);
  if (!(await fileExists(sourcePath))) {
    throw new CliError(`Draft source file not found: ${options.fromFile}.`);
  }

  const sourceBody = await readFile(sourcePath, "utf8");
  if (sourceBody.trim().length === 0) {
    throw new CliError("Draft source file is empty.");
  }

  const config = parseProjectYaml(await readFile(projectYamlPath, "utf8"));
  const workflowState = await readWorkflowStateForResume(options.cwd);
  const { existingUnits, workUnit } = await resolveDraftSubmitWorkUnit(
    options.cwd,
    config,
    options.unit,
    options.title
  );

  if (
    workflowState.status === "awaiting_user_review" &&
    workflowState.currentUnitId !== undefined &&
    workflowState.currentUnitId !== workUnit.id
  ) {
    throw new CliError(
      `Cannot submit ${workUnit.id}; workflow is awaiting review for ${workflowState.currentUnitId}.`
    );
  }

  if (workflowState.status === "producing") {
    throw new CliError("Cannot submit a draft while workflow-state.json is producing.");
  }

  const displayTitle = formatWorkUnitDisplayTitle({
    index: workUnit.index,
    numberPadding: config.writing.chapter_number_padding,
    title: options.title,
    type: workUnit.type
  });
  const outputPlan = createChapterMarkdownOutputPlan({
    outputDir: config.writing.output_dir,
    outputFormat: config.writing.output_format,
    title: displayTitle
  });
  const stagedOutputFile = outputPlan.relativePath;
  const factDrafts = extractFactDraftsFromMarkdown(sourceBody, stagedOutputFile);
  const submittedWorkUnit = buildSubmittedWorkUnit({
    config,
    existingUnits,
    stagedOutputFile,
    title: options.title,
    workUnit
  });
  const runId = `draft-submit-${createSafeRunIdPart(options.now)}-${createSafeRunIdPart(
    submittedWorkUnit.id
  )}`;
  const pendingKnowledgeUpdate = createPendingKnowledgeUpdate({
    createdAt: options.now,
    factDrafts,
    sourceRunId: runId,
    unitId: submittedWorkUnit.id
  });
  const pendingKnowledgeUpdateFile = await writePendingKnowledgeUpdate(
    options.cwd,
    pendingKnowledgeUpdate
  );
  const reportFile = normalizeRelativeOutputPath(join("reviews", `${runId}.md`));
  const runFile = normalizeRelativeOutputPath(join(".storyos", "runs", `${runId}.json`));
  const sourceFile = normalizeRelativeOutputPath(relative(options.cwd, sourcePath));
  const submittedDraft = renderSubmittedDraft({
    body: removeFactDraftBlocks(sourceBody),
    markdownTitle: outputPlan.markdownTitle,
    now: options.now,
    sourceFile,
    workUnit: submittedWorkUnit
  });

  await mkdir(dirname(join(options.cwd, stagedOutputFile)), {
    recursive: true
  });
  await writeFile(join(options.cwd, stagedOutputFile), submittedDraft, "utf8");

  const quality = await runDraftQualityChecks({
    cwd: options.cwd,
    now: options.now,
    reportFile,
    sourceRef: stagedOutputFile,
    sourceText: submittedDraft,
    unitId: submittedWorkUnit.id
  });
  const report: DraftSubmitReport = {
    pendingKnowledgeUpdateFile,
    quality,
    reportFile,
    runFile,
    runId,
    sourceFile,
    stagedOutputFile,
    unitId: submittedWorkUnit.id,
    workflowStatus: "awaiting_user_review",
    workUnit: submittedWorkUnit
  };

  await mkdir(dirname(join(options.cwd, reportFile)), {
    recursive: true
  });
  await writeFile(join(options.cwd, reportFile), renderDraftSubmitReport(report), "utf8");

  await writeProductionRunForProduce(options.cwd, {
    endedAt: options.now,
    id: runId,
    pendingKnowledgeUpdateFile,
    quality,
    reportFile,
    stagedOutputFile,
    startedAt: options.now,
    status: "completed",
    steps: [
      {
        endedAt: options.now,
        id: "read-submitted-draft",
        name: "Read submitted draft",
        startedAt: options.now,
        status: "completed"
      },
      {
        endedAt: options.now,
        id: "write-staged-output",
        name: "Write staged output",
        startedAt: options.now,
        status: "completed"
      },
      {
        endedAt: options.now,
        id: "prepare-pending-knowledge-update",
        name: "Prepare pending knowledge update",
        startedAt: options.now,
        status: "completed"
      },
      {
        endedAt: options.now,
        id: "run-quality-gates",
        name: "Run quality gates",
        reportFile,
        startedAt: options.now,
        status: "completed"
      },
      {
        endedAt: options.now,
        id: "update-workflow-state",
        name: "Update workflow state",
        startedAt: options.now,
        status: "completed"
      }
    ],
    unitId: submittedWorkUnit.id
  });

  await writeWorkUnit(options.cwd, submittedWorkUnit);
  await writeJsonFile(join(options.cwd, ".storyos", "workflow-state.json"), {
    currentRunId: runId,
    currentUnit: submittedWorkUnit.displayTitle,
    currentUnitId: submittedWorkUnit.id,
    stagedOutputFile,
    status: "awaiting_user_review",
    updatedAt: options.now
  });

  return report;
};

const formatDraftSubmitReport = (report: DraftSubmitReport): string =>
  `StoryMaker draft submit
WorkUnit: ${report.unitId}
WorkUnit status: ${report.workUnit.status}
Staged output: ${report.stagedOutputFile}
PendingKnowledgeUpdate: ${report.pendingKnowledgeUpdateFile}
Report: ${report.reportFile}
ProductionRun: ${report.runFile}
Workflow status: ${report.workflowStatus}
Quality status: ${formatDraftQualityStatusForUser(report.quality)}
Highest severity: ${report.quality.highestSeverity ?? "none"}
Blocks batch continue: ${report.quality.blocksBatchContinue ? "yes" : "no"}
Canon committed: no
Next: ${
    report.quality.blocksBatchContinue
      ? formatQualityBlockedNextAction(report.quality, report.reportFile)
      : "review the staged draft, then approve or reject it."
  }
`;

const renderStagedOutput = (
  workUnit: WorkUnit,
  run: ProductionRun,
  contextReport: ContextReport,
  markdownTitle: string
): string => {
  const sourceLines =
    contextReport.sources.length === 0
      ? ["- none"]
      : contextReport.sources.map((source) => `- ${source.sourcePath}: ${source.summary}`);
  const gapLines =
    contextReport.gaps.length === 0 ? ["- none"] : contextReport.gaps.map((gap) => `- ${gap}`);

  const body = `# ${markdownTitle}

Placeholder production draft. This file is staged for user review and is not canon.

## Context Snapshot

${sourceLines.join("\n")}

## Known Gaps

${gapLines.join("\n")}

## Draft Placeholder

The real generation adapter has not been connected yet. This skeleton proves the
production workflow can allocate a WorkUnit, gather context, record every step,
write a staged output, and pause for user review without committing canon facts.
`;

  return writeMarkdownWithFrontMatter(
    {
      production_run_id: run.id,
      status: "staged",
      title: markdownTitle,
      work_unit_id: workUnit.id
    },
    body
  );
};

const renderProduceReport = (
  workUnit: WorkUnit,
  run: ProductionRun,
  contextReport: ContextReport
): string => {
  const completedSteps = run.steps.filter((step) => step.status === "completed").length;
  const stepLines = run.steps.map((step) => `- [${step.status}] ${step.id}: ${step.name}`);
  const gapLines =
    contextReport.gaps.length === 0 ? ["- none"] : contextReport.gaps.map((gap) => `- ${gap}`);

  return `# StoryMaker Production Report

Run: ${run.id}
WorkUnit: ${workUnit.id}
Display title: ${workUnit.displayTitle}
Status: ${workUnit.status}
Staged output: ${run.stagedOutputFile ?? "none"}
PendingKnowledgeUpdate: ${run.pendingKnowledgeUpdateFile ?? "none"}
Canon committed: no
Steps: ${completedSteps}/${run.steps.length}

## Steps

${stepLines.join("\n")}

## Context Gaps

${gapLines.join("\n")}
`;
};

export const produceNext = async (options: ProduceNextOptions): Promise<ProduceNextReport> => {
  const projectYamlPath = join(options.cwd, "project.yaml");

  if (!(await fileExists(projectYamlPath))) {
    throw new CliError("Not a StoryOS project: missing project.yaml. Run storyctl init first.");
  }

  const workflowState = await readWorkflowStateForResume(options.cwd);

  if (workflowState.status === "awaiting_user_review") {
    throw new CliError(
      "Current workflow is awaiting user review. Review the staged output before producing the next unit."
    );
  }

  if (workflowState.status === "producing") {
    throw new CliError(
      "Current workflow is already producing. Run storyctl resume before starting another production run."
    );
  }

  const config = parseProjectYaml(await readFile(projectYamlPath, "utf8"));
  const existingUnits = await readPersistedWorkUnits(options.cwd);
  let workUnit = createNextWorkUnit({
    existingUnits,
    numberPadding: config.writing.chapter_number_padding,
    status: "producing",
    title: "Placeholder Chapter",
    type: config.project.unit_name
  });
  const runId = await createUniqueRunId(options.cwd, options.now, workUnit);
  const chapterOutput = createChapterMarkdownOutputPlan({
    outputDir: config.writing.output_dir,
    outputFormat: config.writing.output_format,
    title: workUnit.filenameTitle ?? workUnit.displayTitle
  });
  const stagedOutputFile = chapterOutput.relativePath;
  const reportFile = normalizeRelativeOutputPath(join("reviews", `${runId}.md`));
  const pendingKnowledgeUpdate = createPendingKnowledgeUpdate({
    createdAt: options.now,
    sourceRunId: runId,
    unitId: workUnit.id
  });
  let pendingKnowledgeUpdateFile = "";
  const run: ProductionRun = {
    id: runId,
    reportFile,
    stagedOutputFile,
    startedAt: options.now,
    status: "running",
    steps: createPendingProductionSteps(),
    unitId: workUnit.id
  };
  const completeStep = (stepId: string, details: { reportFile?: string } = {}): Promise<void> =>
    completeProduceStep(options.cwd, run, stepId, options.now, {
      ...details,
      onProgress: options.onProgress
    });

  await writeProductionRunForProduce(options.cwd, run);
  await completeStep("load-project-config");

  await writeWorkUnit(options.cwd, workUnit);
  await completeStep("allocate-work-unit");

  const contextReport = await readContext({
    cwd: options.cwd,
    unit: String(workUnit.index + 1)
  });
  await completeStep("gather-context");

  const promptSkeleton = [
    `WorkUnit: ${workUnit.displayTitle}`,
    "Use the prompt-ready context below.",
    contextReport.promptReadyContext
  ].join("\n\n");
  await completeStep("build-generation-prompt");

  const stagedBody = renderStagedOutput(workUnit, run, contextReport, chapterOutput.markdownTitle);
  void promptSkeleton;
  await completeStep("draft-placeholder");

  await completeStep("run-continuity-gate");
  await completeStep("run-commercial-gate");
  await completeStep("run-reader-gate");
  await completeStep("prepare-revision-placeholder");

  await mkdir(dirname(join(options.cwd, stagedOutputFile)), {
    recursive: true
  });
  await writeFile(join(options.cwd, stagedOutputFile), stagedBody, "utf8");
  pendingKnowledgeUpdateFile = await writePendingKnowledgeUpdate(
    options.cwd,
    pendingKnowledgeUpdate
  );
  run.pendingKnowledgeUpdateFile = pendingKnowledgeUpdateFile;
  await writeProductionRunForProduce(options.cwd, run);
  await completeStep("write-staged-output");

  let reportBody = renderProduceReport(workUnit, run, contextReport);
  await mkdir(dirname(join(options.cwd, reportFile)), {
    recursive: true
  });
  await writeFile(join(options.cwd, reportFile), reportBody, "utf8");
  await completeStep("write-production-report", {
    reportFile
  });

  workUnit = validateWorkUnit({
    ...workUnit,
    stagedOutputFile,
    status: "awaiting_user_review"
  });
  await writeWorkUnit(options.cwd, workUnit);
  await writeJsonFile(join(options.cwd, ".storyos", "workflow-state.json"), {
    currentRunId: run.id,
    currentUnit: workUnit.displayTitle,
    currentUnitId: workUnit.id,
    stagedOutputFile,
    status: "awaiting_user_review",
    updatedAt: options.now
  });
  await completeStep("update-workflow-state");

  run.status = "completed";
  run.endedAt = options.now;
  await writeProductionRunForProduce(options.cwd, run);
  reportBody = renderProduceReport(workUnit, run, contextReport);
  await writeFile(join(options.cwd, reportFile), reportBody, "utf8");

  return {
    acceptance: createFinalAcceptanceSummary({
      draftPath: stagedOutputFile,
      qualityReportPath: reportFile,
      unitId: workUnit.id
    }),
    completedSteps: run.steps.filter((step) => step.status === "completed").length,
    pendingKnowledgeUpdateFile,
    reportFile,
    runFile: normalizeRelativeOutputPath(join(".storyos", "runs", `${run.id}.json`)),
    runId: run.id,
    stagedOutputFile,
    totalSteps: run.steps.length,
    workUnit
  };
};

const formatProduceNextReport = (report: ProduceNextReport): string =>
  `StoryMaker produce next
Mode: placeholder fallback
Run: ${report.runId}
WorkUnit: ${report.workUnit.id}
WorkUnit status: ${report.workUnit.status}
Staged output: ${report.stagedOutputFile}
PendingKnowledgeUpdate: ${report.pendingKnowledgeUpdateFile}
Report: ${report.reportFile}
ProductionRun: ${report.runFile}
Steps: ${report.completedSteps}/${report.totalSteps} completed
Canon committed: no
${formatFinalAcceptanceSummary(report.acceptance)}
Next: review this placeholder fallback output, or use the real flow with produce packet and draft submit.
`;

const getResumeReportFile = (resume: ResumeReport): string | null =>
  resume.latestRun?.reportFile ?? resume.failedStep?.reportFile ?? null;

export const continueWorkflow = async (options: ContinueOptions): Promise<ContinueReport> => {
  const resume = await readResume(options.cwd);

  if (resume.workflowStatus === "idle" || resume.workflowStatus === "ready_to_produce") {
    return {
      action: "show_resume_guidance",
      acceptance: null,
      currentUnitId: resume.currentUnitId,
      nextAction:
        "Real production now starts with storymaker produce packet --unit next --json, then AI draft writing, then storymaker draft submit. Use storymaker produce next --placeholder only for deterministic development fallback.",
      production: null,
      reportFile: getResumeReportFile(resume),
      resume,
      stagedOutputFile: nullableOutputPath(resume.stagedOutputFile),
      status: resume.workflowStatus
    };
  }

  if (resume.workflowStatus === "awaiting_user_review") {
    const stagedOutputFile = nullableOutputPath(resume.stagedOutputFile);
    const reportFile = getResumeReportFile(resume);

    return {
      action: "show_pending_review",
      acceptance: createFinalAcceptanceSummary({
        draftPath: stagedOutputFile,
        qualityReportPath: reportFile,
        unitId: resume.currentUnitId
      }),
      currentUnitId: resume.currentUnitId,
      nextAction: buildPendingReviewNextAction(resume.latestRun),
      production: null,
      reportFile,
      resume,
      stagedOutputFile,
      status: resume.workflowStatus
    };
  }

  if (resume.workflowStatus === "blocked") {
    return {
      action: "show_blocker",
      acceptance: null,
      currentUnitId: resume.currentUnitId,
      nextAction: resume.nextAction,
      production: null,
      reportFile: getResumeReportFile(resume),
      resume,
      stagedOutputFile: nullableOutputPath(resume.stagedOutputFile),
      status: resume.workflowStatus
    };
  }

  return {
    action: "show_resume_guidance",
    acceptance: null,
    currentUnitId: resume.currentUnitId,
    nextAction: resume.nextAction,
    production: null,
    reportFile: getResumeReportFile(resume),
    resume,
    stagedOutputFile: nullableOutputPath(resume.stagedOutputFile),
    status: resume.workflowStatus
  };
};

const formatContinueAction = (action: ContinueReport["action"]): string => {
  if (action === "produced_next_unit") {
    return "produced next unit";
  }

  if (action === "show_pending_review") {
    return "show pending review";
  }

  if (action === "show_blocker") {
    return "show blocker";
  }

  return "show resume guidance";
};

const formatContinueReport = (report: ContinueReport): string => {
  const lines = [
    "StoryMaker continue",
    `Status: ${report.status}`,
    `Action: ${formatContinueAction(report.action)}`,
    `Current WorkUnit: ${report.currentUnitId ?? "none"}`,
    `Draft: ${report.stagedOutputFile ?? "none"}`,
    `Report: ${report.reportFile ?? "none"}`
  ];

  if (report.production !== null) {
    lines.push(
      `ProductionRun: ${report.production.runFile}`,
      `Steps: ${report.production.completedSteps}/${report.production.totalSteps} completed`
    );
  } else if (report.resume.latestRun !== null) {
    lines.push(`Latest run: ${report.resume.latestRun.id} (${report.resume.latestRun.status})`);
  }

  if (report.resume.failedStep !== null) {
    lines.push(
      `Failed step: ${formatProductionStep(report.resume.failedStep)}`,
      `Failed step error: ${report.resume.failedStep.error ?? "none"}`
    );
  }

  if (report.acceptance !== null) {
    lines.push("", formatFinalAcceptanceSummary(report.acceptance));
  }

  lines.push(`Next: ${report.nextAction}`);

  return `${lines.join("\n")}\n`;
};

const isNumericUnitSelector = (value: string): boolean => /^[0-9]+$/.test(value);

const resolveWorkUnitForReviewCommand = async (
  cwd: string,
  unitSelector: string
): Promise<WorkUnit> => {
  const workUnits = await readPersistedWorkUnits(cwd);
  const numericUnit = isNumericUnitSelector(unitSelector) ? Number(unitSelector) : Number.NaN;
  const workUnit = workUnits.find((candidate) => {
    if (candidate.id === unitSelector) {
      return true;
    }

    if (candidate.displayTitle === unitSelector) {
      return true;
    }

    return Number.isInteger(numericUnit) && candidate.index + 1 === numericUnit;
  });

  if (workUnit === undefined) {
    throw new CliError(`WorkUnit not found for --unit ${unitSelector}.`);
  }

  return workUnit;
};

const getIdFromRelativeJsonPath = (relativePath: string): string | undefined => {
  const fileName = relativePath.split(/[\\/]/).at(-1);

  if (fileName === undefined || !fileName.endsWith(".json")) {
    return undefined;
  }

  return fileName.slice(0, -".json".length);
};

const readProductionRunForWorkflowState = async (
  cwd: string,
  workflowState: WorkflowState
): Promise<ProductionRun | undefined> => {
  if (workflowState.currentRunId !== undefined) {
    return validateProductionRunForResume(
      await parseJsonFile(
        getProductionRunFilePathForProduce(cwd, workflowState.currentRunId),
        `ProductionRun ${workflowState.currentRunId}`
      )
    );
  }

  return readLatestProductionRunForResume(cwd);
};

const readStagedPendingKnowledgeUpdateForUnit = async (
  cwd: string,
  workUnit: WorkUnit,
  productionRun: ProductionRun | undefined
): Promise<PendingKnowledgeUpdate> => {
  const candidateIds = new Set<string>();
  const runPendingId =
    productionRun?.pendingKnowledgeUpdateFile === undefined
      ? undefined
      : getIdFromRelativeJsonPath(productionRun.pendingKnowledgeUpdateFile);

  if (runPendingId !== undefined) {
    candidateIds.add(runPendingId);
  }

  for (const id of await listPendingKnowledgeUpdateIds(cwd)) {
    candidateIds.add(id);
  }

  const candidates: PendingKnowledgeUpdate[] = [];

  for (const id of candidateIds) {
    const update = await readPendingKnowledgeUpdate(cwd, id);

    if (update.unitId === workUnit.id) {
      candidates.push(update);
    }
  }

  const matching = candidates
    .filter((update) => update.status === "staged")
    .sort((left, right) => {
      if (productionRun?.id !== undefined) {
        if (left.sourceRunId === productionRun.id && right.sourceRunId !== productionRun.id) {
          return -1;
        }

        if (right.sourceRunId === productionRun.id && left.sourceRunId !== productionRun.id) {
          return 1;
        }
      }

      return right.createdAt.localeCompare(left.createdAt);
    })[0];

  if (matching === undefined) {
    throw new CliError(`No staged PendingKnowledgeUpdate found for ${workUnit.id}.`);
  }

  return matching;
};

const renderPayloadItem = (payload: unknown): string => {
  const content = isRecord(payload)
    ? (payload.content ?? payload.summary ?? payload.note ?? payload.title)
    : undefined;
  const sourceRefs = isRecord(payload)
    ? [
        typeof payload.sourceRef === "string" ? payload.sourceRef : undefined,
        ...(Array.isArray(payload.sourceRefs)
          ? payload.sourceRefs.filter((sourceRef) => typeof sourceRef === "string")
          : [])
      ]
        .map((sourceRef) => sourceRef?.trim())
        .filter((sourceRef): sourceRef is string => sourceRef !== undefined && sourceRef.length > 0)
    : [];
  const sourceSuffix =
    sourceRefs.length === 0 ? "" : ` (source: ${[...new Set(sourceRefs)].join(", ")})`;

  if (typeof content === "string" && content.trim().length > 0) {
    return `${content.trim()}${sourceSuffix}`;
  }

  return `${JSON.stringify(payload)}${sourceSuffix}`;
};

const renderPayloadList = (title: string, payloads: readonly unknown[]): string => {
  const lines =
    payloads.length === 0
      ? ["- none"]
      : payloads.map((payload) => `- ${renderPayloadItem(payload)}`);

  return `## ${title}\n\n${lines.join("\n")}`;
};

const renderCommittedKnowledgeMarkdown = (
  workUnit: WorkUnit,
  update: PendingKnowledgeUpdate
): string => {
  const body = `# Knowledge Update: ${workUnit.displayTitle}

Committed from staged PendingKnowledgeUpdate ${update.id}.

${renderPayloadList("Facts", update.facts)}

${renderPayloadList("Fact Drafts", update.factDrafts)}

${renderPayloadList("Entity Updates", update.entityUpdates)}

${renderPayloadList("Timeline Updates", update.timelineUpdates)}

${renderPayloadList("Foreshadowing Updates", update.foreshadowingUpdates)}
`;

  return writeMarkdownWithFrontMatter(
    {
      pending_knowledge_update_id: update.id,
      source_run_id: update.sourceRunId,
      status: "canon",
      title: `Knowledge Update: ${workUnit.displayTitle}`,
      work_unit_id: workUnit.id
    },
    body
  );
};

const getCommittedKnowledgeFileForApprove = (workUnit: WorkUnit): string =>
  normalizeRelativeOutputPath(
    join("knowledge", "committed-updates", `${createSafeRunIdPart(workUnit.id)}.md`)
  );

const writeCommittedKnowledgeForApprove = async (
  cwd: string,
  workUnit: WorkUnit,
  update: PendingKnowledgeUpdate
): Promise<string> => {
  const relativePath = getCommittedKnowledgeFileForApprove(workUnit);
  const filePath = join(cwd, relativePath);

  await mkdir(dirname(filePath), {
    recursive: true
  });
  await writeFile(filePath, renderCommittedKnowledgeMarkdown(workUnit, update), "utf8");

  return relativePath;
};

const applyApproveSourceRefToPayload = (
  payload: PendingKnowledgeUpdatePayload,
  sourceRef: string
): PendingKnowledgeUpdatePayload => ({
  ...payload,
  ...(Object.hasOwn(payload, "sourcePath") ? { sourcePath: sourceRef } : {}),
  ...(Object.hasOwn(payload, "sourceRefs") ? { sourceRefs: [sourceRef] } : {}),
  ...(Object.hasOwn(payload, "source_path") ? { source_path: sourceRef } : {}),
  sourceRef
});

const preparePendingKnowledgeUpdateForApprove = (
  update: PendingKnowledgeUpdate,
  sourceRef: string
): PendingKnowledgeUpdate => ({
  ...update,
  entityUpdates: update.entityUpdates.map((payload) =>
    applyApproveSourceRefToPayload(payload, sourceRef)
  ),
  factDrafts: update.factDrafts.map((draft) => ({
    ...draft,
    sourceRef
  })),
  facts: update.facts.map((payload) => applyApproveSourceRefToPayload(payload, sourceRef)),
  foreshadowingUpdates: update.foreshadowingUpdates.map((payload) =>
    applyApproveSourceRefToPayload(payload, sourceRef)
  ),
  timelineUpdates: update.timelineUpdates.map((payload) =>
    applyApproveSourceRefToPayload(payload, sourceRef)
  )
});

const promoteStagedOutputToCanon = async (cwd: string, stagedOutputFile: string): Promise<void> => {
  const filePath = join(cwd, stagedOutputFile);
  const parsed = readMarkdownWithFrontMatter(await readFile(filePath, "utf8"));

  await writeFile(
    filePath,
    writeMarkdownWithFrontMatter(
      {
        ...parsed.frontMatter,
        status: "canon"
      },
      parsed.body
    ),
    "utf8"
  );
};

const createNextReadyUnitId = (workUnit: WorkUnit): string => {
  const nextUnitNumber = workUnit.index + 2;
  const match = workUnit.id.match(/^(.*?)([0-9]+)$/);

  if (match !== null) {
    return `${match[1]}${String(nextUnitNumber).padStart(match[2].length, "0")}`;
  }

  return `${workUnit.type}-${String(nextUnitNumber).padStart(4, "0")}`;
};

const getApproveCheckpointFile = (cwd: string, now: string, workUnit: WorkUnit): string =>
  join(
    cwd,
    ".storyos",
    "checkpoints",
    `${createSafeRunIdPart(`${now}-approve-${workUnit.id}`)}.json`
  );

const writeApproveCheckpoint = async (
  cwd: string,
  details: {
    knowledgeCommit: {
      committedKnowledgeFile: string;
      factDraftCount: number;
      factCount: number;
      pendingKnowledgeUpdateFile: string;
      sourceRef: string;
    };
    now: string;
    workflowState: WorkflowState;
    workUnit: WorkUnit;
  }
): Promise<string> => {
  const filePath = getApproveCheckpointFile(cwd, details.now, details.workUnit);

  await writeJsonFile(filePath, {
    createdAt: details.now,
    id: createSafeRunIdPart(`${details.now}-approve-${details.workUnit.id}`),
    knowledgeCommit: details.knowledgeCommit,
    note: `approved ${details.workUnit.id}`,
    reason: "approve",
    workflowState: details.workflowState
  });

  return normalizeRelativeOutputPath(relative(cwd, filePath));
};

export const approveUnit = async (options: ApproveOptions): Promise<ApproveReport> => {
  if (!(await fileExists(join(options.cwd, "project.yaml")))) {
    throw new CliError("Not a StoryOS project: missing project.yaml. Run storyctl init first.");
  }

  const workflowState = await readWorkflowStateForResume(options.cwd);

  if (workflowState.status !== "awaiting_user_review") {
    throw new CliError("Cannot approve unless workflow-state.json is awaiting_user_review.");
  }

  const workUnit = await resolveWorkUnitForReviewCommand(options.cwd, options.unit);

  if (workflowState.currentUnitId !== undefined && workflowState.currentUnitId !== workUnit.id) {
    throw new CliError(
      `Cannot approve ${workUnit.id}; workflow is awaiting review for ${workflowState.currentUnitId}.`
    );
  }

  if (workUnit.status !== "awaiting_user_review") {
    throw new CliError(`Cannot approve ${workUnit.id}; WorkUnit status is ${workUnit.status}.`);
  }

  const stagedOutputFile = workUnit.stagedOutputFile ?? workflowState.stagedOutputFile;

  if (stagedOutputFile === undefined) {
    throw new CliError(`Cannot approve ${workUnit.id}; stagedOutputFile is missing.`);
  }

  const productionRun = await readProductionRunForWorkflowState(options.cwd, workflowState);
  const pendingUpdate = await readStagedPendingKnowledgeUpdateForUnit(
    options.cwd,
    workUnit,
    productionRun
  );
  const committedUpdate = commitPendingKnowledgeUpdate(
    preparePendingKnowledgeUpdateForApprove(pendingUpdate, stagedOutputFile),
    options.now
  );

  await promoteStagedOutputToCanon(options.cwd, stagedOutputFile);
  const pendingKnowledgeUpdateFile = await writePendingKnowledgeUpdate(
    options.cwd,
    committedUpdate
  );
  const committedKnowledgeFile = await writeCommittedKnowledgeForApprove(
    options.cwd,
    workUnit,
    committedUpdate
  );

  const approvedWorkUnit = validateWorkUnit({
    ...workUnit,
    outputFile: stagedOutputFile,
    stagedOutputFile: undefined,
    status: "final"
  });
  await writeWorkUnit(options.cwd, approvedWorkUnit);

  const nextUnitId = createNextReadyUnitId(approvedWorkUnit);
  const nextWorkflowState: WorkflowState = {
    currentUnit: nextUnitId,
    currentUnitId: nextUnitId,
    status: "ready_to_produce",
    updatedAt: options.now
  };
  await writeJsonFile(join(options.cwd, ".storyos", "workflow-state.json"), nextWorkflowState);

  const checkpointFile = await writeApproveCheckpoint(options.cwd, {
    knowledgeCommit: {
      committedKnowledgeFile,
      factCount: committedUpdate.facts.length,
      factDraftCount: committedUpdate.factDrafts.length,
      pendingKnowledgeUpdateFile,
      sourceRef: stagedOutputFile
    },
    now: options.now,
    workflowState: nextWorkflowState,
    workUnit: approvedWorkUnit
  });

  await indexStoryProject({
    cwd: options.cwd,
    rebuild: true
  });

  return {
    checkpointFile,
    committedKnowledgeFile,
    outputFile: stagedOutputFile,
    pendingKnowledgeUpdateFile,
    unitId: approvedWorkUnit.id,
    workflowStatus: nextWorkflowState.status,
    workUnit: approvedWorkUnit
  };
};

const formatApproveReport = (report: ApproveReport): string =>
  `StoryMaker approve
WorkUnit: ${report.unitId}
WorkUnit status: ${report.workUnit.status}
Output: ${report.outputFile}
PendingKnowledgeUpdate: ${report.pendingKnowledgeUpdateFile}
Canon knowledge: ${report.committedKnowledgeFile}
Checkpoint: ${report.checkpointFile}
WorkflowState: ${report.workflowStatus}
Next: run storymaker produce packet --unit next --json, write the draft, then run storymaker draft submit. Use storymaker produce next --placeholder only for deterministic development fallback.
`;

const getRejectRevisionDir = (workUnit: WorkUnit): string =>
  normalizeRelativeOutputPath(join("units", "chapters", workUnit.id, "revisions"));

const createRejectedRevisionFileName = (now: string): string =>
  `rejected-${createSafeRunIdPart(now)}.md`;

const createUniqueRejectedRevisionFile = async (
  cwd: string,
  revisionDir: string,
  now: string
): Promise<string> => {
  const baseName = createRejectedRevisionFileName(now);
  let candidate = normalizeRelativeOutputPath(join(revisionDir, baseName));
  let index = 2;

  while (await fileExists(join(cwd, candidate))) {
    candidate = normalizeRelativeOutputPath(
      join(revisionDir, baseName.replace(/\.md$/, `-${index}.md`))
    );
    index += 1;
  }

  return candidate;
};

const moveStagedOutputToRejectedRevision = async (
  options: RejectOptions,
  workUnit: WorkUnit,
  stagedOutputFile: string
): Promise<{ reasonFile: string; revisionDir: string; revisionFile: string }> => {
  const revisionDir = getRejectRevisionDir(workUnit);
  const revisionFile = await createUniqueRejectedRevisionFile(
    options.cwd,
    revisionDir,
    options.now
  );
  const sourcePath = join(options.cwd, stagedOutputFile);
  const targetPath = join(options.cwd, revisionFile);
  const parsed = readMarkdownWithFrontMatter(await readFile(sourcePath, "utf8"));

  await mkdir(dirname(targetPath), {
    recursive: true
  });
  await writeFile(
    sourcePath,
    writeMarkdownWithFrontMatter(
      {
        ...parsed.frontMatter,
        original_staged_output_file: stagedOutputFile,
        reject_reason: options.reason,
        rejected_at: options.now,
        status: "rejected"
      },
      parsed.body
    ),
    "utf8"
  );
  await rename(sourcePath, targetPath);

  const reasonFile = revisionFile.replace(/\.md$/, ".json");

  await writeJsonFile(join(options.cwd, reasonFile), {
    originalStagedOutputFile: stagedOutputFile,
    reason: options.reason,
    rejectedAt: options.now,
    revisionFile,
    unitId: workUnit.id
  });

  return {
    reasonFile,
    revisionDir,
    revisionFile
  };
};

export const rejectUnit = async (options: RejectOptions): Promise<RejectReport> => {
  if (!(await fileExists(join(options.cwd, "project.yaml")))) {
    throw new CliError("Not a StoryOS project: missing project.yaml. Run storyctl init first.");
  }

  const workflowState = await readWorkflowStateForResume(options.cwd);

  if (workflowState.status !== "awaiting_user_review") {
    throw new CliError("Cannot reject unless workflow-state.json is awaiting_user_review.");
  }

  const workUnit = await resolveWorkUnitForReviewCommand(options.cwd, options.unit);

  if (workflowState.currentUnitId !== undefined && workflowState.currentUnitId !== workUnit.id) {
    throw new CliError(
      `Cannot reject ${workUnit.id}; workflow is awaiting review for ${workflowState.currentUnitId}.`
    );
  }

  if (workUnit.status !== "awaiting_user_review") {
    throw new CliError(`Cannot reject ${workUnit.id}; WorkUnit status is ${workUnit.status}.`);
  }

  const stagedOutputFile = workUnit.stagedOutputFile ?? workflowState.stagedOutputFile;

  if (stagedOutputFile === undefined) {
    throw new CliError(`Cannot reject ${workUnit.id}; stagedOutputFile is missing.`);
  }

  const productionRun = await readProductionRunForWorkflowState(options.cwd, workflowState);
  const pendingUpdate = await readStagedPendingKnowledgeUpdateForUnit(
    options.cwd,
    workUnit,
    productionRun
  );
  const rejectedUpdate = rejectPendingKnowledgeUpdate(pendingUpdate, options.now);
  const pendingKnowledgeUpdateFile = await writePendingKnowledgeUpdate(options.cwd, rejectedUpdate);
  const revision = await moveStagedOutputToRejectedRevision(options, workUnit, stagedOutputFile);
  const rejectedWorkUnit = validateWorkUnit({
    ...workUnit,
    revisionDir: revision.revisionDir,
    stagedOutputFile: undefined,
    status: "rejected"
  });
  await writeWorkUnit(options.cwd, rejectedWorkUnit);

  const rejectedWorkflowState: WorkflowState = {
    blockedBy: `Rejected ${workUnit.id}: ${options.reason}`,
    currentUnit: rejectedWorkUnit.displayTitle,
    currentUnitId: rejectedWorkUnit.id,
    lastError: options.reason,
    status: "blocked",
    updatedAt: options.now
  };
  await writeJsonFile(join(options.cwd, ".storyos", "workflow-state.json"), rejectedWorkflowState);

  return {
    pendingKnowledgeUpdateFile,
    reasonFile: revision.reasonFile,
    rejectedRevisionFile: revision.revisionFile,
    revisionDir: revision.revisionDir,
    unitId: rejectedWorkUnit.id,
    workflowStatus: rejectedWorkflowState.status,
    workUnit: rejectedWorkUnit
  };
};

const formatRejectReport = (report: RejectReport): string =>
  `StoryMaker reject
WorkUnit: ${report.unitId}
WorkUnit status: ${report.workUnit.status}
Rejected revision: ${report.rejectedRevisionFile}
Revision dir: ${report.revisionDir}
Reject reason: ${report.reasonFile}
PendingKnowledgeUpdate: ${report.pendingKnowledgeUpdateFile}
WorkflowState: ${report.workflowStatus}
Next: revise the rejected unit or produce again after resolving the rejection.
`;

const readLatestRejectReason = async (
  cwd: string,
  revisionDir: string | undefined
): Promise<string> => {
  if (revisionDir === undefined || !(await directoryExists(join(cwd, revisionDir)))) {
    return "No rejection reason recorded.";
  }

  const jsonFiles = (await readdir(join(cwd, revisionDir)))
    .filter((fileName) => fileName.endsWith(".json"))
    .sort();
  const latest = jsonFiles.at(-1);

  if (latest === undefined) {
    return "No rejection reason recorded.";
  }

  const reasonRecord = await parseJsonFile(
    join(cwd, revisionDir, latest),
    `reject reason ${latest}`
  );

  if (isRecord(reasonRecord) && typeof reasonRecord.reason === "string") {
    return reasonRecord.reason;
  }

  return "No rejection reason recorded.";
};

const renderRevisedStagedOutput = (
  options: ReviseOptions,
  workUnit: WorkUnit,
  markdownTitle: string,
  rejectReason: string
): string => {
  const body = `# ${markdownTitle}

Placeholder revised draft. This file is staged for user review and is not canon.

## Revision

- Mode: ${options.mode}
- Previous rejection reason: ${rejectReason}

## Draft Placeholder

The real revision adapter has not been connected yet. This deterministic revision
proves StoryOS can preserve the rejected draft, create a new staged version, and
return the work unit to user review without committing canon facts.
`;

  return writeMarkdownWithFrontMatter(
    {
      previous_revision_dir: workUnit.revisionDir ?? "",
      revised_at: options.now,
      revision_mode: options.mode,
      status: "staged",
      title: markdownTitle,
      work_unit_id: workUnit.id
    },
    body
  );
};

export const reviseUnit = async (options: ReviseOptions): Promise<ReviseReport> => {
  if (!(await fileExists(join(options.cwd, "project.yaml")))) {
    throw new CliError("Not a StoryOS project: missing project.yaml. Run storyctl init first.");
  }

  const workflowState = await readWorkflowStateForResume(options.cwd);
  const workUnit = await resolveWorkUnitForReviewCommand(options.cwd, options.unit);

  if (workflowState.currentUnitId !== undefined && workflowState.currentUnitId !== workUnit.id) {
    throw new CliError(
      `Cannot revise ${workUnit.id}; workflow is focused on ${workflowState.currentUnitId}.`
    );
  }

  if (workUnit.status !== "rejected") {
    throw new CliError(`Cannot revise ${workUnit.id}; WorkUnit status is ${workUnit.status}.`);
  }

  const config = parseProjectYaml(await readFile(join(options.cwd, "project.yaml"), "utf8"));
  const chapterOutput = createChapterMarkdownOutputPlan({
    outputDir: config.writing.output_dir,
    outputFormat: config.writing.output_format,
    title: workUnit.filenameTitle ?? workUnit.displayTitle
  });
  const stagedOutputFile = chapterOutput.relativePath;
  const rejectReason = await readLatestRejectReason(options.cwd, workUnit.revisionDir);
  const stagedBody = renderRevisedStagedOutput(
    options,
    workUnit,
    chapterOutput.markdownTitle,
    rejectReason
  );

  await mkdir(dirname(join(options.cwd, stagedOutputFile)), {
    recursive: true
  });
  await writeFile(join(options.cwd, stagedOutputFile), stagedBody, "utf8");

  const revisionRunId = `revise-${createSafeRunIdPart(options.now)}-${createSafeRunIdPart(
    workUnit.id
  )}-${options.mode}`;
  const pendingUpdate = createPendingKnowledgeUpdate({
    createdAt: options.now,
    facts: [
      {
        content: `Revision ${options.mode} staged for ${workUnit.id}. Previous rejection reason: ${rejectReason}`,
        sourceRef: stagedOutputFile
      }
    ],
    id: `pending-${revisionRunId}`,
    sourceRunId: revisionRunId,
    unitId: workUnit.id
  });
  const pendingKnowledgeUpdateFile = await writePendingKnowledgeUpdate(options.cwd, pendingUpdate);
  const reportFile = normalizeRelativeOutputPath(join("reviews", `${revisionRunId}.md`));
  const runFile = normalizeRelativeOutputPath(join(".storyos", "runs", `${revisionRunId}.json`));
  const quality = await runDraftQualityChecks({
    cwd: options.cwd,
    now: options.now,
    reportFile,
    sourceRef: stagedOutputFile,
    sourceText: stagedBody,
    unitId: workUnit.id
  });
  const revisedWorkUnit = validateWorkUnit({
    ...workUnit,
    stagedOutputFile,
    status: "awaiting_user_review"
  });
  await writeWorkUnit(options.cwd, revisedWorkUnit);

  const revisedWorkflowState: WorkflowState = {
    currentRunId: revisionRunId,
    currentUnit: revisedWorkUnit.displayTitle,
    currentUnitId: revisedWorkUnit.id,
    stagedOutputFile,
    status: "awaiting_user_review",
    updatedAt: options.now
  };
  const report: ReviseReport = {
    mode: options.mode,
    pendingKnowledgeUpdateFile,
    quality,
    reportFile,
    runFile,
    runId: revisionRunId,
    stagedOutputFile,
    unitId: revisedWorkUnit.id,
    workflowStatus: revisedWorkflowState.status,
    workUnit: revisedWorkUnit
  };

  await mkdir(dirname(join(options.cwd, reportFile)), {
    recursive: true
  });
  await writeFile(
    join(options.cwd, reportFile),
    renderDraftSubmitReport({
      pendingKnowledgeUpdateFile,
      quality,
      reportFile,
      runFile,
      runId: revisionRunId,
      sourceFile: stagedOutputFile,
      stagedOutputFile,
      unitId: revisedWorkUnit.id,
      workflowStatus: revisedWorkflowState.status,
      workUnit: revisedWorkUnit
    }),
    "utf8"
  );
  await writeProductionRunForProduce(options.cwd, {
    endedAt: options.now,
    id: revisionRunId,
    pendingKnowledgeUpdateFile,
    quality,
    reportFile,
    stagedOutputFile,
    startedAt: options.now,
    status: "completed",
    steps: [
      {
        endedAt: options.now,
        id: "read-rejected-unit",
        name: "Read rejected unit",
        startedAt: options.now,
        status: "completed"
      },
      {
        endedAt: options.now,
        id: "write-revised-staged-output",
        name: "Write revised staged output",
        startedAt: options.now,
        status: "completed"
      },
      {
        endedAt: options.now,
        id: "prepare-pending-knowledge-update",
        name: "Prepare pending knowledge update",
        startedAt: options.now,
        status: "completed"
      },
      {
        endedAt: options.now,
        id: "run-quality-gates",
        name: "Run quality gates",
        reportFile,
        startedAt: options.now,
        status: "completed"
      },
      {
        endedAt: options.now,
        id: "update-workflow-state",
        name: "Update workflow state",
        startedAt: options.now,
        status: "completed"
      }
    ],
    unitId: revisedWorkUnit.id
  });
  await writeJsonFile(join(options.cwd, ".storyos", "workflow-state.json"), revisedWorkflowState);

  return report;
};

const formatReviseReport = (report: ReviseReport): string =>
  `StoryMaker revise
WorkUnit: ${report.unitId}
WorkUnit status: ${report.workUnit.status}
Mode: ${report.mode}
Staged output: ${report.stagedOutputFile}
PendingKnowledgeUpdate: ${report.pendingKnowledgeUpdateFile}
Report: ${report.reportFile}
ProductionRun: ${report.runFile}
WorkflowState: ${report.workflowStatus}
Next: review the revised staged output, then approve or reject it.
`;

const RENAME_FILENAME_TITLE_MAX_LENGTH = 96;

const appendFilenameSuffix = (base: string, suffix: string): string => {
  const availableLength = Math.max(1, RENAME_FILENAME_TITLE_MAX_LENGTH - suffix.length);
  const truncatedBase =
    base.length > availableLength ? base.slice(0, availableLength).trimEnd() : base;

  return `${truncatedBase}${suffix}`;
};

const createRenameOutputPlan = async (options: {
  config: ProjectConfig;
  currentOutputFile: string;
  cwd: string;
  displayTitle: string;
  existingUnits: readonly WorkUnit[];
  workUnit: WorkUnit;
}): Promise<{ filenameTitle: string; outputFile: string }> => {
  const existingFilenameTitles = new Set(
    options.existingUnits
      .filter((candidate) => candidate.id !== options.workUnit.id)
      .map((candidate) => candidate.filenameTitle)
      .filter((value): value is string => value !== undefined)
  );
  const baseFilenameTitle = sanitizeFilenameTitle(options.displayTitle);
  let attempt = 1;

  while (true) {
    const suffix =
      attempt === 1
        ? ""
        : attempt === 2
          ? `-${createSafeRunIdPart(options.workUnit.id)}`
          : `-${createSafeRunIdPart(options.workUnit.id)}-${attempt - 1}`;
    const titleCandidate = suffix
      ? appendFilenameSuffix(baseFilenameTitle, suffix)
      : baseFilenameTitle;
    const outputPlan = createChapterMarkdownOutputPlan({
      outputDir: options.config.writing.output_dir,
      outputFormat: options.config.writing.output_format,
      title: titleCandidate
    });
    const sameOutput =
      normalizeRelativeOutputPath(outputPlan.relativePath) ===
      normalizeRelativeOutputPath(options.currentOutputFile);
    const conflictsWithUnit = existingFilenameTitles.has(outputPlan.markdownTitle);
    const conflictsWithFile =
      !sameOutput && (await fileExists(join(options.cwd, outputPlan.relativePath)));

    if (!conflictsWithUnit && !conflictsWithFile) {
      return {
        filenameTitle: outputPlan.markdownTitle,
        outputFile: outputPlan.relativePath
      };
    }

    attempt += 1;
  }
};

const replaceFirstMarkdownHeading = (body: string, heading: string): string => {
  if (/^#\s+.+$/m.test(body)) {
    return body.replace(/^#\s+.+$/m, `# ${heading}`);
  }

  return `# ${heading}\n\n${body}`;
};

const rewriteChapterMarkdownTitle = async (
  cwd: string,
  outputFile: string,
  markdownTitle: string,
  workUnit: WorkUnit
): Promise<void> => {
  const filePath = join(cwd, outputFile);
  const parsed = readMarkdownWithFrontMatter(await readFile(filePath, "utf8"));

  await writeFile(
    filePath,
    writeMarkdownWithFrontMatter(
      {
        ...parsed.frontMatter,
        title: markdownTitle,
        work_unit_id: workUnit.id
      },
      replaceFirstMarkdownHeading(parsed.body, markdownTitle)
    ),
    "utf8"
  );
};

const replaceSourceReferenceValue = (
  value: unknown,
  oldOutputFile: string,
  newOutputFile: string
): { changed: boolean; value: unknown } => {
  if (value === oldOutputFile) {
    return {
      changed: true,
      value: newOutputFile
    };
  }

  if (Array.isArray(value)) {
    let changed = false;
    const nextValue = value.map((item) => {
      const result = replaceSourceReferenceValue(item, oldOutputFile, newOutputFile);
      changed ||= result.changed;
      return result.value;
    });

    return {
      changed,
      value: nextValue
    };
  }

  if (isRecord(value)) {
    let changed = false;
    const nextValue: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) {
      if (
        key === "sourceRef" ||
        key === "sourceRefs" ||
        key === "sourcePath" ||
        key === "source_path"
      ) {
        const result = replaceSourceReferenceValue(item, oldOutputFile, newOutputFile);
        changed ||= result.changed;
        nextValue[key] = result.value;
        continue;
      }

      nextValue[key] = item;
    }

    return {
      changed,
      value: nextValue
    };
  }

  return {
    changed: false,
    value
  };
};

const rewritePendingKnowledgeUpdateSourceRefs = async (
  cwd: string,
  oldOutputFile: string,
  newOutputFile: string
): Promise<void> => {
  for (const id of await listPendingKnowledgeUpdateIds(cwd)) {
    const update = await readPendingKnowledgeUpdate(cwd, id);
    let changed = false;
    const rewritePayloads = (
      payloads: PendingKnowledgeUpdate["facts"]
    ): PendingKnowledgeUpdate["facts"] =>
      payloads.map((payload) => {
        const result = replaceSourceReferenceValue(payload, oldOutputFile, newOutputFile);
        changed ||= result.changed;
        return result.value as PendingKnowledgeUpdate["facts"][number];
      });
    const rewrittenUpdate: PendingKnowledgeUpdate = {
      ...update,
      entityUpdates: rewritePayloads(update.entityUpdates),
      facts: rewritePayloads(update.facts),
      foreshadowingUpdates: rewritePayloads(update.foreshadowingUpdates),
      timelineUpdates: rewritePayloads(update.timelineUpdates)
    };

    if (changed) {
      await writePendingKnowledgeUpdate(cwd, rewrittenUpdate);
    }
  }
};

const rewriteProductionRunOutputRefs = async (
  cwd: string,
  oldOutputFile: string,
  newOutputFile: string
): Promise<void> => {
  const runsDir = join(cwd, ".storyos", "runs");

  if (!(await directoryExists(runsDir))) {
    return;
  }

  for (const fileName of await readdir(runsDir)) {
    if (!fileName.endsWith(".json")) {
      continue;
    }

    const run = validateProductionRunForResume(
      await parseJsonFile(join(runsDir, fileName), `ProductionRun ${fileName}`)
    );

    if (run.stagedOutputFile === oldOutputFile) {
      await writeProductionRunForProduce(cwd, {
        ...run,
        stagedOutputFile: newOutputFile
      });
    }
  }
};

const rewriteCommittedKnowledgeTitle = async (cwd: string, workUnit: WorkUnit): Promise<void> => {
  const committedKnowledgeFile = getCommittedKnowledgeFileForApprove(workUnit);

  if (!(await fileExists(join(cwd, committedKnowledgeFile)))) {
    return;
  }

  const title = `Knowledge Update: ${workUnit.displayTitle}`;
  const parsed = readMarkdownWithFrontMatter(
    await readFile(join(cwd, committedKnowledgeFile), "utf8")
  );

  await writeFile(
    join(cwd, committedKnowledgeFile),
    writeMarkdownWithFrontMatter(
      {
        ...parsed.frontMatter,
        title
      },
      replaceFirstMarkdownHeading(parsed.body, title)
    ),
    "utf8"
  );
};

export const renameUnitTitle = async (options: RenameOptions): Promise<RenameReport> => {
  if (!(await fileExists(join(options.cwd, "project.yaml")))) {
    throw new CliError("Not a StoryOS project: missing project.yaml. Run storyctl init first.");
  }

  const config = parseProjectYaml(await readFile(join(options.cwd, "project.yaml"), "utf8"));
  const workflowState = await readWorkflowStateForResume(options.cwd);
  const existingUnits = await readPersistedWorkUnits(options.cwd);
  const workUnit = await resolveWorkUnitForReviewCommand(options.cwd, options.unit);
  const currentOutputFile = workUnit.stagedOutputFile ?? workUnit.outputFile;

  if (currentOutputFile === undefined) {
    throw new CliError(`Cannot rename ${workUnit.id}; outputFile or stagedOutputFile is missing.`);
  }

  const displayTitle = formatWorkUnitDisplayTitle({
    index: workUnit.index,
    numberPadding: config.writing.chapter_number_padding,
    title: options.title,
    type: workUnit.type
  });
  const outputPlan = await createRenameOutputPlan({
    config,
    currentOutputFile,
    cwd: options.cwd,
    displayTitle,
    existingUnits,
    workUnit
  });
  const oldFilePath = join(options.cwd, currentOutputFile);
  const newFilePath = join(options.cwd, outputPlan.outputFile);

  if (!(await fileExists(oldFilePath))) {
    throw new CliError(`Cannot rename ${workUnit.id}; file missing: ${currentOutputFile}.`);
  }

  await mkdir(dirname(newFilePath), {
    recursive: true
  });

  if (normalizeRelativeOutputPath(currentOutputFile) !== outputPlan.outputFile) {
    await rename(oldFilePath, newFilePath);
  }

  const renamedWorkUnit = validateWorkUnit({
    ...workUnit,
    displayTitle,
    filenameTitle: outputPlan.filenameTitle,
    outputFile: workUnit.outputFile === undefined ? undefined : outputPlan.outputFile,
    stagedOutputFile: workUnit.stagedOutputFile === undefined ? undefined : outputPlan.outputFile,
    title: options.title
  });

  await rewriteChapterMarkdownTitle(
    options.cwd,
    outputPlan.outputFile,
    outputPlan.filenameTitle,
    renamedWorkUnit
  );
  await rewritePendingKnowledgeUpdateSourceRefs(
    options.cwd,
    currentOutputFile,
    outputPlan.outputFile
  );
  await rewriteProductionRunOutputRefs(options.cwd, currentOutputFile, outputPlan.outputFile);
  await rewriteCommittedKnowledgeTitle(options.cwd, renamedWorkUnit);
  await writeWorkUnit(options.cwd, renamedWorkUnit);

  const nextWorkflowState: WorkflowState = {
    ...workflowState,
    currentUnit:
      workflowState.currentUnitId === workUnit.id
        ? renamedWorkUnit.displayTitle
        : workflowState.currentUnit,
    stagedOutputFile:
      workflowState.stagedOutputFile === currentOutputFile
        ? outputPlan.outputFile
        : workflowState.stagedOutputFile,
    updatedAt: options.now
  };
  await writeJsonFile(join(options.cwd, ".storyos", "workflow-state.json"), nextWorkflowState);
  await indexStoryProject({
    cwd: options.cwd,
    rebuild: true
  });

  return {
    newOutputFile: outputPlan.outputFile,
    oldOutputFile: currentOutputFile,
    title: options.title,
    unitId: renamedWorkUnit.id,
    workflowStatus: nextWorkflowState.status,
    workUnit: renamedWorkUnit
  };
};

const formatRenameReport = (report: RenameReport): string =>
  `StoryMaker rename
WorkUnit: ${report.unitId}
WorkUnit status: ${report.workUnit.status}
Title: ${report.title}
Display title: ${report.workUnit.displayTitle}
Filename title: ${report.workUnit.filenameTitle ?? "none"}
Old output: ${report.oldOutputFile}
New output: ${report.newOutputFile}
WorkflowState: ${report.workflowStatus}
`;

const REPLAN_CHANGE_LOG_FILE = "plans/change-log.md";

const createReplanOptions = (range: ReplanRange): ReplanOption[] => [
  {
    advantages: [
      "Turns the existing promise into immediate pressure.",
      "Keeps the range focused on visible consequences instead of new lore."
    ],
    id: 1,
    readerExpectations: [
      "The next units should answer the active hook with a stronger complication.",
      "Readers should see a cost for the protagonist's current choice."
    ],
    risks: [
      "Escalation can feel repetitive if it only raises stakes numerically.",
      "Secondary character beats may need a quieter counterweight."
    ],
    summary: `Use units ${range.label} to escalate the most recent unresolved promise.`,
    title: "Escalate the active promise"
  },
  {
    advantages: [
      "Pays attention to planted material and rewards long-term readers.",
      "Creates continuity without changing the current production workflow."
    ],
    id: 2,
    readerExpectations: [
      "A previously planted clue or relationship should become newly relevant.",
      "The payoff should clarify why earlier setup mattered."
    ],
    risks: [
      "A recovered setup can read as coincidence if the causal chain is weak.",
      "Too much explanation may slow the forward motion of the range."
    ],
    summary: `Use units ${range.label} to recover an earlier setup as the next turn.`,
    title: "Recover a planted setup"
  },
  {
    advantages: [
      "Centers the plan on character agency rather than external motion.",
      "Produces a clear emotional promise for the following range."
    ],
    id: 3,
    readerExpectations: [
      "The protagonist should make a choice that cannot be cleanly undone.",
      "Readers should understand both the benefit and the cost of the choice."
    ],
    risks: [
      "A forced choice needs enough setup to avoid feeling arbitrary.",
      "If every option is painful, the range may need a visible reader reward."
    ],
    summary: `Use units ${range.label} to force a defining character choice.`,
    title: "Force a character choice"
  }
];

const formatReplanList = (label: string, items: readonly string[]): string =>
  `${label}:\n${items.map((item) => `  - ${item}`).join("\n")}`;

const formatReplanOption = (option: ReplanOption): string =>
  `Option ${option.id}: ${option.title}
Summary: ${option.summary}
${formatReplanList("Advantages", option.advantages)}
${formatReplanList("Risks", option.risks)}
${formatReplanList("Reader expectations", option.readerExpectations)}`;

const renderReplanChangeLogEntry = (report: ReplanReport, now: string): string =>
  [
    `## Replan ${report.range.label} - ${now}`,
    "",
    "Status: pending user confirmation",
    `Range: ${report.range.label}`,
    "Major direction changes are not applied automatically.",
    "User confirmation is required before applying major direction changes.",
    "",
    ...report.options.flatMap((option) => [
      `### Option ${option.id}: ${option.title}`,
      "",
      `Summary: ${option.summary}`,
      "",
      formatReplanList("Advantages", option.advantages),
      "",
      formatReplanList("Risks", option.risks),
      "",
      formatReplanList("Reader expectations", option.readerExpectations),
      ""
    ])
  ].join("\n");

export const replanProject = async (options: ReplanOptions): Promise<ReplanReport> => {
  if (!(await fileExists(join(options.cwd, "project.yaml")))) {
    throw new CliError("Not a StoryOS project: missing project.yaml. Run storyctl init first.");
  }

  const report: ReplanReport = {
    changeLogFile: REPLAN_CHANGE_LOG_FILE,
    options: createReplanOptions(options.range),
    range: options.range,
    status: "pending_user_confirmation"
  };
  const plansDir = join(options.cwd, "plans");
  const changeLogPath = join(options.cwd, "plans", "change-log.md");
  const existingChangeLog = (await fileExists(changeLogPath))
    ? await readFile(changeLogPath, "utf8")
    : "";
  const prefix = existingChangeLog.trim().length > 0 ? `${existingChangeLog.trimEnd()}\n\n` : "";

  await mkdir(plansDir, {
    recursive: true
  });
  await writeFile(
    changeLogPath,
    `${prefix}${renderReplanChangeLogEntry(report, options.now)}\n`,
    "utf8"
  );

  return report;
};

const formatReplanReport = (report: ReplanReport): string =>
  `StoryMaker replan
Range: ${report.range.label}
Status: pending user confirmation
Change log: ${report.changeLogFile}
Major direction changes require user confirmation before they are applied.

${report.options.map(formatReplanOption).join("\n\n")}
`;

const readMarkdownBodyForExport = async (cwd: string, sourcePath: string): Promise<string> => {
  const parsed = readMarkdownWithFrontMatter(await readFile(join(cwd, sourcePath), "utf8"));

  return parsed.body.trim();
};

const collectNovelExportChapters = async (
  cwd: string,
  config: ProjectConfig
): Promise<NovelExportChapter[]> => {
  const chapters: NovelExportChapter[] = [];

  for (const workUnit of await readPersistedWorkUnits(cwd)) {
    if (workUnit.type !== config.project.unit_name) {
      continue;
    }

    const sourcePath =
      workUnit.status === "final" ? workUnit.outputFile : workUnit.stagedOutputFile;

    if (sourcePath === undefined) {
      continue;
    }

    if (!(await fileExists(join(cwd, sourcePath)))) {
      if (workUnit.status === "final") {
        throw new CliError(`Cannot export ${workUnit.id}; output file is missing: ${sourcePath}.`);
      }

      continue;
    }

    chapters.push({
      id: workUnit.id,
      index: workUnit.index,
      markdown: await readMarkdownBodyForExport(cwd, sourcePath),
      sourcePath: normalizeRelativeOutputPath(sourcePath),
      status: workUnit.status === "final" ? "final" : "staged",
      title: workUnit.displayTitle
    });
  }

  return chapters;
};

export const exportStory = async (options: StoryExportOptions): Promise<StoryExportReport> => {
  const projectYamlPath = join(options.cwd, "project.yaml");

  if (!(await fileExists(projectYamlPath))) {
    throw new CliError("Not a StoryOS project: missing project.yaml. Run storyctl init first.");
  }

  const config = parseProjectYaml(await readFile(projectYamlPath, "utf8"));
  const novelExport = createNovelExport({
    chapters: await collectNovelExportChapters(options.cwd, config),
    format: options.format,
    includeStaged: options.includeStaged
  });
  const exportFile = normalizeRelativeOutputPath(join("exports", novelExport.fileName));

  await mkdir(join(options.cwd, "exports"), {
    recursive: true
  });
  await writeFile(join(options.cwd, exportFile), novelExport.content, "utf8");

  return {
    exportFile,
    fidelity: novelExport.fidelity,
    format: novelExport.format,
    includedChapters: novelExport.includedChapters,
    placeholderNote: novelExport.placeholderNote,
    skippedChapters: novelExport.skippedChapters
  };
};

const formatExportChapterLines = (chapters: StoryExportReport["includedChapters"]): string =>
  chapters.length === 0
    ? "- none"
    : chapters
        .map((chapter) => `- ${chapter.id}: ${chapter.title} (${chapter.sourcePath})`)
        .join("\n");

const formatStoryExportReport = (report: StoryExportReport): string =>
  `StoryMaker export
Format: ${report.format}
Fidelity: ${report.fidelity}
${report.placeholderNote ? `Warning: ${report.placeholderNote}\n` : ""}Output: ${report.exportFile}
Chapters exported: ${report.includedChapters.length}
Chapters skipped: ${report.skippedChapters.length}
Included:
${formatExportChapterLines(report.includedChapters)}
Skipped:
${formatExportChapterLines(report.skippedChapters)}
`;

const collectImportMarkdownFiles = async (root: string): Promise<string[]> => {
  if (!(await directoryExists(root))) {
    throw new CliError(`Import source directory does not exist: ${root}.`);
  }

  const entries = await readdir(root, {
    withFileTypes: true
  });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectImportMarkdownFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(entryPath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
};

const extractImportChapterTitle = (filePath: string, body: string): string => {
  const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();

  if (heading) {
    return heading;
  }

  return basename(filePath, extname(filePath)).trim() || "Imported Chapter";
};

const ensureImportChapterHeading = (body: string, title: string): string => {
  const normalizedBody = body.trim();

  if (/^#\s+.+$/m.test(normalizedBody)) {
    return normalizedBody;
  }

  return `# ${title}\n\n${normalizedBody}`;
};

const createImportedKnowledgeBody = (importedChapters: readonly ImportedChapter[]): string =>
  [
    "# Imported Initial Knowledge",
    "",
    "Imported canon chapters:",
    ...importedChapters.map(
      (chapter) =>
        `- ${chapter.id}: ${chapter.title} from ${chapter.sourceFile} to ${chapter.outputFile}`
    )
  ].join("\n");

export const importChapters = async (
  options: ImportChaptersOptions
): Promise<ImportChaptersReport> => {
  const projectYamlPath = join(options.cwd, "project.yaml");

  if (!(await fileExists(projectYamlPath))) {
    throw new CliError("Not a StoryOS project: missing project.yaml. Run storyctl init first.");
  }

  const sourceFiles = await collectImportMarkdownFiles(options.fromDir);

  if (sourceFiles.length === 0) {
    throw new CliError(`No Markdown chapter files found in ${options.fromDir}.`);
  }

  const config = parseProjectYaml(await readFile(projectYamlPath, "utf8"));
  const existingUnits = await readPersistedWorkUnits(options.cwd);
  const workUnits = [...existingUnits];
  const importedChapters: ImportedChapter[] = [];

  for (const sourceFile of sourceFiles) {
    const parsed = readMarkdownWithFrontMatter(await readFile(sourceFile, "utf8"));
    const title = extractImportChapterTitle(sourceFile, parsed.body);
    let workUnit = createWorkUnit({
      existingUnits: workUnits,
      index:
        Math.max(
          -1,
          ...workUnits
            .filter((unit) => unit.type === config.project.unit_name)
            .map((unit) => unit.index)
        ) + 1,
      numberPadding: config.writing.chapter_number_padding,
      status: "final",
      title,
      type: config.project.unit_name
    });
    const outputPlan = createChapterMarkdownOutputPlan({
      outputDir: config.writing.output_dir,
      outputFormat: config.writing.output_format,
      title: workUnit.filenameTitle ?? workUnit.displayTitle
    });
    const outputPath = join(options.cwd, outputPlan.relativePath);

    if (await fileExists(outputPath)) {
      throw new CliError(
        `Refusing to overwrite imported chapter output: ${outputPlan.relativePath}.`
      );
    }

    workUnit = validateWorkUnit({
      ...workUnit,
      outputFile: outputPlan.relativePath,
      status: "final"
    });
    await mkdir(dirname(outputPath), {
      recursive: true
    });
    await writeFile(
      outputPath,
      writeMarkdownWithFrontMatter(
        {
          ...parsed.frontMatter,
          imported_at: options.now,
          imported_from: normalizeRelativeOutputPath(relative(options.cwd, sourceFile)),
          status: "canon",
          title: outputPlan.markdownTitle,
          work_unit_id: workUnit.id
        },
        ensureImportChapterHeading(parsed.body, title)
      ),
      "utf8"
    );
    await writeWorkUnit(options.cwd, workUnit);
    workUnits.push(workUnit);
    importedChapters.push({
      id: workUnit.id,
      outputFile: outputPlan.relativePath,
      sourceFile: normalizeRelativeOutputPath(relative(options.cwd, sourceFile)),
      title: workUnit.displayTitle
    });
  }

  const knowledgeFile = "knowledge/imported-initial.md";

  await mkdir(join(options.cwd, "knowledge"), {
    recursive: true
  });
  await writeFile(
    join(options.cwd, knowledgeFile),
    writeMarkdownWithFrontMatter(
      {
        imported_at: options.now,
        source: "storyctl import chapters",
        status: "canon",
        title: "Imported Initial Knowledge"
      },
      createImportedKnowledgeBody(importedChapters)
    ),
    "utf8"
  );

  return {
    importedChapters,
    indexResult: await indexStoryProject({
      cwd: options.cwd,
      rebuild: true
    }),
    knowledgeFile
  };
};

const formatImportChapterLines = (chapters: readonly ImportedChapter[]): string =>
  chapters
    .map((chapter) => `- ${chapter.id}: ${chapter.title} -> ${chapter.outputFile}`)
    .join("\n");

const formatImportChaptersReport = (report: ImportChaptersReport): string =>
  `StoryMaker import chapters
Imported chapters: ${report.importedChapters.length}
Knowledge: ${report.knowledgeFile}
Index: ${report.indexResult.indexedFiles} files indexed (${report.indexResult.mode})
Chapters:
${formatImportChapterLines(report.importedChapters)}
`;

export const enableMcp = async (options: McpEnableOptions): Promise<McpEnableReport> => {
  const projectYamlPath = join(options.cwd, "project.yaml");

  if (!(await fileExists(projectYamlPath))) {
    throw new CliError("Not a StoryOS project: missing project.yaml. Run storyctl init first.");
  }

  const config = parseProjectYaml(await readFile(projectYamlPath, "utf8"));

  await writeFile(
    projectYamlPath,
    renderProjectYaml({
      ...config,
      adapters: {
        ...config.adapters,
        mcp: {
          enabled: true
        }
      }
    }),
    "utf8"
  );

  return {
    enabled: true,
    projectFile: "project.yaml"
  };
};

const formatMcpEnableReport = (report: McpEnableReport): string =>
  `StoryMaker mcp enable
Project: ${report.projectFile}
MCP enabled: ${report.enabled}
`;

const hasJsonOutputOption = (args: readonly string[]): boolean => args.includes("--json");

const stripJsonOutputOption = (args: readonly string[]): JsonOutputSelection => {
  const strippedArgs: string[] = [];
  let json = false;

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }

    strippedArgs.push(arg);
  }

  return {
    args: strippedArgs,
    json
  };
};

const nullableOutputPath = (value: string | null | undefined): string | null =>
  value === undefined || value === null || value === "none" ? null : value;

const writeJsonReport = (io: StoryctlIO, report: Record<string, unknown>): void => {
  io.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
};

const writeCommandError = (
  io: StoryctlIO,
  command: string,
  error: unknown,
  json: boolean
): void => {
  const message = error instanceof Error ? error.message : String(error);

  if (json) {
    io.stderr.write(
      `${JSON.stringify(
        {
          command,
          error: {
            message
          },
          status: "error"
        },
        null,
        2
      )}\n`
    );
    return;
  }

  io.stderr.write(`${message}\n`);
};

const createStatusJsonReport = (report: StatusReport): Record<string, unknown> => ({
  command: "status",
  currentUnitId: report.currentUnitId,
  data: report,
  nextAction: null,
  reportFile: null,
  stagedOutputFile: report.stagedOutputFile,
  status: report.workflowStatus
});

const createResumeJsonReport = (report: ResumeReport): Record<string, unknown> => ({
  command: "resume",
  currentUnitId: report.currentUnitId,
  data: report,
  nextAction: report.nextAction,
  reportFile: report.latestRun?.reportFile ?? report.failedStep?.reportFile ?? null,
  stagedOutputFile: nullableOutputPath(report.stagedOutputFile),
  status: report.workflowStatus
});

const createContextJsonReport = (report: ContextReport): Record<string, unknown> => ({
  command: "context",
  currentUnitId: report.unit,
  data: report,
  nextAction: null,
  reportFile: null,
  stagedOutputFile: null,
  status: "ok"
});

const createProduceNextJsonReport = (report: ProduceNextReport): Record<string, unknown> => ({
  acceptance: report.acceptance,
  command: "produce next",
  currentUnitId: report.workUnit.id,
  data: report,
  nextAction:
    "Placeholder fallback created. Review it, or use produce packet plus draft submit for the real daily path.",
  reportFile: report.reportFile,
  stagedOutputFile: report.stagedOutputFile,
  status: report.workUnit.status
});

const createProducePacketJsonReport = (packet: WorkPacket): Record<string, unknown> => ({
  command: "produce packet",
  currentUnitId: packet.workUnit.id,
  data: packet,
  nextAction:
    "Use data.generation.prompt as the AI writing brief. Do not commit canon until user approval.",
  reportFile: null,
  stagedOutputFile: null,
  status: "ok"
});

const createDraftSubmitJsonReport = (report: DraftSubmitReport): Record<string, unknown> => ({
  command: "draft submit",
  currentUnitId: report.unitId,
  data: report,
  nextAction: report.quality.blocksBatchContinue
    ? formatQualityBlockedNextAction(report.quality, report.reportFile)
    : "Review the staged draft, then approve or reject it.",
  qualitySummary: report.quality.authorSummary,
  reportFile: report.reportFile,
  stagedOutputFile: report.stagedOutputFile,
  status: report.workflowStatus
});

const createContinueJsonReport = (report: ContinueReport): Record<string, unknown> => ({
  acceptance: report.acceptance,
  command: "continue",
  currentUnitId: report.currentUnitId,
  data: report,
  nextAction: report.nextAction,
  reportFile: report.reportFile,
  stagedOutputFile: report.stagedOutputFile,
  status: report.status
});

const createApproveJsonReport = (report: ApproveReport): Record<string, unknown> => ({
  command: "approve",
  currentUnitId: report.unitId,
  data: report,
  nextAction:
    "Run storymaker produce packet --unit next --json, write the draft, then run storymaker draft submit when ready.",
  reportFile: null,
  stagedOutputFile: null,
  status: report.workflowStatus
});

const createRejectJsonReport = (report: RejectReport): Record<string, unknown> => ({
  command: "reject",
  currentUnitId: report.unitId,
  data: report,
  nextAction: "Revise the rejected unit or resolve the rejection before producing again.",
  reportFile: null,
  stagedOutputFile: null,
  status: report.workflowStatus
});

export const runStoryctl = async (
  argv: readonly string[],
  io: StoryctlIO = createDefaultIO(),
  options: StoryctlRunOptions = {}
): Promise<number> => {
  const [command, ...commandArgs] = argv;

  if (!command || command === "--help" || command === "-h" || command === "help") {
    io.stdout.write(HELP_TEXT);
    return 0;
  }

  if (command === "--version" || command === "-v" || command === "version") {
    io.stdout.write(`${VERSION}\n`);
    return 0;
  }

  if (command === "init") {
    try {
      const initOptions = parseInitArgs(commandArgs, options);
      await initializeProject(initOptions);
      io.stdout.write(`Initialized StoryOS project in ${initOptions.cwd}\n`);
      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      io.stderr.write(`${message}\n`);
      return 1;
    }
  }

  if (command === "adapter") {
    try {
      const adapterOptions = parseAdapterInstallArgs(commandArgs, options);
      const report =
        adapterOptions.adapter === "codex"
          ? await installCodexAdapter(adapterOptions)
          : await installClaudeAdapter(adapterOptions);
      io.stdout.write(formatAdapterInstallReport(report));
      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      io.stderr.write(`${message}\n`);
      return 1;
    }
  }

  if (command === "status") {
    const jsonRequested = hasJsonOutputOption(commandArgs);

    try {
      const outputOptions = stripJsonOutputOption(commandArgs);
      const statusOptions = parseNoArgsCommand("status", outputOptions.args, options);
      const report = await readStatus(statusOptions.cwd);
      if (outputOptions.json) {
        writeJsonReport(io, createStatusJsonReport(report));
      } else {
        io.stdout.write(formatStatusReport(report));
      }
      return 0;
    } catch (error) {
      writeCommandError(io, command, error, jsonRequested);
      return 1;
    }
  }

  if (command === "dashboard") {
    const jsonRequested = hasJsonOutputOption(commandArgs);
    let server: DashboardServerHandle | null = null;

    try {
      const outputOptions = stripJsonOutputOption(commandArgs);
      const dashboardOptions = parseDashboardArgs(outputOptions.args, options);

      if (!(await fileExists(join(dashboardOptions.cwd, "project.yaml")))) {
        throw new CliError("Not a StoryOS project: missing project.yaml. Run storyctl init first.");
      }

      const dashboard = await loadDashboardModule();
      server = await dashboard.startDashboardServer({
        cwd: dashboardOptions.cwd,
        host: dashboardOptions.host,
        port: dashboardOptions.port
      });

      if (dashboardOptions.once) {
        await server.close();
      }

      if (outputOptions.json) {
        writeJsonReport(io, {
          closed: dashboardOptions.once,
          command: "dashboard",
          host: server.host,
          port: server.port,
          project: dashboardOptions.cwd,
          status: dashboardOptions.once ? "stopped" : "serving",
          url: server.url
        });
      } else {
        io.stdout.write(formatDashboardReport(dashboardOptions, server));
      }

      if (!dashboardOptions.once) {
        await new Promise<void>(() => undefined);
      }

      return 0;
    } catch (error) {
      if (server !== null) {
        await server.close();
      }
      writeCommandError(io, command, error, jsonRequested);
      return 1;
    }
  }

  if (command === "resume") {
    const jsonRequested = hasJsonOutputOption(commandArgs);

    try {
      const outputOptions = stripJsonOutputOption(commandArgs);
      const resumeOptions = parseNoArgsCommand("resume", outputOptions.args, options);
      const report = await readResume(resumeOptions.cwd);
      if (outputOptions.json) {
        writeJsonReport(io, createResumeJsonReport(report));
      } else {
        io.stdout.write(formatResumeReport(report));
      }
      return 0;
    } catch (error) {
      writeCommandError(io, command, error, jsonRequested);
      return 1;
    }
  }

  if (command === "doctor") {
    try {
      const doctorOptions = parseDoctorArgs(commandArgs, options);
      const checks = await runDoctor(doctorOptions);
      io.stdout.write(formatDoctorReport(checks));
      return checks.some((check) => check.level === "error") ? 1 : 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      io.stderr.write(`${message}\n`);
      return 1;
    }
  }

  if (command === "index") {
    try {
      const indexOptions = parseIndexArgs(commandArgs, options);

      if (!(await fileExists(join(indexOptions.cwd, "project.yaml")))) {
        throw new CliError("Not a StoryOS project: missing project.yaml. Run storyctl init first.");
      }

      io.stdout.write(formatIndexReport(await indexStoryProject(indexOptions)));
      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      io.stderr.write(`${message}\n`);
      return 1;
    }
  }

  if (command === "search") {
    try {
      const searchOptions = parseSearchArgs(commandArgs, options);

      if (!(await fileExists(join(searchOptions.cwd, "project.yaml")))) {
        throw new CliError("Not a StoryOS project: missing project.yaml. Run storyctl init first.");
      }

      io.stdout.write(formatSearchReport(await searchStoryIndex(searchOptions)));
      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      io.stderr.write(`${message}\n`);
      return 1;
    }
  }

  if (command === "context") {
    const jsonRequested = hasJsonOutputOption(commandArgs);

    try {
      const outputOptions = stripJsonOutputOption(commandArgs);
      const contextOptions = parseContextArgs(outputOptions.args, options);
      const report = await readContext(contextOptions);
      if (outputOptions.json) {
        writeJsonReport(io, createContextJsonReport(report));
      } else {
        io.stdout.write(formatContextReport(report));
      }
      return 0;
    } catch (error) {
      writeCommandError(io, command, error, jsonRequested);
      return 1;
    }
  }

  if (command === "produce") {
    const jsonRequested = hasJsonOutputOption(commandArgs);

    try {
      const outputOptions = stripJsonOutputOption(commandArgs);
      const subcommand = outputOptions.args[0];

      if (subcommand === "packet") {
        const packetOptions = parseProducePacketArgs(outputOptions.args, options);
        const packet = await buildProduceWorkPacket(packetOptions);

        if (outputOptions.json) {
          writeJsonReport(io, createProducePacketJsonReport(packet));
        } else {
          io.stdout.write(formatProduceWorkPacket(packet));
        }

        return 0;
      }

      const produceOptions = parseProduceArgs(outputOptions.args, options);
      const report = await produceNext({
        ...produceOptions,
        onProgress: outputOptions.json
          ? undefined
          : (event) => {
              io.stdout.write(`${formatProduceProgressLine(event)}\n`);
            }
      });
      if (outputOptions.json) {
        writeJsonReport(io, createProduceNextJsonReport(report));
      } else {
        io.stdout.write(formatProduceNextReport(report));
      }
      return 0;
    } catch (error) {
      writeCommandError(io, command, error, jsonRequested);
      return 1;
    }
  }

  if (command === "draft") {
    const jsonRequested = hasJsonOutputOption(commandArgs);

    try {
      const outputOptions = stripJsonOutputOption(commandArgs);
      const draftOptions = parseDraftSubmitArgs(outputOptions.args, options);
      const report = await submitDraft(draftOptions);

      if (outputOptions.json) {
        writeJsonReport(io, createDraftSubmitJsonReport(report));
      } else {
        io.stdout.write(formatDraftSubmitReport(report));
      }

      return 0;
    } catch (error) {
      writeCommandError(io, command, error, jsonRequested);
      return 1;
    }
  }

  if (command === "continue") {
    const jsonRequested = hasJsonOutputOption(commandArgs);

    try {
      const outputOptions = stripJsonOutputOption(commandArgs);
      const continueOptions = parseNoArgsCommand("continue", outputOptions.args, options);
      const report = await continueWorkflow({
        cwd: continueOptions.cwd,
        now: options.now ?? new Date().toISOString(),
        onProgress: outputOptions.json
          ? undefined
          : (event) => {
              io.stdout.write(`${formatProduceProgressLine(event)}\n`);
            }
      });

      if (outputOptions.json) {
        writeJsonReport(io, createContinueJsonReport(report));
      } else {
        io.stdout.write(formatContinueReport(report));
      }

      return 0;
    } catch (error) {
      writeCommandError(io, command, error, jsonRequested);
      return 1;
    }
  }

  if (command === "approve") {
    const jsonRequested = hasJsonOutputOption(commandArgs);

    try {
      const outputOptions = stripJsonOutputOption(commandArgs);
      const approveOptions = parseApproveArgs(outputOptions.args, options);
      const report = await approveUnit(approveOptions);

      if (approveOptions.continueProduction) {
        const continuedReport = await produceNext({
          cwd: approveOptions.cwd,
          now: approveOptions.now,
          onProgress: outputOptions.json
            ? undefined
            : (event) => {
                io.stdout.write(`${formatProduceProgressLine(event)}\n`);
              }
        });

        if (outputOptions.json) {
          writeJsonReport(io, {
            ...createApproveJsonReport(report),
            continuedProduction: createProduceNextJsonReport(continuedReport)
          });
        } else {
          io.stdout.write(formatApproveReport(report));
          io.stdout.write("Continuing with storymaker produce next --placeholder...\n");
          io.stdout.write(formatProduceNextReport(continuedReport));
        }

        return 0;
      }

      if (outputOptions.json) {
        writeJsonReport(io, createApproveJsonReport(report));
      } else {
        io.stdout.write(formatApproveReport(report));
      }

      return 0;
    } catch (error) {
      writeCommandError(io, command, error, jsonRequested);
      return 1;
    }
  }

  if (command === "reject") {
    const jsonRequested = hasJsonOutputOption(commandArgs);

    try {
      const outputOptions = stripJsonOutputOption(commandArgs);
      const rejectOptions = parseRejectArgs(outputOptions.args, options);
      const report = await rejectUnit(rejectOptions);
      if (outputOptions.json) {
        writeJsonReport(io, createRejectJsonReport(report));
      } else {
        io.stdout.write(formatRejectReport(report));
      }
      return 0;
    } catch (error) {
      writeCommandError(io, command, error, jsonRequested);
      return 1;
    }
  }

  if (command === "revise") {
    try {
      const reviseOptions = parseReviseArgs(commandArgs, options);
      io.stdout.write(formatReviseReport(await reviseUnit(reviseOptions)));
      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      io.stderr.write(`${message}\n`);
      return 1;
    }
  }

  if (command === "rename") {
    try {
      const renameOptions = parseRenameArgs(commandArgs, options);
      io.stdout.write(formatRenameReport(await renameUnitTitle(renameOptions)));
      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      io.stderr.write(`${message}\n`);
      return 1;
    }
  }

  if (command === "replan") {
    try {
      const replanOptions = parseReplanArgs(commandArgs, options);
      io.stdout.write(formatReplanReport(await replanProject(replanOptions)));
      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      io.stderr.write(`${message}\n`);
      return 1;
    }
  }

  if (command === "export") {
    try {
      const exportOptions = parseStoryExportArgs(commandArgs, options);
      io.stdout.write(formatStoryExportReport(await exportStory(exportOptions)));
      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      io.stderr.write(`${message}\n`);
      return 1;
    }
  }

  if (command === "import") {
    try {
      const importOptions = parseImportChaptersArgs(commandArgs, options);
      io.stdout.write(formatImportChaptersReport(await importChapters(importOptions)));
      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      io.stderr.write(`${message}\n`);
      return 1;
    }
  }

  if (command === "mcp") {
    try {
      const mcpOptions = parseMcpArgs(commandArgs, options);
      io.stdout.write(formatMcpEnableReport(await enableMcp(mcpOptions)));
      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      io.stderr.write(`${message}\n`);
      return 1;
    }
  }

  io.stderr.write(`Unknown command: ${command}\n\n${HELP_TEXT}`);
  return 1;
};

export const main = async (argv: readonly string[] = process.argv.slice(2)): Promise<void> => {
  process.exitCode = await runStoryctl(argv);
};

const normalizeExecutionPath = (path: string): string => resolve(path).toLowerCase();

const isInstalledCliEntry = (path: string): boolean =>
  /[\\/]@storyos[\\/]cli[\\/]dist[\\/]index\.js$/i.test(normalizeExecutionPath(path));

const isDirectExecution =
  process.argv[1] !== undefined &&
  (normalizeExecutionPath(fileURLToPath(import.meta.url)) ===
    normalizeExecutionPath(process.argv[1]) ||
    isInstalledCliEntry(process.argv[1]));

if (isDirectExecution) {
  void main();
}
