import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { indexStoryProject } from "../../indexer/src/index.ts";
import { handleStoryMcpTool, readProjectConfigSnapshot } from "./index.ts";

const createTempDir = async () => mkdtemp(join(tmpdir(), "storyos-mcp-"));

const writeProject = async (cwd, mcpEnabled = false) => {
  await mkdir(join(cwd, ".storyos"), {
    recursive: true
  });
  await writeFile(
    join(cwd, "project.yaml"),
    `project:
  title: "MCP Sample"
  content_type: "superlong_webnovel"
  workflow_profile: "production"
adapters:
  mcp:
    enabled: ${mcpEnabled}
`,
    "utf8"
  );
  await writeFile(
    join(cwd, ".storyos", "workflow-state.json"),
    `${JSON.stringify(
      {
        currentUnitId: "chapter-0001",
        stagedOutputFile: "outputs/chapters/0001.md",
        status: "awaiting_user_review",
        updatedAt: "2026-06-28T00:00:00.000Z"
      },
      null,
      2
    )}\n`,
    "utf8"
  );
};

describe("StoryOS MCP handlers", () => {
  it("reads project config without enabling MCP by default", async () => {
    const cwd = await createTempDir();

    try {
      await writeProject(cwd);

      const snapshot = await readProjectConfigSnapshot(cwd);

      assert.equal(snapshot.title, "MCP Sample");
      assert.equal(snapshot.contentType, "superlong_webnovel");
      assert.equal(snapshot.workflowProfile, "production");
      assert.equal(snapshot.mcpEnabled, false);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("handles workflow resume and knowledge search consistently", async () => {
    const cwd = await createTempDir();

    try {
      await writeProject(cwd, true);
      await mkdir(join(cwd, "knowledge"), {
        recursive: true
      });
      await writeFile(
        join(cwd, "knowledge", "canon.md"),
        '---\nstatus: "canon"\n---\n# Canon Note\n\nred door secret\n',
        "utf8"
      );
      await indexStoryProject({
        cwd,
        rebuild: true
      });

      const config = await handleStoryMcpTool({
        cwd,
        tool: "project.get_config"
      });
      const workflow = await handleStoryMcpTool({
        cwd,
        tool: "project.get_workflow_state"
      });
      const resume = await handleStoryMcpTool({
        cwd,
        tool: "project.resume_workflow"
      });
      const search = await handleStoryMcpTool({
        cwd,
        input: {
          query: "red door"
        },
        tool: "kb.search"
      });

      assert.equal(config.content.mcpEnabled, true);
      assert.equal(workflow.content.status, "awaiting_user_review");
      assert.match(resume.content.nextAction, /approve or storyctl reject/);
      assert.equal(search.content.results[0].title, "Canon Note");
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("validates kb.search input", async () => {
    const cwd = await createTempDir();

    try {
      await writeProject(cwd);

      await assert.rejects(
        () =>
          handleStoryMcpTool({
            cwd,
            input: {},
            tool: "kb.search"
          }),
        /kb\.search requires input\.query/
      );
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });
});
