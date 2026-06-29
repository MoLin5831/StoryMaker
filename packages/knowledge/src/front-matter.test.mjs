import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  readMarkdownWithFrontMatter,
  validateFrontMatter,
  writeMarkdownWithFrontMatter
} from "./index.ts";

describe("front matter", () => {
  it("reads UTF-8 front matter and preserves Markdown body", () => {
    const markdown = [
      "---",
      'title: "雨夜来客"',
      "chapter: 23",
      "published: false",
      'tags: ["悬疑", "伏笔"]',
      "---",
      "# 第0023章 雨夜来客",
      "",
      "雨声压住了脚步声。"
    ].join("\n");

    const result = readMarkdownWithFrontMatter(markdown);

    assert.deepEqual(result.frontMatter, {
      chapter: 23,
      published: false,
      tags: ["悬疑", "伏笔"],
      title: "雨夜来客"
    });
    assert.equal(result.body, "# 第0023章 雨夜来客\n\n雨声压住了脚步声。");
  });

  it("returns the original body when front matter is absent", () => {
    const body = "# 正文\n\n---\n这不是 front matter。";

    assert.deepEqual(readMarkdownWithFrontMatter(body), {
      body,
      frontMatter: {}
    });
  });

  it("writes stable front matter and can read it back", () => {
    const body = "# Chapter\n\nBody stays here.\n";
    const markdown = writeMarkdownWithFrontMatter(
      {
        status: "draft",
        title: "Chapter: One",
        unit: 1
      },
      body
    );

    assert.equal(
      markdown,
      '---\nstatus: "draft"\ntitle: "Chapter: One"\nunit: 1\n---\n# Chapter\n\nBody stays here.\n'
    );
    assert.deepEqual(readMarkdownWithFrontMatter(markdown), {
      body,
      frontMatter: {
        status: "draft",
        title: "Chapter: One",
        unit: 1
      }
    });
  });

  it("throws on missing closing delimiter", () => {
    assert.throws(
      () => readMarkdownWithFrontMatter("---\ntitle: Broken\n# Body"),
      /missing closing delimiter/
    );
  });

  it("throws on invalid front matter lines and values", () => {
    assert.throws(
      () => readMarkdownWithFrontMatter("---\ninvalid line\n---\nBody"),
      /Invalid front matter line/
    );
    assert.throws(
      () => validateFrontMatter({ nested: { nope: true } }),
      /Invalid front matter value/
    );
    assert.throws(
      () => validateFrontMatter({ "bad key": "value" }),
      /Invalid front matter key/
    );
  });
});
