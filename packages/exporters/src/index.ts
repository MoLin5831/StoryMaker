export const NovelExportFormatValues = ["txt", "md", "docx", "epub"] as const;

export type NovelExportFormat = (typeof NovelExportFormatValues)[number];

export type NovelExportChapterStatus = "final" | "staged" | "other";

export type NovelExportChapter = {
  id: string;
  index: number;
  markdown: string;
  sourcePath: string;
  status: NovelExportChapterStatus;
  title: string;
};

export type NovelExportChapterSummary = {
  id: string;
  sourcePath: string;
  title: string;
};

export type NovelExportOptions = {
  chapters: readonly NovelExportChapter[];
  format: NovelExportFormat;
  includeStaged?: boolean;
};

export type NovelExportResult = {
  content: string;
  extension: NovelExportFormat;
  fileName: string;
  fidelity: "placeholder" | "real";
  format: NovelExportFormat;
  includedChapters: NovelExportChapterSummary[];
  placeholderNote?: string;
  skippedChapters: NovelExportChapterSummary[];
};

export class NovelExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NovelExportError";
  }
}

export const assertNovelExportFormat = (
  value: string
): NovelExportFormat => {
  if (!NovelExportFormatValues.includes(value as NovelExportFormat)) {
    throw new NovelExportError(
      `Invalid export format: ${value}. Use one of: ${NovelExportFormatValues.join(", ")}.`
    );
  }

  return value as NovelExportFormat;
};

const validateChapter = (chapter: NovelExportChapter): NovelExportChapter => {
  if (!chapter.id.trim()) {
    throw new NovelExportError("Export chapter id is required.");
  }

  if (!Number.isInteger(chapter.index) || chapter.index < 0) {
    throw new NovelExportError("Export chapter index must be a non-negative integer.");
  }

  if (!chapter.sourcePath.trim()) {
    throw new NovelExportError("Export chapter sourcePath is required.");
  }

  if (!chapter.title.trim()) {
    throw new NovelExportError("Export chapter title is required.");
  }

  return chapter;
};

const sortChapters = (
  chapters: readonly NovelExportChapter[]
): NovelExportChapter[] =>
  chapters
    .map(validateChapter)
    .sort((left, right) => left.index - right.index || left.id.localeCompare(right.id));

const summarizeChapter = (
  chapter: NovelExportChapter
): NovelExportChapterSummary => ({
  id: chapter.id,
  sourcePath: chapter.sourcePath,
  title: chapter.title
});

const shouldIncludeChapter = (
  chapter: NovelExportChapter,
  includeStaged: boolean
): boolean => chapter.status === "final" || (includeStaged && chapter.status === "staged");

const normalizeMarkdownBody = (markdown: string): string => markdown.trim();

const stripMarkdownForText = (markdown: string): string =>
  normalizeMarkdownBody(markdown)
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`]/g, "");

const renderMarkdownExport = (chapters: readonly NovelExportChapter[]): string =>
  `${chapters.map((chapter) => normalizeMarkdownBody(chapter.markdown)).join("\n\n")}\n`;

const renderTextExport = (chapters: readonly NovelExportChapter[]): string =>
  `${chapters.map((chapter) => stripMarkdownForText(chapter.markdown)).join("\n\n")}\n`;

const renderPlaceholderPackageExport = (
  format: NovelExportFormat,
  chapters: readonly NovelExportChapter[]
): string =>
  [
    `StoryMaker ${format} export placeholder`,
    "This is not a real docx/epub package. It is a deterministic text artifact that preserves chapter order and Markdown headings for a later binary renderer.",
    "",
    renderMarkdownExport(chapters).trimEnd()
  ].join("\n");

const isPlaceholderFormat = (format: NovelExportFormat): boolean =>
  format === "docx" || format === "epub";

const getPlaceholderNote = (format: NovelExportFormat): string | undefined =>
  isPlaceholderFormat(format)
    ? `${format} export is a placeholder text artifact, not a complete ${format} file. Use md or txt for stable exports.`
    : undefined;

const renderNovelExportContent = (
  format: NovelExportFormat,
  chapters: readonly NovelExportChapter[]
): string => {
  if (format === "txt") {
    return renderTextExport(chapters);
  }

  if (format === "md") {
    return renderMarkdownExport(chapters);
  }

  return `${renderPlaceholderPackageExport(format, chapters)}\n`;
};

export const createNovelExport = (
  options: NovelExportOptions
): NovelExportResult => {
  const includeStaged = options.includeStaged ?? false;
  const sortedChapters = sortChapters(options.chapters);
  const includedChapters = sortedChapters.filter((chapter) =>
    shouldIncludeChapter(chapter, includeStaged)
  );
  const skippedChapters = sortedChapters.filter(
    (chapter) => !shouldIncludeChapter(chapter, includeStaged)
  );

  return {
    content: renderNovelExportContent(options.format, includedChapters),
    extension: options.format,
    fileName: `story-export.${options.format}`,
    fidelity: isPlaceholderFormat(options.format) ? "placeholder" : "real",
    format: options.format,
    includedChapters: includedChapters.map(summarizeChapter),
    placeholderNote: getPlaceholderNote(options.format),
    skippedChapters: skippedChapters.map(summarizeChapter)
  };
};
