import { randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { URLSearchParams } from "node:url";

import { runStoryctl } from "../../../packages/cli/dist/index.js";
import {
  readKnowledgeBrowser,
  type KnowledgeBrowserEntry,
  type KnowledgeBrowserResult
} from "../../../packages/indexer/dist/index.js";
import {
  readWorkflowState,
  type WorkflowState
} from "../../../packages/workflow-engine/dist/index.js";

export type DashboardProjectSummary = {
  contentType: string;
  mcpEnabled: boolean;
  rawConfig: string;
  title: string;
  unitName: string;
  workflowProfile: string;
};

export type DashboardPendingReviewChapter = {
  contentBody: string;
  contentPreview: string;
  path: string;
  title: string;
  unitId?: string;
};

export type DashboardReviewActionName = "approve" | "reject";

export type DashboardProductionStep = {
  error?: string;
  id: string;
  name: string;
  reportPath?: string;
  status: string;
};

export type DashboardProductionRun = {
  blocker?: string;
  id: string;
  reportPath?: string;
  startedAt?: string;
  status: string;
  steps: readonly DashboardProductionStep[];
};

export type DashboardQualityIssue = {
  affectsSetting: boolean;
  gate: string;
  message: string;
  severity: string;
  snippet?: string;
  sourceRef?: string;
  suggestion?: string;
};

export type DashboardQualitySummary = {
  approvalRecommendation: string;
  approvalPrompt?: string;
  blocksBatchContinue: boolean;
  highestSeverity: string | null;
  majorIssues: readonly DashboardQualityIssue[];
  overallConclusion: string;
  pendingKnowledgeSummary: readonly string[];
  qualityGates: readonly string[];
  recommendedToApprove: boolean;
  reportPath: string;
  settingImpact: string;
  summaryText: string;
};

export type DashboardReviewAction = {
  action: DashboardReviewActionName;
  argv: readonly string[];
  command: string;
  label: string;
  requiresReason: boolean;
};

export type DashboardSnapshot = {
  knowledgeBrowser: DashboardKnowledgeBrowser;
  pendingReviewChapters: readonly DashboardPendingReviewChapter[];
  productionRun?: DashboardProductionRun;
  project: DashboardProjectSummary;
  qualitySummary?: DashboardQualitySummary;
  reviewActions: readonly DashboardReviewAction[];
  workflow: WorkflowState;
};

export type DashboardReviewActionResult = {
  argv: readonly string[];
  exitCode: number;
  stderr: string;
  stdout: string;
};

export type DashboardKnowledgeBrowser = KnowledgeBrowserResult & {
  error?: string;
};

export type ReadDashboardSnapshotOptions = {
  knowledgeQuery?: string;
};

export type RunDashboardReviewActionOptions = {
  action: DashboardReviewActionName;
  cwd: string;
  now?: string;
  reason?: string;
  unit: string;
};

export type StartDashboardServerOptions = {
  cwd: string;
  host?: string;
  port?: number;
  runner?: CliRunner;
};

export type DashboardServerHandle = {
  close: () => Promise<void>;
  host: string;
  port: number;
  server: Server;
  url: string;
};

type CliRunner = (
  argv: readonly string[],
  io: {
    stderr: { write(chunk: string): unknown };
    stdout: { write(chunk: string): unknown };
  },
  options: { cwd: string; now?: string }
) => Promise<number>;

type RenderDashboardHtmlOptions = {
  csrfToken?: string;
};

export class DashboardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DashboardError";
  }
}

const readProjectYaml = async (cwd: string): Promise<string> => {
  try {
    return await readFile(join(cwd, "project.yaml"), "utf8");
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      throw new DashboardError("Not a StoryOS project: missing project.yaml.");
    }

    throw error;
  }
};

const readYamlStringField = (text: string, field: string): string => {
  const match = new RegExp(`^\\s*${field}:\\s*"?([^"\\n]+)"?\\s*$`, "m").exec(text);

  return match?.[1]?.trim() ?? "";
};

const readMcpEnabled = (text: string): boolean =>
  /^adapters:\s*[\s\S]*?^\s{2}mcp:\s*[\s\S]*?^\s{4}enabled:\s*true\s*$/m.test(text);

export const readDashboardProjectSummary = async (
  cwd: string
): Promise<DashboardProjectSummary> => {
  const rawConfig = await readProjectYaml(cwd);

  return {
    contentType: readYamlStringField(rawConfig, "content_type"),
    mcpEnabled: readMcpEnabled(rawConfig),
    rawConfig,
    title: readYamlStringField(rawConfig, "title"),
    unitName: readYamlStringField(rawConfig, "unit_name"),
    workflowProfile: readYamlStringField(rawConfig, "workflow_profile")
  };
};

const stripFrontMatter = (text: string): string =>
  text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");

const firstMarkdownHeading = (text: string): string | undefined => {
  const match = /^#\s+(.+?)\s*$/m.exec(stripFrontMatter(text));

  return match?.[1]?.trim();
};

const previewMarkdown = (text: string): string =>
  stripFrontMatter(text)
    .replace(/^#\s+.+$/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const optionalString = (record: Record<string, unknown>, key: string): string | undefined => {
  const value = record[key];

  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const optionalBoolean = (record: Record<string, unknown>, key: string): boolean | undefined => {
  const value = record[key];

  return typeof value === "boolean" ? value : undefined;
};

const readJsonFile = async (path: string): Promise<unknown | undefined> => {
  try {
    return JSON.parse((await readFile(path, "utf8")).replace(/^\uFEFF/, ""));
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      return undefined;
    }

    throw error;
  }
};

const readOptionalTextFile = async (path: string): Promise<string | undefined> => {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      return undefined;
    }

    throw error;
  }
};

const parseQualityIssue = (value: unknown): DashboardQualityIssue | null => {
  if (!isRecord(value)) {
    return null;
  }

  const gate = optionalString(value, "gate");
  const message = optionalString(value, "message");
  const severity = optionalString(value, "severity");

  if (gate === undefined || message === undefined || severity === undefined) {
    return null;
  }

  return {
    affectsSetting: optionalBoolean(value, "affectsSetting") ?? false,
    gate,
    message,
    severity,
    snippet: optionalString(value, "snippet"),
    sourceRef: optionalString(value, "sourceRef"),
    suggestion: optionalString(value, "suggestion")
  };
};

type MarkdownQualitySections = {
  approvalPrompt?: string;
  overall?: string;
  pendingKnowledgeSummary: readonly string[];
  qualityGates: readonly string[];
};

const normalizeSectionText = (text: string | undefined): string | undefined => {
  const normalized = text?.replace(/\s+/g, " ").trim();

  return normalized ? normalized : undefined;
};

const parseBulletSection = (text: string | undefined): string[] => {
  if (text === undefined) {
    return [];
  }

  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*]\s+/, "").trim())
    .filter((line) => line.length > 0);
};

const parseMarkdownQualitySections = (text: string): MarkdownQualitySections => {
  const sections = new Map<string, string[]>();
  let currentSection: string | null = null;

  for (const line of stripFrontMatter(text).split(/\r?\n/)) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);

    if (heading !== null) {
      currentSection = heading[1].trim();
      sections.set(currentSection, []);
      continue;
    }

    if (currentSection !== null) {
      sections.get(currentSection)?.push(line);
    }
  }

  const sectionText = (name: string): string | undefined => sections.get(name)?.join("\n").trim();

  return {
    approvalPrompt: normalizeSectionText(sectionText("Final User Prompt")),
    overall: normalizeSectionText(sectionText("Overall")),
    pendingKnowledgeSummary: parseBulletSection(sectionText("Pending Knowledge Summary")),
    qualityGates: parseBulletSection(sectionText("Quality Gates"))
  };
};

const inferApprovalRecommendation = (sections: MarkdownQualitySections): string => {
  const signal = `${sections.overall ?? ""} ${sections.approvalPrompt ?? ""}`;

  if (/建议通过|approve/i.test(signal)) {
    return "approve";
  }

  if (/修订|revise|reject/i.test(signal)) {
    return "manual_review_required";
  }

  return "unknown";
};

const inferHighestSeverity = (sections: MarkdownQualitySections): string | null => {
  const text = [sections.overall, ...sections.qualityGates, ...sections.pendingKnowledgeSummary]
    .filter((value): value is string => value !== undefined)
    .join(" ");
  const severity = /\bP[0-3]\b/.exec(text);

  return severity?.[0] ?? null;
};

const markdownQualitySummary = (
  reportPath: string,
  sections: MarkdownQualitySections
): DashboardQualitySummary | undefined => {
  if (
    sections.overall === undefined &&
    sections.qualityGates.length === 0 &&
    sections.pendingKnowledgeSummary.length === 0 &&
    sections.approvalPrompt === undefined
  ) {
    return undefined;
  }

  const approvalRecommendation = inferApprovalRecommendation(sections);

  return {
    approvalPrompt: sections.approvalPrompt,
    approvalRecommendation,
    blocksBatchContinue: false,
    highestSeverity: inferHighestSeverity(sections),
    majorIssues: [],
    overallConclusion: sections.overall ?? "Quality report does not include an Overall section.",
    pendingKnowledgeSummary: sections.pendingKnowledgeSummary,
    qualityGates: sections.qualityGates,
    recommendedToApprove: approvalRecommendation === "approve",
    reportPath,
    settingImpact: "not_recorded",
    summaryText: sections.overall ?? "Quality report summary was read from Markdown."
  };
};

export const readDashboardQualitySummary = async (
  cwd: string,
  workflow: WorkflowState
): Promise<DashboardQualitySummary | undefined> => {
  if (!workflow.currentRunId) {
    return undefined;
  }

  const run = await readJsonFile(join(cwd, ".storyos", "runs", `${workflow.currentRunId}.json`));

  if (!isRecord(run)) {
    return undefined;
  }

  const quality = isRecord(run.quality) ? run.quality : undefined;
  const reportPath =
    (quality !== undefined ? optionalString(quality, "reportFile") : undefined) ??
    optionalString(run, "reportFile");
  const reportText =
    reportPath !== undefined ? await readOptionalTextFile(join(cwd, reportPath)) : undefined;
  const reportSections =
    reportText !== undefined ? parseMarkdownQualitySections(reportText) : undefined;

  if (quality === undefined) {
    return reportPath !== undefined && reportSections !== undefined
      ? markdownQualitySummary(reportPath, reportSections)
      : undefined;
  }

  const authorSummary = isRecord(quality.authorSummary) ? quality.authorSummary : undefined;

  if (authorSummary === undefined || reportPath === undefined) {
    return reportPath !== undefined && reportSections !== undefined
      ? markdownQualitySummary(reportPath, reportSections)
      : undefined;
  }

  const majorIssues = Array.isArray(authorSummary.majorIssues)
    ? authorSummary.majorIssues
        .map(parseQualityIssue)
        .filter((issue): issue is DashboardQualityIssue => issue !== null)
    : [];

  return {
    approvalRecommendation: optionalString(authorSummary, "approvalRecommendation") ?? "unknown",
    approvalPrompt: reportSections?.approvalPrompt,
    blocksBatchContinue: optionalBoolean(quality, "blocksBatchContinue") ?? false,
    highestSeverity:
      optionalString(quality, "highestSeverity") ??
      (quality.highestSeverity === null ? null : "unknown"),
    majorIssues,
    overallConclusion:
      reportSections?.overall ??
      optionalString(authorSummary, "overallConclusion") ??
      "No quality conclusion recorded.",
    pendingKnowledgeSummary: reportSections?.pendingKnowledgeSummary ?? [],
    qualityGates: reportSections?.qualityGates ?? [],
    recommendedToApprove: optionalBoolean(authorSummary, "recommendedToApprove") ?? false,
    reportPath,
    settingImpact: optionalString(authorSummary, "settingImpact") ?? "unknown",
    summaryText: optionalString(authorSummary, "summaryText") ?? "No quality summary recorded."
  };
};

export const readPendingReviewChapters = async (
  cwd: string,
  workflow: WorkflowState
): Promise<DashboardPendingReviewChapter[]> => {
  if (workflow.status !== "awaiting_user_review" || !workflow.stagedOutputFile) {
    return [];
  }

  const chapterPath = workflow.stagedOutputFile;
  const text = await readFile(join(cwd, chapterPath), "utf8");

  return [
    {
      contentBody: stripFrontMatter(text).trim(),
      contentPreview: previewMarkdown(text),
      path: chapterPath,
      title: firstMarkdownHeading(text) ?? basename(chapterPath),
      unitId: workflow.currentUnitId
    }
  ];
};

const parseProductionStep = (value: unknown): DashboardProductionStep | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = optionalString(value, "id");
  const status = optionalString(value, "status");

  if (id === undefined || status === undefined) {
    return null;
  }

  return {
    error: optionalString(value, "error"),
    id,
    name: optionalString(value, "name") ?? id,
    reportPath: optionalString(value, "reportFile"),
    status
  };
};

export const readDashboardProductionRun = async (
  cwd: string,
  workflow: WorkflowState
): Promise<DashboardProductionRun | undefined> => {
  if (!workflow.currentRunId) {
    return undefined;
  }

  const run = await readJsonFile(join(cwd, ".storyos", "runs", `${workflow.currentRunId}.json`));

  if (!isRecord(run)) {
    return undefined;
  }

  const id = optionalString(run, "id") ?? workflow.currentRunId;
  const status = optionalString(run, "status") ?? "unknown";
  const steps = Array.isArray(run.steps)
    ? run.steps
        .map(parseProductionStep)
        .filter((step): step is DashboardProductionStep => step !== null)
    : [];
  const failedStep = steps.find((step) => step.status === "failed" && step.error !== undefined);
  const workflowRecord = workflow as unknown as Record<string, unknown>;

  return {
    blocker:
      optionalString(workflowRecord, "blockedBy") ??
      optionalString(workflowRecord, "lastError") ??
      failedStep?.error,
    id,
    reportPath: optionalString(run, "reportFile"),
    startedAt: optionalString(run, "startedAt"),
    status,
    steps
  };
};

export const readDashboardKnowledgeBrowser = async (
  cwd: string,
  query = ""
): Promise<DashboardKnowledgeBrowser> => {
  try {
    return await readKnowledgeBrowser({
      cwd,
      includeRejected: true,
      includeStaged: true,
      query
    });
  } catch (error) {
    return {
      entries: [],
      error: error instanceof Error ? error.message : String(error),
      includedStatuses: ["canon", "staged", "rejected"],
      query
    };
  }
};

const unitFromWorkflow = (workflow: WorkflowState): string =>
  workflow.currentUnitId ?? workflow.currentUnit ?? "";

export const createDashboardReviewActions = (workflow: WorkflowState): DashboardReviewAction[] => {
  const unit = unitFromWorkflow(workflow);

  if (workflow.status !== "awaiting_user_review" || !unit) {
    return [];
  }

  return [
    {
      action: "approve",
      argv: ["approve", "--unit", unit],
      command: `storyctl approve --unit ${unit}`,
      label: "Approve",
      requiresReason: false
    },
    {
      action: "reject",
      argv: ["reject", "--unit", unit, "--reason", "<reason>"],
      command: `storyctl reject --unit ${unit} --reason <reason>`,
      label: "Reject",
      requiresReason: true
    }
  ];
};

export const readDashboardSnapshot = async (
  cwd: string,
  options: ReadDashboardSnapshotOptions = {}
): Promise<DashboardSnapshot> => {
  const [project, workflow] = await Promise.all([
    readDashboardProjectSummary(cwd),
    readWorkflowState(cwd)
  ]);

  return {
    knowledgeBrowser: await readDashboardKnowledgeBrowser(cwd, options.knowledgeQuery),
    pendingReviewChapters: await readPendingReviewChapters(cwd, workflow),
    productionRun: await readDashboardProductionRun(cwd, workflow),
    project,
    qualitySummary: await readDashboardQualitySummary(cwd, workflow),
    reviewActions: createDashboardReviewActions(workflow),
    workflow
  };
};

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const renderPendingReview = (chapters: readonly DashboardPendingReviewChapter[]): string => {
  if (chapters.length === 0) {
    return `<p class="empty">No pending review chapters.</p>`;
  }

  return `<ul class="chapter-list">${chapters
    .map(
      (chapter) => `<li>
        <strong>${escapeHtml(chapter.title)}</strong>
        <span>${escapeHtml(chapter.path)}</span>
        <p>${escapeHtml(chapter.contentPreview)}</p>
        <details class="chapter-body">
          <summary>Full chapter text</summary>
          <pre>${escapeHtml(chapter.contentBody)}</pre>
        </details>
      </li>`
    )
    .join("")}</ul>`;
};

const renderReviewActions = (
  actions: readonly DashboardReviewAction[],
  csrfToken?: string
): string => {
  if (actions.length === 0) {
    return `<p class="empty">No review actions available.</p>`;
  }

  const csrfInput =
    csrfToken === undefined
      ? ""
      : `<input name="csrfToken" type="hidden" value="${escapeHtml(csrfToken)}">`;

  return `<div class="actions">${actions
    .map((action) => {
      const unit = action.argv[2] ?? "";

      if (action.action === "approve") {
        return `<form method="post" action="/actions/approve">
          <input name="unit" type="hidden" value="${escapeHtml(unit)}">
          ${csrfInput}
          <button type="submit">${escapeHtml(action.label)}</button>
          <code>${escapeHtml(action.command)}</code>
        </form>`;
      }

      return `<form method="post" action="/actions/reject">
        <input name="unit" type="hidden" value="${escapeHtml(unit)}">
        ${csrfInput}
        <label>
          Reject reason
          <textarea name="reason" required rows="3"></textarea>
        </label>
        <button type="submit">${escapeHtml(action.label)}</button>
        <code>${escapeHtml(action.command)}</code>
      </form>`;
    })
    .join("")}</div>`;
};

const renderQualitySummary = (summary: DashboardQualitySummary | undefined): string => {
  if (summary === undefined) {
    return `<p class="empty">No quality report available.</p>`;
  }

  const qualityGates =
    summary.qualityGates.length === 0
      ? `<p class="empty">No quality gates recorded.</p>`
      : `<ul class="quality-list">${summary.qualityGates
          .map((gate) => `<li>${escapeHtml(gate)}</li>`)
          .join("")}</ul>`;
  const pendingKnowledge =
    summary.pendingKnowledgeSummary.length === 0
      ? `<p class="empty">No pending knowledge summary recorded.</p>`
      : `<ul class="quality-list">${summary.pendingKnowledgeSummary
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join("")}</ul>`;
  const issues =
    summary.majorIssues.length === 0
      ? `<li>No major issues.</li>`
      : summary.majorIssues
          .map(
            (issue) => `<li>
              <strong>${escapeHtml(issue.severity)}</strong>
              ${escapeHtml(issue.message)}
              <span>${escapeHtml(issue.gate)}${
                issue.affectsSetting ? " · affects setting" : ""
              }</span>
            </li>`
          )
          .join("");

  return `<div class="quality">
    <section class="quality-section">
      <h3>Overall</h3>
      <p>${escapeHtml(summary.overallConclusion)}</p>
    </section>
    <dl>
      <dt>Recommendation</dt>
      <dd>${escapeHtml(summary.approvalRecommendation)}</dd>
      <dt>Report</dt>
      <dd>${escapeHtml(summary.reportPath)}</dd>
      <dt>Highest</dt>
      <dd>${escapeHtml(summary.highestSeverity ?? "none")}</dd>
      <dt>Blocks Continue</dt>
      <dd>${summary.blocksBatchContinue ? "yes" : "no"}</dd>
      <dt>Setting</dt>
      <dd>${escapeHtml(summary.settingImpact)}</dd>
    </dl>
    ${
      summary.approvalPrompt
        ? `<section class="quality-section">
          <h3>Final User Prompt</h3>
          <p>${escapeHtml(summary.approvalPrompt)}</p>
        </section>`
        : ""
    }
    <details class="quality-section">
      <summary>Quality Gates</summary>
      ${qualityGates}
    </details>
    <details class="quality-section">
      <summary>Pending Knowledge Summary</summary>
      ${pendingKnowledge}
    </details>
    <section class="quality-section">
      <h3>Major Issues</h3>
      <ul class="quality-list">${issues}</ul>
    </section>
  </div>`;
};

const renderProductionRun = (run: DashboardProductionRun | undefined): string => {
  if (run === undefined) {
    return `<p class="empty">No active production run.</p>`;
  }

  const steps =
    run.steps.length === 0
      ? `<li>No recorded steps.</li>`
      : run.steps
          .map(
            (step) => `<li>
              <strong>${escapeHtml(step.name)}</strong>
              <span>${escapeHtml(step.id)} - ${escapeHtml(step.status)}</span>
              ${step.error ? `<p class="blocker">${escapeHtml(step.error)}</p>` : ""}
              ${step.reportPath ? `<small>${escapeHtml(step.reportPath)}</small>` : ""}
            </li>`
          )
          .join("");

  return `<div class="production-run">
    <dl>
      <dt>Run</dt>
      <dd>${escapeHtml(run.id)}</dd>
      <dt>Status</dt>
      <dd>${escapeHtml(run.status)}</dd>
      <dt>Started</dt>
      <dd>${escapeHtml(run.startedAt ?? "unknown")}</dd>
      <dt>Report</dt>
      <dd>${escapeHtml(run.reportPath ?? "none")}</dd>
    </dl>
    ${
      run.blocker
        ? `<p class="blocker"><strong>Blocker:</strong> ${escapeHtml(run.blocker)}</p>`
        : ""
    }
    <ol class="step-list">${steps}</ol>
  </div>`;
};

const knowledgeTypeLabel = (type: KnowledgeBrowserEntry["type"]): string => {
  if (type === "character") {
    return "Characters";
  }

  if (type === "place") {
    return "Places";
  }

  if (type === "timeline") {
    return "Timeline";
  }

  if (type === "foreshadowing") {
    return "Foreshadowing";
  }

  return "Facts";
};

const renderKnowledgeEntries = (entries: readonly KnowledgeBrowserEntry[]): string => {
  if (entries.length === 0) {
    return `<p class="empty">No knowledge entries found.</p>`;
  }

  const groups = new Map<KnowledgeBrowserEntry["type"], KnowledgeBrowserEntry[]>();

  for (const entry of entries) {
    groups.set(entry.type, [...(groups.get(entry.type) ?? []), entry]);
  }

  return [...groups.entries()]
    .map(
      ([type, items]) => `<section class="knowledge-group">
        <h3>${knowledgeTypeLabel(type)}</h3>
        <ul class="knowledge-list">${items
          .map(
            (entry) => `<li>
              <strong>${escapeHtml(entry.title)}</strong>
              <span class="status status-${escapeHtml(entry.status)}">${escapeHtml(
                entry.status
              )}</span>
              <p>${escapeHtml(entry.summary)}</p>
              <small>${escapeHtml(entry.sourcePath)}</small>
            </li>`
          )
          .join("")}</ul>
      </section>`
    )
    .join("");
};

const renderKnowledgeBrowser = (browser: DashboardKnowledgeBrowser): string => {
  const query = browser.query;

  return `<div class="knowledge-browser">
    <form method="get" action="/">
      <label>
        Search knowledge
        <input name="kbQuery" type="search" value="${escapeHtml(query)}">
      </label>
      <button type="submit">Search</button>
    </form>
    <p class="status-line">Statuses: ${browser.includedStatuses
      .map((status) => `<span class="status status-${status}">${status}</span>`)
      .join(" ")}</p>
    ${
      browser.error
        ? `<p class="empty">${escapeHtml(browser.error)}</p>`
        : renderKnowledgeEntries(browser.entries)
    }
  </div>`;
};

export const renderDashboardHtml = (
  snapshot: DashboardSnapshot,
  options: RenderDashboardHtmlOptions = {}
): string => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(snapshot.project.title || "StoryOS Dashboard")}</title>
  <style>
    :root {
      color: #17201b;
      background: #f7f8f4;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    body {
      margin: 0;
    }
    main {
      display: grid;
      gap: 20px;
      grid-template-columns: minmax(260px, 360px) minmax(0, 1fr);
      min-height: 100vh;
      padding: 28px;
    }
    .review-rail {
      align-content: start;
      align-self: start;
      display: grid;
      gap: 20px;
      max-height: calc(100vh - 56px);
      overflow: auto;
      position: sticky;
      top: 28px;
    }
    section {
      border: 1px solid #d7ddd2;
      border-radius: 8px;
      background: #ffffff;
      padding: 18px;
    }
    h1, h2 {
      margin: 0 0 12px;
    }
    h1 {
      font-size: 24px;
    }
    h2 {
      font-size: 16px;
    }
    dl {
      display: grid;
      gap: 8px;
      grid-template-columns: max-content 1fr;
      margin: 0;
    }
    dt {
      color: #58645d;
    }
    dd {
      margin: 0;
      font-weight: 600;
    }
    .stack {
      display: grid;
      gap: 20px;
    }
    .status {
      color: #0b6b57;
    }
    .chapter-list {
      display: grid;
      gap: 12px;
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .chapter-list li {
      border-left: 4px solid #d99a26;
      padding-left: 12px;
    }
    .chapter-list span {
      color: #58645d;
      display: block;
      font-size: 13px;
      margin-top: 2px;
    }
    .chapter-body {
      background: #f8faf8;
      border: 1px solid #d7ddd2;
      border-radius: 8px;
      margin-top: 12px;
      overflow: hidden;
    }
    .chapter-body summary {
      cursor: pointer;
      font-weight: 700;
      padding: 12px 14px;
    }
    .chapter-body pre {
      border-top: 1px solid #d7ddd2;
      font-family: ui-serif, Georgia, Cambria, "Times New Roman", serif;
      line-height: 1.7;
      margin: 0;
      max-height: 52vh;
      overflow: auto;
      padding: 14px;
      white-space: pre-wrap;
    }
    .quality {
      display: grid;
      gap: 12px;
    }
    .quality p {
      margin: 0;
    }
    .quality-section {
      border: 0;
      padding: 0;
    }
    details.quality-section {
      border-top: 1px solid #e3e8df;
      padding-top: 10px;
    }
    .quality-section summary {
      cursor: pointer;
      font-weight: 700;
    }
    .quality-section h3 {
      font-size: 14px;
      margin: 0 0 8px;
    }
    .quality-list {
      display: grid;
      gap: 10px;
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .quality-list li {
      border-left: 4px solid #7c5cff;
      padding-left: 12px;
    }
    .quality-list span {
      color: #58645d;
      display: block;
      font-size: 13px;
      margin-top: 2px;
    }
    .production-run {
      display: grid;
      gap: 12px;
    }
    .step-list {
      counter-reset: steps;
      display: grid;
      gap: 10px;
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .step-list li {
      border-left: 4px solid #2f7cba;
      padding-left: 12px;
    }
    .step-list span,
    .step-list small {
      color: #58645d;
      display: block;
      font-size: 13px;
      margin-top: 2px;
    }
    .blocker {
      color: #9b2f23;
      margin: 0;
    }
    .knowledge-browser {
      display: grid;
      gap: 12px;
    }
    .knowledge-browser input {
      border: 1px solid #bac5bd;
      border-radius: 6px;
      box-sizing: border-box;
      font: inherit;
      min-height: 36px;
      padding: 8px;
      width: 100%;
    }
    .knowledge-group {
      border: 0;
      padding: 0;
    }
    .knowledge-group h3 {
      font-size: 14px;
      margin: 0 0 8px;
    }
    .knowledge-list {
      display: grid;
      gap: 10px;
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .knowledge-list li {
      border-left: 4px solid #5c7a37;
      padding-left: 12px;
    }
    .knowledge-list p {
      margin: 6px 0;
    }
    .knowledge-list small {
      color: #58645d;
      display: block;
      font-size: 13px;
    }
    .status-line {
      color: #58645d;
      margin: 0;
    }
    .status {
      border-radius: 999px;
      display: inline-block;
      font-size: 12px;
      font-weight: 700;
      line-height: 1;
      padding: 4px 7px;
      text-transform: uppercase;
    }
    .status-canon {
      background: #e7f4ec;
      color: #17633a;
    }
    .status-staged {
      background: #fff4d8;
      color: #745200;
    }
    .status-rejected {
      background: #f9e1df;
      color: #8c261c;
    }
    .actions {
      display: grid;
      gap: 10px;
    }
    form {
      align-items: center;
      display: grid;
      gap: 10px;
      grid-template-columns: max-content minmax(0, 1fr);
    }
    label {
      color: #58645d;
      display: grid;
      gap: 6px;
      grid-column: 1 / -1;
    }
    button {
      background: #102b24;
      border: 0;
      border-radius: 6px;
      color: #ffffff;
      font: inherit;
      min-height: 36px;
      padding: 0 14px;
    }
    textarea {
      border: 1px solid #bac5bd;
      border-radius: 6px;
      box-sizing: border-box;
      font: inherit;
      min-height: 76px;
      padding: 8px;
      resize: vertical;
      width: 100%;
    }
    code {
      background: #eef2ec;
      border-radius: 6px;
      color: #2c3d34;
      padding: 8px;
      white-space: normal;
    }
    .empty {
      color: #58645d;
      margin: 0;
    }
    @media (max-width: 760px) {
      main {
        grid-template-columns: 1fr;
        padding: 16px;
      }
      .review-rail {
        max-height: none;
        overflow: visible;
        position: static;
      }
      .actions {
        grid-template-columns: 1fr;
      }
      form {
        align-items: stretch;
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <main>
    <aside class="review-rail">
      <section>
        <h1>${escapeHtml(snapshot.project.title || "Untitled StoryOS Project")}</h1>
        <dl>
          <dt>Content</dt>
          <dd>${escapeHtml(snapshot.project.contentType || "unknown")}</dd>
          <dt>Workflow</dt>
          <dd>${escapeHtml(snapshot.project.workflowProfile || "unknown")}</dd>
          <dt>Unit</dt>
          <dd>${escapeHtml(snapshot.project.unitName || "unit")}</dd>
          <dt>MCP</dt>
          <dd>${snapshot.project.mcpEnabled ? "enabled" : "disabled"}</dd>
        </dl>
      </section>
      <section id="workflow-state">
        <h2>Workflow State</h2>
        <dl>
          <dt>Status</dt>
          <dd class="status">${escapeHtml(snapshot.workflow.status)}</dd>
          <dt>Unit</dt>
          <dd>${escapeHtml(unitFromWorkflow(snapshot.workflow) || "none")}</dd>
          <dt>Updated</dt>
          <dd>${escapeHtml(snapshot.workflow.updatedAt)}</dd>
        </dl>
      </section>
      <section id="review-actions">
        <h2>Review Actions</h2>
        ${renderReviewActions(snapshot.reviewActions, options.csrfToken)}
      </section>
      <section id="quality-report">
        <h2>Quality Report</h2>
        ${renderQualitySummary(snapshot.qualitySummary)}
      </section>
    </aside>
    <div class="stack">
      <section id="pending-review">
        <h2>Pending Review</h2>
        ${renderPendingReview(snapshot.pendingReviewChapters)}
      </section>
      <section id="production-progress">
        <h2>Production Progress</h2>
        ${renderProductionRun(snapshot.productionRun)}
      </section>
      <section id="knowledge-browser">
        <h2>Knowledge Browser</h2>
        ${renderKnowledgeBrowser(snapshot.knowledgeBrowser)}
      </section>
    </div>
  </main>
</body>
</html>
`;

const sendResponse = (
  response: {
    end(chunk?: string): void;
    setHeader(name: string, value: string): void;
    statusCode: number;
  },
  statusCode: number,
  contentType: string,
  body: string
): void => {
  response.statusCode = statusCode;
  response.setHeader("content-type", contentType);
  response.end(body);
};

const getServerPort = (server: Server, requestedPort: number): number => {
  const address = server.address();

  return typeof address === "object" && address !== null ? address.port : requestedPort;
};

const readRequestBody = async (
  request: {
    on(event: "data", listener: (chunk: unknown) => void): unknown;
    on(event: "end", listener: () => void): unknown;
    on(event: "error", listener: (error: Error) => void): unknown;
  },
  maxLength = 16_384
): Promise<string> =>
  new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += String(chunk);

      if (body.length > maxLength) {
        reject(new DashboardError("Dashboard action request is too large."));
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });

const actionFromPath = (path: string): DashboardReviewActionName | null => {
  if (path === "/actions/approve") {
    return "approve";
  }

  if (path === "/actions/reject") {
    return "reject";
  }

  return null;
};

export const startDashboardServer = async (
  options: StartDashboardServerOptions
): Promise<DashboardServerHandle> => {
  const host = options.host ?? "127.0.0.1";
  const requestedPort = options.port ?? 4173;
  const csrfToken = randomBytes(32).toString("base64url");
  const server = createServer(async (request, response) => {
    const path = (request.url ?? "/").split("?")[0] ?? "/";
    const action = actionFromPath(path);

    if (request.method === "POST" && action !== null) {
      try {
        const form = new URLSearchParams(await readRequestBody(request));

        if (form.get("csrfToken") !== csrfToken) {
          sendResponse(
            response,
            403,
            "text/plain; charset=utf-8",
            "Invalid Dashboard action token.\n"
          );
          return;
        }

        const result = await runDashboardReviewAction(
          {
            action,
            cwd: options.cwd,
            reason: form.get("reason") ?? undefined,
            unit: form.get("unit") ?? ""
          },
          options.runner
        );
        sendResponse(
          response,
          result.exitCode === 0 ? 200 : 500,
          "text/plain; charset=utf-8",
          `${result.stdout}${result.stderr}`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        sendResponse(response, 400, "text/plain; charset=utf-8", `${message}\n`);
      }

      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendResponse(response, 405, "text/plain; charset=utf-8", "Method not allowed\n");
      return;
    }

    if (path === "/healthz") {
      sendResponse(response, 200, "text/plain; charset=utf-8", "ok\n");
      return;
    }

    if (path !== "/" && path !== "/index.html") {
      sendResponse(response, 404, "text/plain; charset=utf-8", "Not found\n");
      return;
    }

    try {
      const query = new URLSearchParams((request.url ?? "").split("?")[1] ?? "");
      const html = renderDashboardHtml(
        await readDashboardSnapshot(options.cwd, {
          knowledgeQuery: query.get("kbQuery") ?? ""
        }),
        {
          csrfToken
        }
      );
      sendResponse(response, 200, "text/html; charset=utf-8", html);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendResponse(response, 500, "text/plain; charset=utf-8", `${message}\n`);
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(requestedPort, host, resolve);
  });

  const port = getServerPort(server, requestedPort);

  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
    host,
    port,
    server,
    url: `http://${host}:${port}/`
  };
};

export const runDashboardReviewAction = async (
  options: RunDashboardReviewActionOptions,
  runner: CliRunner = runStoryctl
): Promise<DashboardReviewActionResult> => {
  if (!options.unit.trim()) {
    throw new DashboardError("Review action requires a unit.");
  }

  const argv =
    options.action === "approve"
      ? ["approve", "--unit", options.unit]
      : ["reject", "--unit", options.unit, "--reason", options.reason?.trim() ?? ""];

  if (options.action === "reject" && !argv[4]) {
    throw new DashboardError("Reject action requires a reason.");
  }

  let stdout = "";
  let stderr = "";
  const exitCode = await runner(
    argv,
    {
      stderr: {
        write(chunk: string): unknown {
          stderr += chunk;
          return undefined;
        }
      },
      stdout: {
        write(chunk: string): unknown {
          stdout += chunk;
          return undefined;
        }
      }
    },
    {
      cwd: options.cwd,
      now: options.now
    }
  );

  return {
    argv: ["storyctl", ...argv],
    exitCode,
    stderr,
    stdout
  };
};
