export const CLAUDE_MD_SECTION_START = "<!-- STORYOS_CLAUDE_ADAPTER_START -->";
export const CLAUDE_MD_SECTION_END = "<!-- STORYOS_CLAUDE_ADAPTER_END -->";

export const CLAUDE_SKILL_FILE_MARKER = "<!-- STORYOS_CLAUDE_SKILL_MANAGED -->";

export interface ClaudeDailyFlowRequiredRule {
  readonly file: "CLAUDE.md" | "story-produce";
  readonly id:
    | "continue"
    | "produce_packet"
    | "draft_submit"
    | "ai_writes_draft"
    | "placeholder_fallback"
    | "approve"
    | "reject"
    | "revise"
    | "no_manual_chain";
  readonly label: string;
  readonly needle: string;
}

export const CLAUDE_DAILY_FLOW_REQUIRED_RULES: readonly ClaudeDailyFlowRequiredRule[] = [
  {
    file: "story-produce",
    id: "continue",
    label: "storymaker continue",
    needle: "storymaker continue"
  },
  {
    file: "story-produce",
    id: "produce_packet",
    label: "storymaker produce packet --unit next --json",
    needle: "storymaker produce packet --unit next --json"
  },
  {
    file: "story-produce",
    id: "draft_submit",
    label: "storymaker draft submit --unit <unit> --from <file> --title <title> --json",
    needle: "storymaker draft submit --unit <unit> --from <file> --title <title> --json"
  },
  {
    file: "story-produce",
    id: "ai_writes_draft",
    label: "Claude Code must write the real Markdown draft itself",
    needle: "Claude Code must write the real Markdown draft itself"
  },
  {
    file: "story-produce",
    id: "placeholder_fallback",
    label: "placeholder output is only a test or no-model fallback",
    needle: "Placeholder output is only a test or no-model fallback"
  },
  {
    file: "story-produce",
    id: "approve",
    label: "storymaker approve --unit <unit>",
    needle: "storymaker approve --unit <unit>"
  },
  {
    file: "story-produce",
    id: "reject",
    label: "storymaker reject --unit <unit> --reason <reason>",
    needle: "storymaker reject --unit <unit> --reason <reason>"
  },
  {
    file: "story-produce",
    id: "revise",
    label: "storymaker revise --unit <unit>",
    needle: "storymaker revise --unit <unit>"
  },
  {
    file: "CLAUDE.md",
    id: "no_manual_chain",
    label: "do not ask the user to manually invoke StoryMaker skills or commands",
    needle: "Do not ask the user to manually invoke StoryMaker skills or commands"
  }
];

export const findMissingClaudeDailyFlowRules = (
  claudeMdContent: string,
  storyProduceContent: string
): readonly ClaudeDailyFlowRequiredRule[] =>
  CLAUDE_DAILY_FLOW_REQUIRED_RULES.filter((rule) => {
    const content =
      rule.file === "CLAUDE.md" ? claudeMdContent : storyProduceContent;
    return !content.includes(rule.needle);
  });

export interface ClaudeSkillFile {
  readonly content: string;
  readonly relativePath: string;
}

const renderSkill = (
  name: string,
  description: string,
  body: string
): string => `---
name: ${name}
description: ${description}
---

${CLAUDE_SKILL_FILE_MARKER}

# ${name}

${body.trim()}
`;

export const renderClaudeMdSection = (): string => `${CLAUDE_MD_SECTION_START}
# StoryMaker Claude Code Adapter

Claude Code should operate StoryMaker for the user through the local CLI in this project.

## Startup

1. Read \`project.yaml\` to determine \`content_type\` and \`workflow_profile\`.
2. Use \`storymaker status --json\` or \`storymaker resume --json\` before choosing a workflow path.
3. Do not ask the user to manually invoke StoryMaker skills or commands.
4. Preserve user-authored notes outside this managed adapter section.

## Skills

Use the generated skills under \`.claude/skills/story-*/SKILL.md\` for StoryMaker work:

- \`story-produce\`: daily natural-language entry that generates a Work Packet, writes a real draft, submits it, and routes review decisions through StoryMaker.
- \`story-brief\`: gather project status and writing context.
- \`story-plan\`: prepare plans without committing assumptions as canon.
- \`story-review\`: guide approve, reject, revise, and rename actions.
- \`story-replan\`: prepare user-reviewed replanning notes.

## Safety Rules

1. Do not mark assumptions as canon.
2. Do not silently overwrite user settings or user-authored story files.
3. Stop after production reaches user review.
4. Prefer \`storymaker\`; \`storyctl\` remains a compatibility alias.
5. Use MCP \`story.*\` tools only when MCP is explicitly enabled.
${CLAUDE_MD_SECTION_END}
`;

export const renderClaudeMd = (): string => `${renderClaudeMdSection()}`;

export const upsertClaudeMdSection = (existing: string | undefined): string => {
  const section = renderClaudeMdSection();

  if (existing === undefined || existing.trim().length === 0) {
    return renderClaudeMd();
  }

  const start = existing.indexOf(CLAUDE_MD_SECTION_START);
  const end = existing.indexOf(CLAUDE_MD_SECTION_END);

  if (start !== -1 && end !== -1 && end > start) {
    const before = existing.slice(0, start).trimEnd();
    const after = existing.slice(end + CLAUDE_MD_SECTION_END.length).trimStart();
    const parts = [before, section.trimEnd(), after].filter(
      (part) => part.length > 0
    );

    return `${parts.join("\n\n")}\n`;
  }

  return `${existing.trimEnd()}\n\n${section}`;
};

export const renderClaudeSkillFiles = (): readonly ClaudeSkillFile[] => [
  {
    relativePath: ".claude/skills/story-produce/SKILL.md",
    content: renderSkill(
      "story-produce",
      "Daily StoryMaker entry for continuing, approving, rejecting, and revising work.",
      `
Use this skill when the user asks Claude Code to continue writing, approve a result, reject a result, or revise the current StoryMaker work unit.

Do not ask the user to manually invoke lower-level StoryMaker skills or commands.

## Continue Path

1. When the user says "continue", "继续写下一章", or similar, recover state with \`storymaker status --json\` or \`storymaker resume --json\`.
2. If a unit is already awaiting review, show the draft path, report path, and ask whether to approve. Do not start another unit.
3. If it is safe to produce, run \`storymaker produce packet --unit next --json\`.
4. Claude Code must write the real Markdown draft itself using the packet's \`data.generation.prompt\`, context, gaps, output target, and content format.
5. Save the generated Markdown draft to a temporary file, then run \`storymaker draft submit --unit <unit> --from <file> --title <title> --json\`.
6. Show the submitted draft path, report path, and approval question, then stop for user review.
7. Placeholder output is only a test or no-model fallback. \`storymaker continue\` may be used for recovery/status convenience or an explicit no-model fallback, not as the default daily writing path.

## Review Paths

1. When the user says "approve", "pass", "通过", or similar, run \`storymaker approve --unit <unit>\` for the current awaiting-review unit.
2. When the user says "reject", "revise", "打回", or gives a reason, run \`storymaker reject --unit <unit> --reason <reason>\`.
3. After rejection, run \`storymaker revise --unit <unit> --mode light|rewrite|add_hook|reduce_fluff\`, choosing the mode that best matches the user's request.
4. Never approve without explicit user confirmation.

Do not commit canon knowledge before user approval.
`
    )
  },
  {
    relativePath: ".claude/skills/story-brief/SKILL.md",
    content: renderSkill(
      "story-brief",
      "Gather a concise StoryMaker project brief through storymaker.",
      `
Use this skill when the user asks for current StoryMaker context or project progress.

## Steps

1. Run \`storymaker status --json\`.
2. Run \`storymaker resume --json\` if the workflow is active.
3. Use \`storymaker context --unit <unit> --json\` for a focused writing brief when a unit is known.
4. Use \`storymaker search <query>\` for specific canon or indexed story knowledge.

Keep assumptions separate from confirmed canon.
`
    )
  },
  {
    relativePath: ".claude/skills/story-plan/SKILL.md",
    content: renderSkill(
      "story-plan",
      "Plan StoryMaker work without silently changing canon state.",
      `
Use this skill when the user asks for a plan before producing or revising StoryMaker content.

## Steps

1. Read \`project.yaml\` and \`.storyos/workflow-state.json\`.
2. Run \`storymaker status --json\`.
3. Gather relevant context with \`storymaker context --unit <unit> --json\` or \`storymaker search <query>\`.
4. Present a short plan and wait for user confirmation before production.

Do not treat planning assumptions as canon.
`
    )
  },
  {
    relativePath: ".claude/skills/story-review/SKILL.md",
    content: renderSkill(
      "story-review",
      "Review staged StoryMaker output and route user decisions through storymaker.",
      `
Use this skill when the user is reviewing staged StoryMaker output.

## Commands

- Approve with \`storymaker approve --unit <unit>\`.
- Continue after approval only when the user asks by running \`storymaker continue\`.
- Reject with \`storymaker reject --unit <unit> --reason <reason>\`.
- Revise with \`storymaker revise --unit <unit> --mode light|rewrite|add_hook|reduce_fluff\`.
- Rename with \`storymaker rename --unit <unit> --title <title>\`.

Only approval commits staged knowledge to canon.
`
    )
  },
  {
    relativePath: ".claude/skills/story-replan/SKILL.md",
    content: renderSkill(
      "story-replan",
      "Prepare StoryMaker replanning notes for user review.",
      `
Use this skill when the user wants to reconsider upcoming StoryMaker direction.

## Steps

1. Run \`storymaker status --json\`.
2. Search or retrieve context for the affected range.
3. Offer two or three alternatives with tradeoffs.
4. Wait for user confirmation before changing project files or producing new content.

Record plans in project planning files only after the user agrees.
`
    )
  }
];
