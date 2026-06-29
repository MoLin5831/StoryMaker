export const VERSION = "0.1.0";

export const CONTENT_TYPE_VALUES = [
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

export const WORKFLOW_PROFILE_VALUES = ["lite", "standard", "longform", "production"] as const;

export type ContentType = (typeof CONTENT_TYPE_VALUES)[number];
export type WorkflowProfile = (typeof WORKFLOW_PROFILE_VALUES)[number];

export const DASHBOARD_BUILD_COMMAND = "corepack pnpm build:dashboard";

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
  --force       Overwrite StoryMaker-managed template files.
  -h, --help    Show this help text.
  -v, --version Show the CLI version.

Compatibility:
  storyctl remains supported as an alias for storymaker during the StoryMaker transition.
`;
