import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { searchStoryIndex, type SearchStoryIndexResult } from "../../indexer/dist/index.js";
import { readWorkflowState, type WorkflowState } from "../../workflow-engine/dist/index.js";

export const StoryMcpToolNameValues = [
  "project.get_config",
  "project.get_workflow_state",
  "project.resume_workflow",
  "kb.search"
] as const;

export type StoryMcpToolName = (typeof StoryMcpToolNameValues)[number];

export type StoryMcpRequest = {
  cwd: string;
  input?: unknown;
  tool: StoryMcpToolName;
};

export type ProjectConfigSnapshot = {
  contentType: string;
  mcpEnabled: boolean;
  raw: string;
  title: string;
  workflowProfile: string;
};

export type ProjectResumeWorkflowResult = {
  currentUnit?: string;
  currentUnitId?: string;
  nextAction: string;
  stagedOutputFile?: string;
  workflowStatus: WorkflowState["status"];
};

export type StoryMcpResult =
  | {
      content: ProjectConfigSnapshot;
      tool: "project.get_config";
    }
  | {
      content: WorkflowState;
      tool: "project.get_workflow_state";
    }
  | {
      content: ProjectResumeWorkflowResult;
      tool: "project.resume_workflow";
    }
  | {
      content: SearchStoryIndexResult;
      tool: "kb.search";
    };

export class StoryMcpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoryMcpError";
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
      throw new StoryMcpError("Not a StoryMaker project: missing project.yaml.");
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

export const readProjectConfigSnapshot = async (cwd: string): Promise<ProjectConfigSnapshot> => {
  const raw = await readProjectYaml(cwd);

  return {
    contentType: readYamlStringField(raw, "content_type"),
    mcpEnabled: readMcpEnabled(raw),
    raw,
    title: readYamlStringField(raw, "title"),
    workflowProfile: readYamlStringField(raw, "workflow_profile")
  };
};

const getResumeNextAction = (state: WorkflowState): string => {
  if (state.status === "awaiting_user_review") {
    return "Review staged output, then run storyctl approve or storyctl reject.";
  }

  if (state.status === "blocked") {
    return state.lastError ?? state.blockedBy ?? "Resolve the blocking condition.";
  }

  if (state.status === "producing") {
    return "Run storyctl resume to inspect the in-progress production run.";
  }

  return "Run storyctl produce next.";
};

export const createProjectResumeWorkflowResult = (
  state: WorkflowState
): ProjectResumeWorkflowResult => ({
  currentUnit: state.currentUnit,
  currentUnitId: state.currentUnitId,
  nextAction: getResumeNextAction(state),
  stagedOutputFile: state.stagedOutputFile,
  workflowStatus: state.status
});

const parseKbSearchInput = (input: unknown): { query: string } => {
  if (
    input === null ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    typeof (input as { query?: unknown }).query !== "string" ||
    !(input as { query: string }).query.trim()
  ) {
    throw new StoryMcpError("kb.search requires input.query.");
  }

  return {
    query: (input as { query: string }).query
  };
};

export const handleStoryMcpTool = async (request: StoryMcpRequest): Promise<StoryMcpResult> => {
  if (request.tool === "project.get_config") {
    return {
      content: await readProjectConfigSnapshot(request.cwd),
      tool: request.tool
    };
  }

  if (request.tool === "project.get_workflow_state") {
    return {
      content: await readWorkflowState(request.cwd),
      tool: request.tool
    };
  }

  if (request.tool === "project.resume_workflow") {
    return {
      content: createProjectResumeWorkflowResult(await readWorkflowState(request.cwd)),
      tool: request.tool
    };
  }

  const input = parseKbSearchInput(request.input);

  return {
    content: await searchStoryIndex({
      cwd: request.cwd,
      query: input.query
    }),
    tool: request.tool
  };
};
