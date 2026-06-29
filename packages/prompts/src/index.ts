export const StoryPromptTemplateIds = [
  "story-produce",
  "story-unit-plan",
  "story-draft",
  "story-ai-polish",
  "story-review",
  "story-consistency-check",
  "story-update-kb",
  "story-replan"
] as const;

export type StoryPromptTemplateId = (typeof StoryPromptTemplateIds)[number];

export const ContentTypeValues = [
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

export type ContentType = (typeof ContentTypeValues)[number];

export const WorkflowProfileValues = [
  "lite",
  "standard",
  "longform",
  "production"
] as const;

export type WorkflowProfile = (typeof WorkflowProfileValues)[number];

export type StoryPromptTemplateSpec = {
  expectedOutputs: readonly string[];
  forbiddenActions: readonly string[];
  id: StoryPromptTemplateId;
  instructions: readonly string[];
  purpose: string;
  requiredInputs: readonly string[];
  title: string;
};

export type StoryPromptProject = {
  contentType: ContentType;
  language?: string;
  targetPlatform?: string;
  title: string;
  unitName?: string;
  workflowProfile: WorkflowProfile;
};

export type StoryPromptWorkUnit = {
  displayTitle: string;
  id: string;
  index?: number;
  outputPath?: string;
  targetWords?: number;
  type?: string;
};

export type StoryPromptContextSource = {
  path: string;
  summary: string;
  title?: string;
};

export type StoryPromptContext = {
  constraints?: readonly string[];
  gaps?: readonly string[];
  notes?: readonly string[];
  sources?: readonly StoryPromptContextSource[];
};

export type RenderStoryPromptInput = {
  context?: StoryPromptContext;
  outputTarget?: {
    draftPath?: string;
    knowledgeUpdatePath?: string;
    qualityReportPath?: string;
  };
  project: StoryPromptProject;
  templateId: StoryPromptTemplateId;
  workUnit?: StoryPromptWorkUnit;
};

const SHARED_FORBIDDEN_ACTIONS = [
  "Do not commit assumptions as canon.",
  "Do not overwrite user-authored story files.",
  "Do not approve or reject on behalf of the user.",
  "Do not continue to another unit after producing one awaiting-review unit."
] as const;

const TEMPLATE_SPECS: Record<StoryPromptTemplateId, StoryPromptTemplateSpec> = {
  "story-ai-polish": {
    expectedOutputs: [
      "Polished draft text or a concise revision plan.",
      "List of meaningful edits made.",
      "Remaining issues that require user or reviewer attention."
    ],
    forbiddenActions: [
      ...SHARED_FORBIDDEN_ACTIONS,
      "Do not change plot facts without marking them as proposed changes."
    ],
    id: "story-ai-polish",
    instructions: [
      "Improve clarity, rhythm, tension, and specificity.",
      "Preserve the approved outline, continuity facts, and point of view.",
      "Remove generic AI phrasing and replace it with scene-specific detail."
    ],
    purpose: "Improve a draft before user review without changing canon.",
    requiredInputs: [
      "Current staged draft.",
      "Project style constraints.",
      "Known continuity risks and quality-gate feedback."
    ],
    title: "AI Polish"
  },
  "story-consistency-check": {
    expectedOutputs: [
      "Continuity findings grouped by severity.",
      "Referenced source paths for each finding.",
      "Recommendation: pass, revise, or block."
    ],
    forbiddenActions: [
      ...SHARED_FORBIDDEN_ACTIONS,
      "Do not invent missing continuity facts to make the draft pass."
    ],
    id: "story-consistency-check",
    instructions: [
      "Compare the draft against retrieved canon, timeline, entity, and foreshadowing context.",
      "Flag contradictions, missing payoffs, repeated beats, and timeline drift.",
      "Separate hard blockers from suggestions."
    ],
    purpose: "Check a unit against canon and reader-promise continuity.",
    requiredInputs: [
      "Staged draft or proposed outline.",
      "Retrieved canon context.",
      "Known gaps and unresolved assumptions."
    ],
    title: "Consistency Check"
  },
  "story-draft": {
    expectedOutputs: [
      "Complete staged draft for the current unit.",
      "Short self-check covering hooks, payoffs, continuity, and style.",
      "Explicit notes for any unresolved assumptions."
    ],
    forbiddenActions: [
      ...SHARED_FORBIDDEN_ACTIONS,
      "Do not summarize where the task asks for prose."
    ],
    id: "story-draft",
    instructions: [
      "Write the unit as reader-facing story prose or the matching script format.",
      "Use retrieved context, unit plan, and project constraints as hard inputs.",
      "End with a clear review boundary and no automatic approval."
    ],
    purpose: "Draft the current StoryMaker work unit.",
    requiredInputs: [
      "Current WorkUnit.",
      "Unit plan or beat outline.",
      "Prompt-ready context sources and known gaps.",
      "Output target path."
    ],
    title: "Draft"
  },
  "story-produce": {
    expectedOutputs: [
      "Staged draft path.",
      "Quality report path.",
      "Final acceptance question for the user."
    ],
    forbiddenActions: SHARED_FORBIDDEN_ACTIONS,
    id: "story-produce",
    instructions: [
      "Coordinate planning, drafting, polish, review, and knowledge-update preparation.",
      "Show progress as each production stage completes.",
      "Stop once the unit reaches awaiting user review."
    ],
    purpose: "Run one daily production unit from context to user review.",
    requiredInputs: [
      "Project configuration.",
      "Current or next WorkUnit.",
      "Retrieved context packet.",
      "Output targets for draft and quality report."
    ],
    title: "Produce"
  },
  "story-replan": {
    expectedOutputs: [
      "Replan options with tradeoffs.",
      "Recommended next plan and affected unit range.",
      "Assumptions that need user confirmation."
    ],
    forbiddenActions: [
      ...SHARED_FORBIDDEN_ACTIONS,
      "Do not rewrite the project plan before the user accepts a replan option."
    ],
    id: "story-replan",
    instructions: [
      "Use recent output, user feedback, and canon gaps to propose direction changes.",
      "Offer a small number of concrete alternatives.",
      "Keep confirmed canon separate from proposed changes."
    ],
    purpose: "Prepare a user-reviewed replan for upcoming units.",
    requiredInputs: [
      "Affected unit range.",
      "Current plan or outline.",
      "Recent user feedback and continuity state."
    ],
    title: "Replan"
  },
  "story-review": {
    expectedOutputs: [
      "Review report with pass/revise/block recommendation.",
      "Concrete revision notes tied to draft locations.",
      "Approval readiness summary."
    ],
    forbiddenActions: [
      ...SHARED_FORBIDDEN_ACTIONS,
      "Do not approve the draft without explicit user confirmation."
    ],
    id: "story-review",
    instructions: [
      "Review for story intent, continuity, prose quality, and commercial readability.",
      "State whether the draft is ready to ask the user for approval.",
      "Keep suggestions actionable and tied to the current unit."
    ],
    purpose: "Review a staged unit before user approval.",
    requiredInputs: [
      "Staged draft.",
      "Quality-gate results.",
      "Project constraints and retrieved context."
    ],
    title: "Review"
  },
  "story-unit-plan": {
    expectedOutputs: [
      "Unit goal and emotional turn.",
      "Beat list with hook, escalation, payoff, and ending.",
      "Required context and open questions."
    ],
    forbiddenActions: [
      ...SHARED_FORBIDDEN_ACTIONS,
      "Do not treat the plan as approved canon."
    ],
    id: "story-unit-plan",
    instructions: [
      "Plan only the current unit at production-ready detail.",
      "Tie beats to retrieved context and unresolved promises.",
      "Identify what must be checked before drafting."
    ],
    purpose: "Plan the next unit before drafting.",
    requiredInputs: [
      "Project configuration.",
      "Current WorkUnit.",
      "Rolling plan or previous unit summary.",
      "Retrieved context and gaps."
    ],
    title: "Unit Plan"
  },
  "story-update-kb": {
    expectedOutputs: [
      "Pending knowledge update draft.",
      "Facts grouped as canon candidates, assumptions, and rejected ideas.",
      "Source references back to the staged draft."
    ],
    forbiddenActions: [
      ...SHARED_FORBIDDEN_ACTIONS,
      "Do not commit knowledge before user approval."
    ],
    id: "story-update-kb",
    instructions: [
      "Extract only facts supported by the staged draft.",
      "Mark uncertainty explicitly.",
      "Prepare updates for later approval-time commit."
    ],
    purpose: "Prepare knowledge-base updates from a staged unit.",
    requiredInputs: [
      "Staged draft.",
      "Existing canon context.",
      "Pending knowledge update target."
    ],
    title: "Update Knowledge Base"
  }
};

const formatList = (items: readonly string[]): string =>
  items.length === 0 ? "- none" : items.map((item) => `- ${item}`).join("\n");

const formatSources = (
  sources: readonly StoryPromptContextSource[] | undefined
): string => {
  if (sources === undefined || sources.length === 0) {
    return "- none";
  }

  return sources
    .map((source) => {
      const title = source.title === undefined ? source.path : source.title;
      return `- ${title} (${source.path}): ${source.summary}`;
    })
    .join("\n");
};

const getContentTypeRequirements = (
  contentType: ContentType
): readonly string[] => {
  if (contentType === "superlong_webnovel") {
    return [
      "Run context retrieval before planning or drafting.",
      "Open with a chapter hook that refreshes reader curiosity.",
      "Maintain reader payoff density across escalation, reveal, and ending beats.",
      "Track foreshadowing setup, reminder, and payoff promises.",
      "Prepare knowledge-base update candidates after drafting."
    ];
  }

  if (contentType === "short_story" || contentType === "novella") {
    return [
      "Protect compression, unity of effect, and scene economy.",
      "Avoid adding subplots that cannot pay off within the target length."
    ];
  }

  if (contentType === "screenplay" || contentType === "short_drama") {
    return [
      "Respect script format, scene transitions, and performable dialogue.",
      "Keep visual action clear enough for production review."
    ];
  }

  if (contentType === "comic_script") {
    return [
      "Separate panel action, dialogue, captions, and page-turn beats.",
      "Keep visual continuity explicit for later art review."
    ];
  }

  if (contentType === "interactive_story" || contentType === "game_narrative") {
    return [
      "Track player-facing choices, state changes, and branch consequences.",
      "Avoid collapsing mutually exclusive branches into one canon path."
    ];
  }

  return [
    "Keep the unit aligned with project genre, platform, and target reader promises."
  ];
};

const getWorkflowProfileRequirements = (
  workflowProfile: WorkflowProfile
): readonly string[] => {
  if (workflowProfile === "production") {
    return [
      "Use the full production workflow: plan, draft, polish, review, consistency check, and knowledge update preparation.",
      "Record blockers and quality concerns for the user-facing report.",
      "Stop for user acceptance after one unit."
    ];
  }

  if (workflowProfile === "longform") {
    return [
      "Prioritize continuity, rolling plan fit, and cross-unit promises.",
      "Prefer explicit context references over broad memory."
    ];
  }

  if (workflowProfile === "standard") {
    return [
      "Balance speed with continuity checks and concise review notes."
    ];
  }

  return [
    "Keep output lightweight and avoid optional deep-analysis sections unless needed."
  ];
};

export const listStoryPromptTemplates = (): readonly StoryPromptTemplateSpec[] =>
  StoryPromptTemplateIds.map((id) => TEMPLATE_SPECS[id]);

export const getStoryPromptTemplate = (
  id: StoryPromptTemplateId
): StoryPromptTemplateSpec => TEMPLATE_SPECS[id];

export const renderStoryPrompt = (
  input: RenderStoryPromptInput
): string => {
  const spec = getStoryPromptTemplate(input.templateId);
  const project = input.project;
  const workUnit = input.workUnit;
  const context = input.context ?? {};
  const outputTarget = input.outputTarget ?? {};

  return [
    `# StoryMaker Prompt: ${spec.id}`,
    "",
    `Purpose: ${spec.purpose}`,
    "",
    "## Project",
    `- Title: ${project.title}`,
    `- Content type: ${project.contentType}`,
    `- Workflow profile: ${project.workflowProfile}`,
    `- Language: ${project.language ?? "unspecified"}`,
    `- Target platform: ${project.targetPlatform ?? "unspecified"}`,
    `- Unit name: ${project.unitName ?? "unit"}`,
    "",
    "## WorkUnit",
    `- ID: ${workUnit?.id ?? "next"}`,
    `- Title: ${workUnit?.displayTitle ?? "next unit"}`,
    `- Type: ${workUnit?.type ?? project.unitName ?? "unit"}`,
    `- Target words: ${workUnit?.targetWords ?? "unspecified"}`,
    `- Output path: ${workUnit?.outputPath ?? outputTarget.draftPath ?? "unspecified"}`,
    "",
    "## Required Inputs",
    formatList(spec.requiredInputs),
    "",
    "## Expected Outputs",
    formatList(spec.expectedOutputs),
    "",
    "## Forbidden Actions",
    formatList(spec.forbiddenActions),
    "",
    "## Adaptive Requirements",
    "### Content Type",
    formatList(getContentTypeRequirements(project.contentType)),
    "",
    "### Workflow Profile",
    formatList(getWorkflowProfileRequirements(project.workflowProfile)),
    "",
    "## Context Sources",
    formatSources(context.sources),
    "",
    "## Known Gaps",
    formatList(context.gaps ?? []),
    "",
    "## Additional Constraints",
    formatList(context.constraints ?? []),
    "",
    "## Notes",
    formatList(context.notes ?? []),
    "",
    "## Output Targets",
    `- Draft: ${outputTarget.draftPath ?? workUnit?.outputPath ?? "unspecified"}`,
    `- Quality report: ${outputTarget.qualityReportPath ?? "unspecified"}`,
    `- Knowledge update: ${outputTarget.knowledgeUpdatePath ?? "unspecified"}`,
    "",
    "## Instructions",
    formatList(spec.instructions)
  ].join("\n");
};
