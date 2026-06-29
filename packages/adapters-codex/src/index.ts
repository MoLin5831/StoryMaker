export const CODEX_AGENTS_SECTION_START = "<!-- STORYOS_CODEX_ADAPTER_START -->";
export const CODEX_AGENTS_SECTION_END = "<!-- STORYOS_CODEX_ADAPTER_END -->";

export interface CodexAgentsRequiredRule {
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

export const CODEX_AGENTS_REQUIRED_RULES: readonly CodexAgentsRequiredRule[] = [
  {
    id: "continue",
    label: "storymaker continue",
    needle: "storymaker continue"
  },
  {
    id: "produce_packet",
    label: "storymaker produce packet --unit next --json",
    needle: "storymaker produce packet --unit next --json"
  },
  {
    id: "draft_submit",
    label: "storymaker draft submit --unit <unit> --from <file> --title <title> --json",
    needle: "storymaker draft submit --unit <unit> --from <file> --title <title> --json"
  },
  {
    id: "ai_writes_draft",
    label: "Codex must write the real Markdown draft itself",
    needle: "Codex must write the real Markdown draft itself"
  },
  {
    id: "placeholder_fallback",
    label: "placeholder output is only a test or no-model fallback",
    needle: "Placeholder output is only a test or no-model fallback"
  },
  {
    id: "approve",
    label: "storymaker approve --unit <unit>",
    needle: "storymaker approve --unit <unit>"
  },
  {
    id: "reject",
    label: "storymaker reject --unit <unit> --reason <reason>",
    needle: "storymaker reject --unit <unit> --reason <reason>"
  },
  {
    id: "revise",
    label: "storymaker revise --unit <unit>",
    needle: "storymaker revise --unit <unit>"
  },
  {
    id: "no_manual_chain",
    label: "do not ask the user to manually run StoryMaker commands",
    needle: "Do not ask the user to manually run StoryMaker commands"
  }
];

export const findMissingCodexAgentsRules = (
  content: string
): readonly CodexAgentsRequiredRule[] =>
  CODEX_AGENTS_REQUIRED_RULES.filter((rule) => !content.includes(rule.needle));

export const renderCodexAgentsSection = (): string => `${CODEX_AGENTS_SECTION_START}
# StoryMaker Codex Adapter

Codex should operate StoryMaker for the user through the local CLI in this project.

## Startup

1. Read \`project.yaml\` to determine \`content_type\` and \`workflow_profile\`.
2. Use \`storymaker status --json\` or \`storymaker resume --json\` before choosing a workflow path.
3. Do not ask the user to manually run StoryMaker commands.
4. Preserve user-authored notes outside this managed adapter section.

## Daily Natural-Language Flow

1. When the user says "continue", "continue writing the next chapter", or similar, recover state with \`storymaker status --json\` or \`storymaker resume --json\`.
2. If a unit is already awaiting review, show the draft path, report path, and ask whether to approve. Do not start another unit.
3. If it is safe to produce, run \`storymaker produce packet --unit next --json\`.
4. Codex must write the real Markdown draft itself using the packet's \`data.generation.prompt\`, context, gaps, output target, and content format.
5. Save the generated Markdown draft to a temporary file, then run \`storymaker draft submit --unit <unit> --from <file> --title <title> --json\`.
6. Show the submitted draft path, report path, and approval question, then stop for user review.
7. Placeholder output is only a test or no-model fallback. \`storymaker continue\` may be used for recovery/status convenience or an explicit no-model fallback, not as the default daily writing path.
8. Do not silently overwrite user settings or user-authored story files.
9. Follow the current content type format instead of applying novel-only rules to every project.

## Review Actions

1. When the user says "approve", "pass", "approved", or similar, approve the current awaiting-review unit with \`storymaker approve --unit <unit>\`.
2. Do not approve content unless the user explicitly confirms approval.
3. When the user says "reject", "revise", "打回", or gives a reason, reject with \`storymaker reject --unit <unit> --reason <reason>\`.
4. After rejection, revise with \`storymaker revise --unit <unit> --mode light|rewrite|add_hook|reduce_fluff\`, choosing the mode that best matches the user's request.
5. Rename title/output paths with \`storymaker rename --unit <unit> --title <title>\` only when the user asks for a title change.

## Knowledge Rules

1. Final approval is the point where staged facts may become canon.
2. Do not mark assumptions as canon.
3. Update knowledge only through StoryMaker commands or generated pending knowledge updates.
4. Rebuild the index with \`storymaker index rebuild\` if search/index state is missing or stale.
5. \`storyctl\` remains a compatibility alias, but user-facing instructions should prefer \`storymaker\`.
${CODEX_AGENTS_SECTION_END}
`;

export const renderCodexAgentsMd = (): string => `${renderCodexAgentsSection()}`;

export const upsertCodexAgentsSection = (existing: string | undefined): string => {
  const section = renderCodexAgentsSection();

  if (existing === undefined || existing.trim().length === 0) {
    return renderCodexAgentsMd();
  }

  const start = existing.indexOf(CODEX_AGENTS_SECTION_START);
  const end = existing.indexOf(CODEX_AGENTS_SECTION_END);

  if (start !== -1 && end !== -1 && end > start) {
    const before = existing.slice(0, start).trimEnd();
    const after = existing.slice(end + CODEX_AGENTS_SECTION_END.length).trimStart();
    const parts = [before, section.trimEnd(), after].filter(
      (part) => part.length > 0
    );

    return `${parts.join("\n\n")}\n`;
  }

  return `${existing.trimEnd()}\n\n${section}`;
};
