import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertNovelExportFormat,
  createNovelExport
} from "./index.ts";

const chapters = [
  {
    id: "chapter-0002",
    index: 1,
    markdown: "# Chapter 0002\n\nSecond body.",
    sourcePath: "outputs/chapters/0002.md",
    status: "staged",
    title: "Chapter 0002"
  },
  {
    id: "chapter-0001",
    index: 0,
    markdown: "# Chapter 0001\n\nFirst body.",
    sourcePath: "outputs/chapters/0001.md",
    status: "final",
    title: "Chapter 0001"
  }
];

describe("novel export", () => {
  it("sorts chapters and exports only final chapters by default", () => {
    const result = createNovelExport({
      chapters,
      format: "md"
    });

    assert.equal(result.fileName, "story-export.md");
    assert.deepEqual(
      result.includedChapters.map((chapter) => chapter.id),
      ["chapter-0001"]
    );
    assert.deepEqual(
      result.skippedChapters.map((chapter) => chapter.id),
      ["chapter-0002"]
    );
    assert.match(result.content, /^# Chapter 0001/m);
    assert.doesNotMatch(result.content, /Chapter 0002/);
    assert.equal(result.fidelity, "real");
    assert.equal(result.placeholderNote, undefined);
  });

  it("includes staged chapters only when requested", () => {
    const result = createNovelExport({
      chapters,
      format: "md",
      includeStaged: true
    });

    assert.deepEqual(
      result.includedChapters.map((chapter) => chapter.id),
      ["chapter-0001", "chapter-0002"]
    );
    assert.match(result.content, /# Chapter 0001[\s\S]+# Chapter 0002/);
    assert.equal(result.fidelity, "real");
  });

  it("renders txt and placeholder package formats deterministically", () => {
    const txt = createNovelExport({
      chapters,
      format: "txt"
    });
    const docx = createNovelExport({
      chapters,
      format: "docx"
    });
    const epub = createNovelExport({
      chapters,
      format: "epub"
    });

    assert.doesNotMatch(txt.content, /^# Chapter/m);
    assert.match(txt.content, /^Chapter 0001/m);
    assert.equal(txt.fidelity, "real");
    assert.equal(docx.fidelity, "placeholder");
    assert.equal(epub.fidelity, "placeholder");
    assert.match(docx.content, /StoryMaker docx export placeholder/);
    assert.match(epub.content, /StoryMaker epub export placeholder/);
    assert.match(docx.placeholderNote, /not a complete docx file/);
    assert.match(epub.placeholderNote, /not a complete epub file/);
  });

  it("rejects unsupported formats", () => {
    assert.equal(assertNovelExportFormat("md"), "md");
    assert.throws(() => assertNovelExportFormat("pdf"), /Invalid export format/);
  });
});
