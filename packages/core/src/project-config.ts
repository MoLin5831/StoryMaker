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

export const UnitNameValues = [
  "chapter",
  "scene",
  "episode",
  "panel",
  "branch",
  "node",
  "quest",
  "dialogue_node"
] as const;

export type UnitName = (typeof UnitNameValues)[number];
