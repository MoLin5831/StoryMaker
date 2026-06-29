import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import {
  HELP_TEXT,
  VERSION,
  createChapterMarkdownOutputPlan,
  formatFinalAcceptanceSummary,
  formatProduceProgressLine,
  runStoryctl,
  type StoryctlIO
} from "./index.js";

const createCapture = () => {
  const output = {
    stderr: "",
    stdout: ""
  };

  const io: StoryctlIO = {
    stderr: {
      write: (chunk) => {
        output.stderr += chunk;
      }
    },
    stdout: {
      write: (chunk) => {
        output.stdout += chunk;
      }
    }
  };

  return {
    io,
    output
  };
};

const createTempDir = async (): Promise<string> => mkdtemp(join(tmpdir(), "storyos-init-"));

const createPathStressTempDir = async (): Promise<string> =>
  mkdtemp(join(tmpdir(), "storyos Windows 路径 "));

const pathExists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const parseJsonOutput = (stdout: string): Record<string, unknown> =>
  JSON.parse(stdout) as Record<string, unknown>;

const runInit = async (cwd: string, extraArgs: string[] = []) => {
  const capture = createCapture();
  const exitCode = await runStoryctl(
    ["init", "--type", "superlong_webnovel", "--profile", "production", ...extraArgs],
    capture.io,
    {
      cwd,
      now: "2026-06-28T00:00:00.000Z"
    }
  );

  return {
    capture,
    exitCode
  };
};

const runDoctor = async (cwd: string, extraArgs: string[] = []) => {
  const capture = createCapture();
  const exitCode = await runStoryctl(["doctor", ...extraArgs], capture.io, {
    cwd,
    now: "2026-06-28T00:00:00.000Z"
  });

  return {
    capture,
    exitCode
  };
};

const runAdapterInstall = async (
  cwd: string,
  adapter: "codex" | "claude-code" = "codex",
  extraArgs: string[] = []
) => {
  const capture = createCapture();
  const exitCode = await runStoryctl(
    ["adapter", "install", adapter, "--cli-only", ...extraArgs],
    capture.io,
    {
      cwd,
      now: "2026-06-28T00:00:00.000Z"
    }
  );

  return {
    capture,
    exitCode
  };
};

const runStatus = async (cwd: string, extraArgs: string[] = []) => {
  const capture = createCapture();
  const exitCode = await runStoryctl(["status", ...extraArgs], capture.io, {
    cwd,
    now: "2026-06-28T00:00:00.000Z"
  });

  return {
    capture,
    exitCode
  };
};

const runDashboard = async (cwd: string, extraArgs: string[] = []) => {
  const capture = createCapture();
  const exitCode = await runStoryctl(["dashboard", ...extraArgs], capture.io, {
    cwd,
    now: "2026-06-28T00:00:00.000Z"
  });

  return {
    capture,
    exitCode
  };
};

const runResume = async (cwd: string, extraArgs: string[] = []) => {
  const capture = createCapture();
  const exitCode = await runStoryctl(["resume", ...extraArgs], capture.io, {
    cwd,
    now: "2026-06-28T00:00:00.000Z"
  });

  return {
    capture,
    exitCode
  };
};

const runIndex = async (cwd: string, extraArgs: string[] = []) => {
  const capture = createCapture();
  const exitCode = await runStoryctl(["index", ...extraArgs], capture.io, {
    cwd,
    now: "2026-06-28T00:00:00.000Z"
  });

  return {
    capture,
    exitCode
  };
};

const runSearch = async (cwd: string, query: string, extraArgs: string[] = []) => {
  const capture = createCapture();
  const exitCode = await runStoryctl(["search", ...extraArgs, query], capture.io, {
    cwd,
    now: "2026-06-28T00:00:00.000Z"
  });

  return {
    capture,
    exitCode
  };
};

const runContext = async (cwd: string, extraArgs: string[] = ["--unit", "1"]) => {
  const capture = createCapture();
  const exitCode = await runStoryctl(["context", ...extraArgs], capture.io, {
    cwd,
    now: "2026-06-28T00:00:00.000Z"
  });

  return {
    capture,
    exitCode
  };
};

const runProduceNext = async (cwd: string, extraArgs: string[] = []) => {
  const capture = createCapture();
  const exitCode = await runStoryctl(
    ["produce", "next", "--placeholder", ...extraArgs],
    capture.io,
    {
      cwd,
      now: "2026-06-28T00:00:00.000Z"
    }
  );

  return {
    capture,
    exitCode
  };
};

const runProduceNextWithoutPlaceholder = async (cwd: string) => {
  const capture = createCapture();
  const exitCode = await runStoryctl(["produce", "next"], capture.io, {
    cwd,
    now: "2026-06-28T00:00:00.000Z"
  });

  return {
    capture,
    exitCode
  };
};

const runProducePacket = async (cwd: string, extraArgs: string[] = []) => {
  const capture = createCapture();
  const exitCode = await runStoryctl(["produce", "packet", ...extraArgs], capture.io, {
    cwd,
    now: "2026-06-28T00:00:00.000Z"
  });

  return {
    capture,
    exitCode
  };
};

const runDraftSubmit = async (cwd: string, extraArgs: string[] = []) => {
  const capture = createCapture();
  const exitCode = await runStoryctl(["draft", "submit", ...extraArgs], capture.io, {
    cwd,
    now: "2026-06-28T00:00:00.000Z"
  });

  return {
    capture,
    exitCode
  };
};

const runContinue = async (cwd: string, extraArgs: string[] = []) => {
  const capture = createCapture();
  const exitCode = await runStoryctl(["continue", ...extraArgs], capture.io, {
    cwd,
    now: "2026-06-28T00:00:00.000Z"
  });

  return {
    capture,
    exitCode
  };
};

const runApprove = async (cwd: string, extraArgs: string[] = ["--unit", "1"]) => {
  const capture = createCapture();
  const exitCode = await runStoryctl(["approve", ...extraArgs], capture.io, {
    cwd,
    now: "2026-06-28T00:00:00.000Z"
  });

  return {
    capture,
    exitCode
  };
};

const runReject = async (
  cwd: string,
  extraArgs: string[] = ["--unit", "1", "--reason", "too slow"]
) => {
  const capture = createCapture();
  const exitCode = await runStoryctl(["reject", ...extraArgs], capture.io, {
    cwd,
    now: "2026-06-28T00:00:00.000Z"
  });

  return {
    capture,
    exitCode
  };
};

const runRevise = async (cwd: string, extraArgs: string[] = ["--unit", "1", "--mode", "light"]) => {
  const capture = createCapture();
  const exitCode = await runStoryctl(["revise", ...extraArgs], capture.io, {
    cwd,
    now: "2026-06-28T00:00:00.000Z"
  });

  return {
    capture,
    exitCode
  };
};

const runRename = async (
  cwd: string,
  extraArgs: string[] = ["--unit", "1", "--title", "Rain Hook"]
) => {
  const capture = createCapture();
  const exitCode = await runStoryctl(["rename", ...extraArgs], capture.io, {
    cwd,
    now: "2026-06-28T00:00:00.000Z"
  });

  return {
    capture,
    exitCode
  };
};

const runReplan = async (cwd: string, extraArgs: string[] = ["--range", "21-30"]) => {
  const capture = createCapture();
  const exitCode = await runStoryctl(["replan", ...extraArgs], capture.io, {
    cwd,
    now: "2026-06-28T00:00:00.000Z"
  });

  return {
    capture,
    exitCode
  };
};

const runExport = async (cwd: string, extraArgs: string[] = ["--format", "md"]) => {
  const capture = createCapture();
  const exitCode = await runStoryctl(["export", ...extraArgs], capture.io, {
    cwd,
    now: "2026-06-28T00:00:00.000Z"
  });

  return {
    capture,
    exitCode
  };
};

const runImportChapters = async (cwd: string, extraArgs: string[]) => {
  const capture = createCapture();
  const exitCode = await runStoryctl(["import", "chapters", ...extraArgs], capture.io, {
    cwd,
    now: "2026-06-28T00:00:00.000Z"
  });

  return {
    capture,
    exitCode
  };
};

const runMcp = async (cwd: string, extraArgs: string[] = ["enable"]) => {
  const capture = createCapture();
  const exitCode = await runStoryctl(["mcp", ...extraArgs], capture.io, {
    cwd,
    now: "2026-06-28T00:00:00.000Z"
  });

  return {
    capture,
    exitCode
  };
};

const readStoryDatabaseVersion = (cwd: string): number => {
  const database = new DatabaseSync(join(cwd, ".storyos", "story.db"));

  try {
    const row = database
      .prepare("SELECT value FROM storyos_meta WHERE key = 'schema_version'")
      .get() as { value?: unknown } | undefined;

    return Number(row?.value ?? 0);
  } finally {
    database.close();
  }
};

const readIndexedFacts = (cwd: string): Array<{ source_path: string; status: string }> => {
  const database = new DatabaseSync(join(cwd, ".storyos", "story.db"));

  try {
    return (
      database
        .prepare(
          "SELECT source_path, status FROM facts WHERE id LIKE 'markdown:%' ORDER BY source_path"
        )
        .all() as Array<{ source_path: string; status: string }>
    ).map((row) => ({
      source_path: row.source_path,
      status: row.status
    }));
  } finally {
    database.close();
  }
};

const writeIndexedMarkdown = async (
  cwd: string,
  relativePath: string,
  status: string,
  body: string
): Promise<void> => {
  const filePath = join(cwd, relativePath);
  const directory = filePath.slice(0, filePath.lastIndexOf("\\"));

  await mkdir(directory, {
    recursive: true
  });
  await writeFile(filePath, `---\nstatus: "${status}"\n---\n${body}`, "utf8");
};

describe("runStoryctl", () => {
  it("prints help", async () => {
    const capture = createCapture();

    const exitCode = await runStoryctl(["--help"], capture.io);

    assert.equal(exitCode, 0);
    assert.equal(capture.output.stderr, "");
    assert.equal(capture.output.stdout, HELP_TEXT);
    assert.match(capture.output.stdout, /StoryMaker command line interface/);
    assert.match(capture.output.stdout, /storymaker init/);
    assert.match(capture.output.stdout, /storyctl remains supported as an alias/);
  });

  it("prints version", async () => {
    const capture = createCapture();

    const exitCode = await runStoryctl(["--version"], capture.io);

    assert.equal(exitCode, 0);
    assert.equal(capture.output.stderr, "");
    assert.equal(capture.output.stdout, `${VERSION}\n`);
  });

  it("returns a non-zero exit code for unknown commands", async () => {
    const capture = createCapture();

    const exitCode = await runStoryctl(["unknown-command"], capture.io);

    assert.equal(exitCode, 1);
    assert.equal(capture.output.stdout, "");
    assert.match(capture.output.stderr, /Unknown command: unknown-command/);
  });

  it("initializes a CLI-only StoryOS project", async () => {
    const cwd = await createTempDir();

    try {
      const result = await runInit(cwd);

      assert.equal(result.exitCode, 0);
      assert.match(result.capture.output.stdout, /Initialized StoryOS project/);
      assert.equal(result.capture.output.stderr, "");

      for (const relativePath of [
        "project.yaml",
        "00-项目企划案.md",
        "00-项目假设.md",
        "bible",
        "knowledge",
        "plans",
        join("outputs", "chapters"),
        "units",
        "reviews",
        "logs",
        "exports",
        join(".storyos", "story.db"),
        join(".storyos", "index"),
        join(".storyos", "runs"),
        join(".storyos", "work-units"),
        join(".storyos", "checkpoints"),
        join(".storyos", "logs"),
        join(".storyos", "workflow-state.json")
      ]) {
        assert.equal(await pathExists(join(cwd, relativePath)), true, relativePath);
      }

      const projectYaml = await readFile(join(cwd, "project.yaml"), "utf8");
      assert.match(projectYaml, /content_type: "superlong_webnovel"/);
      assert.match(projectYaml, /workflow_profile: "production"/);
      assert.match(projectYaml, /unit_name: "chapter"/);

      const workflowState = JSON.parse(
        await readFile(join(cwd, ".storyos", "workflow-state.json"), "utf8")
      ) as { status: string };
      assert.equal(workflowState.status, "idle");
      assert.equal(readStoryDatabaseVersion(cwd), 1);

      assert.equal(await pathExists(join(cwd, "AGENTS.md")), false);
      assert.equal(await pathExists(join(cwd, "CLAUDE.md")), false);
      assert.equal(await pathExists(join(cwd, ".claude", "skills")), false);

      const writableProbe = join(cwd, ".storyos", "write-test.tmp");
      await writeFile(writableProbe, "ok", "utf8");
      assert.equal(await readFile(writableProbe, "utf8"), "ok");
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("refuses to overwrite managed files without force", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      await writeFile(join(cwd, "project.yaml"), "user content\n", "utf8");

      const result = await runInit(cwd);

      assert.equal(result.exitCode, 1);
      assert.match(result.capture.output.stderr, /Refusing to overwrite/);
      assert.equal(await readFile(join(cwd, "project.yaml"), "utf8"), "user content\n");
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("overwrites managed files with force", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      await writeFile(join(cwd, "project.yaml"), "user content\n", "utf8");

      const result = await runInit(cwd, ["--force"]);

      assert.equal(result.exitCode, 0);
      assert.match(await readFile(join(cwd, "project.yaml"), "utf8"), /project:/);
      assert.equal(readStoryDatabaseVersion(cwd), 1);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("runs database migrations repeatedly during forced init", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      assert.equal((await runInit(cwd, ["--force"])).exitCode, 0);
      assert.equal((await runInit(cwd, ["--force"])).exitCode, 0);

      assert.equal(readStoryDatabaseVersion(cwd), 1);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("keeps MCP disabled by default and enables it explicitly", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      assert.match(await readFile(join(cwd, "project.yaml"), "utf8"), /mcp:\s*\n\s+enabled: false/);

      const result = await runMcp(cwd);

      assert.equal(result.exitCode, 0);
      assert.match(result.capture.output.stdout, /StoryMaker mcp enable/);
      assert.match(result.capture.output.stdout, /MCP enabled: true/);
      assert.equal(result.capture.output.stderr, "");
      assert.match(await readFile(join(cwd, "project.yaml"), "utf8"), /mcp:\s*\n\s+enabled: true/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("installs the CLI-only Codex adapter", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);

      const result = await runAdapterInstall(cwd);

      assert.equal(result.exitCode, 0);
      assert.match(result.capture.output.stdout, /StoryMaker adapter install/);
      assert.match(result.capture.output.stdout, /Adapter: codex/);
      assert.match(result.capture.output.stdout, /Mode: cli-only/);
      assert.equal(result.capture.output.stderr, "");

      const projectYaml = await readFile(join(cwd, "project.yaml"), "utf8");
      assert.match(projectYaml, /installed: \["codex"\]/);

      const agents = await readFile(join(cwd, "AGENTS.md"), "utf8");
      assert.match(agents, /StoryMaker Codex Adapter/);
      assert.match(agents, /storymaker status --json/);
      assert.match(agents, /storymaker continue/);
      assert.match(agents, /storymaker approve --unit <unit>/);
      assert.match(agents, /storymaker reject --unit <unit> --reason <reason>/);
      assert.match(agents, /storymaker revise --unit <unit>/);
      assert.match(agents, /Do not ask the user to manually run StoryMaker commands/);
      assert.match(agents, /Do not mark assumptions as canon/);
      assert.match(agents, /STORYOS_CODEX_ADAPTER_START/);

      assert.equal(await pathExists(join(cwd, "CLAUDE.md")), false);
      assert.equal(await pathExists(join(cwd, ".claude", "skills")), false);

      const doctor = await runDoctor(cwd);
      assert.equal(doctor.exitCode, 0);
      assert.match(doctor.capture.output.stdout, /adapter codex/);
      assert.doesNotMatch(doctor.capture.output.stdout, /CLAUDE\.md/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("keeps Codex adapter installation idempotent", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      await writeFile(join(cwd, "AGENTS.md"), "# Existing Notes\n", "utf8");

      assert.equal((await runAdapterInstall(cwd)).exitCode, 0);
      const firstAgents = await readFile(join(cwd, "AGENTS.md"), "utf8");
      assert.match(firstAgents, /^# Existing Notes/m);
      assert.equal((firstAgents.match(/STORYOS_CODEX_ADAPTER_START/g) ?? []).length, 1);

      assert.equal((await runAdapterInstall(cwd)).exitCode, 0);
      const secondAgents = await readFile(join(cwd, "AGENTS.md"), "utf8");
      const projectYaml = await readFile(join(cwd, "project.yaml"), "utf8");

      assert.equal(secondAgents, firstAgents);
      assert.equal((secondAgents.match(/STORYOS_CODEX_ADAPTER_START/g) ?? []).length, 1);
      assert.match(projectYaml, /installed: \["codex"\]/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("installs the CLI-only Claude Code adapter", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);

      const result = await runAdapterInstall(cwd, "claude-code");

      assert.equal(result.exitCode, 0);
      assert.match(result.capture.output.stdout, /StoryMaker adapter install/);
      assert.match(result.capture.output.stdout, /Adapter: claude-code/);
      assert.match(result.capture.output.stdout, /Claude: CLAUDE\.md/);
      assert.match(
        result.capture.output.stdout,
        /Skill: \.claude\/skills\/story-produce\/SKILL\.md/
      );
      assert.equal(result.capture.output.stderr, "");

      const projectYaml = await readFile(join(cwd, "project.yaml"), "utf8");
      assert.match(projectYaml, /installed: \["claude_code"\]/);

      assert.equal(await pathExists(join(cwd, "AGENTS.md")), false);

      const claudeMd = await readFile(join(cwd, "CLAUDE.md"), "utf8");
      assert.match(claudeMd, /StoryMaker Claude Code Adapter/);
      assert.match(claudeMd, /storymaker status --json/);
      assert.match(
        claudeMd,
        /Do not ask the user to manually invoke StoryMaker skills or commands/
      );
      assert.match(claudeMd, /STORYOS_CLAUDE_ADAPTER_START/);

      const storyProduce = await readFile(
        join(cwd, ".claude", "skills", "story-produce", "SKILL.md"),
        "utf8"
      );
      assert.match(storyProduce, /storymaker continue/);
      assert.match(storyProduce, /storymaker approve --unit <unit>/);
      assert.match(storyProduce, /storymaker reject --unit <unit> --reason <reason>/);
      assert.match(storyProduce, /storymaker revise --unit <unit>/);
      assert.match(
        storyProduce,
        /Do not ask the user to manually invoke lower-level StoryMaker skills or commands/
      );

      for (const skill of ["story-brief", "story-plan", "story-review", "story-replan"]) {
        assert.equal(await pathExists(join(cwd, ".claude", "skills", skill, "SKILL.md")), true);
      }
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("keeps Claude Code adapter installation idempotent and backs up changed skills", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      await writeFile(join(cwd, "CLAUDE.md"), "# Existing Notes\n", "utf8");
      await mkdir(join(cwd, ".claude", "skills", "story-produce"), {
        recursive: true
      });
      await writeFile(
        join(cwd, ".claude", "skills", "story-produce", "SKILL.md"),
        "custom produce skill\n",
        "utf8"
      );

      const first = await runAdapterInstall(cwd, "claude-code");

      assert.equal(first.exitCode, 0);
      assert.match(
        first.capture.output.stdout,
        /Backups: \.claude\/skills\/story-produce\/SKILL\.md\.bak/
      );

      const firstClaude = await readFile(join(cwd, "CLAUDE.md"), "utf8");
      assert.match(firstClaude, /# Existing Notes/);
      assert.equal((firstClaude.match(/STORYOS_CLAUDE_ADAPTER_START/g) ?? []).length, 1);
      assert.equal(
        await readFile(join(cwd, ".claude", "skills", "story-produce", "SKILL.md.bak"), "utf8"),
        "custom produce skill\n"
      );

      const second = await runAdapterInstall(cwd, "claude-code");

      assert.equal(second.exitCode, 0);
      assert.doesNotMatch(second.capture.output.stdout, /Backups:/);
      assert.equal(await readFile(join(cwd, "CLAUDE.md"), "utf8"), firstClaude);

      const projectYaml = await readFile(join(cwd, "project.yaml"), "utf8");
      assert.equal((projectYaml.match(/claude_code/g) ?? []).length, 1);
      assert.equal(await pathExists(join(cwd, "AGENTS.md")), false);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("checks a fresh project without requiring uninstalled adapters", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);

      const result = await runDoctor(cwd);

      assert.equal(result.exitCode, 0);
      assert.match(result.capture.output.stdout, /\[ok\] storyctl:/);
      assert.match(result.capture.output.stdout, /\[ok\] project\.yaml:/);
      assert.match(
        result.capture.output.stdout,
        /\[ok\] runtime directory: \.storyos active; no migration required/
      );
      assert.match(
        result.capture.output.stdout,
        /\[ok\] \.storyos: compatibility runtime directory present/
      );
      assert.match(result.capture.output.stdout, /\[ok\] adapters: none installed/);
      assert.doesNotMatch(result.capture.output.stdout, /AGENTS\.md/);
      assert.doesNotMatch(result.capture.output.stdout, /CLAUDE\.md/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("reports optional .storymaker without switching away from .storyos", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      await mkdir(join(cwd, ".storymaker"), {
        recursive: true
      });

      const result = await runDoctor(cwd);

      assert.equal(result.exitCode, 0);
      assert.match(
        result.capture.output.stdout,
        /\[ok\] runtime directory: \.storyos active; \.storymaker also exists/
      );
      assert.equal(await pathExists(join(cwd, ".storyos", "workflow-state.json")), true);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("detects .storymaker-only projects without migrating runtime data", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      await rm(join(cwd, ".storyos"), {
        force: true,
        recursive: true
      });
      await mkdir(join(cwd, ".storymaker"), {
        recursive: true
      });

      const result = await runDoctor(cwd);

      assert.equal(result.exitCode, 1);
      assert.match(
        result.capture.output.stdout,
        /\[warn\] runtime directory: \.storymaker detected, but \.storyos remains the active compatibility runtime/
      );
      assert.match(
        result.capture.output.stdout,
        /\[error\] \.storyos: compatibility runtime directory missing/
      );
      assert.equal(await pathExists(join(cwd, ".storyos")), false);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("checks AGENTS.md content for the codex adapter", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);

      const missing = await runDoctor(cwd, ["--adapter", "codex"]);

      assert.equal(missing.exitCode, 1);
      assert.match(missing.capture.output.stdout, /AGENTS\.md/);
      assert.doesNotMatch(missing.capture.output.stdout, /CLAUDE\.md/);
      assert.doesNotMatch(missing.capture.output.stdout, /\.claude\/skills/);

      await writeFile(join(cwd, "AGENTS.md"), "StoryOS rules\n", "utf8");

      const incomplete = await runDoctor(cwd, ["--adapter", "codex"]);

      assert.equal(incomplete.exitCode, 1);
      assert.match(
        incomplete.capture.output.stdout,
        /missing AGENTS\.md rule: storymaker continue/
      );
      assert.match(
        incomplete.capture.output.stdout,
        /missing AGENTS\.md rule: storymaker approve --unit <unit>/
      );
      assert.match(
        incomplete.capture.output.stdout,
        /missing AGENTS\.md rule: storymaker reject --unit <unit> --reason <reason>/
      );
      assert.match(
        incomplete.capture.output.stdout,
        /missing AGENTS\.md rule: do not ask the user to manually run StoryMaker commands/
      );
      assert.doesNotMatch(incomplete.capture.output.stdout, /\.claude\/skills/);

      assert.equal((await runAdapterInstall(cwd)).exitCode, 0);

      const present = await runDoctor(cwd, ["--adapter", "codex"]);

      assert.equal(present.exitCode, 0);
      assert.match(present.capture.output.stdout, /\[ok\] adapter codex: AGENTS\.md/);
      assert.match(
        present.capture.output.stdout,
        /\[ok\] adapter codex: AGENTS\.md required daily flow rules/
      );
      assert.doesNotMatch(present.capture.output.stdout, /\.claude\/skills/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("checks only Claude Code files for the claude-code adapter", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);

      const missing = await runDoctor(cwd, ["--adapter=claude-code"]);

      assert.equal(missing.exitCode, 1);
      assert.match(missing.capture.output.stdout, /CLAUDE\.md/);
      assert.match(missing.capture.output.stdout, /\.claude\/skills/);
      assert.match(missing.capture.output.stdout, /\.claude\/skills\/story-produce\/SKILL\.md/);
      assert.doesNotMatch(missing.capture.output.stdout, /AGENTS\.md/);

      await mkdir(join(cwd, ".claude", "skills"), {
        recursive: true
      });
      await writeFile(join(cwd, "CLAUDE.md"), "StoryOS rules\n", "utf8");

      const incomplete = await runDoctor(cwd, ["--adapter", "claude-code"]);

      assert.equal(incomplete.exitCode, 1);
      assert.match(
        incomplete.capture.output.stdout,
        /\[error\] adapter claude-code: \.claude\/skills\/story-produce\/SKILL\.md/
      );
      assert.doesNotMatch(incomplete.capture.output.stdout, /AGENTS\.md/);

      await mkdir(join(cwd, ".claude", "skills", "story-produce"), {
        recursive: true
      });
      await writeFile(
        join(cwd, ".claude", "skills", "story-produce", "SKILL.md"),
        "custom produce skill\n",
        "utf8"
      );

      const incompleteRules = await runDoctor(cwd, ["--adapter", "claude-code"]);

      assert.equal(incompleteRules.exitCode, 1);
      assert.match(
        incompleteRules.capture.output.stdout,
        /missing story-produce rule: storymaker continue/
      );
      assert.match(
        incompleteRules.capture.output.stdout,
        /missing story-produce rule: storymaker approve --unit <unit>/
      );
      assert.match(
        incompleteRules.capture.output.stdout,
        /missing CLAUDE\.md rule: do not ask the user to manually invoke StoryMaker skills or commands/
      );

      assert.equal((await runAdapterInstall(cwd, "claude-code")).exitCode, 0);

      const present = await runDoctor(cwd, ["--adapter", "claude-code"]);

      assert.equal(present.exitCode, 0);
      assert.match(present.capture.output.stdout, /\[ok\] adapter claude-code: CLAUDE\.md/);
      assert.match(present.capture.output.stdout, /\[ok\] adapter claude-code: \.claude\/skills/);
      assert.match(
        present.capture.output.stdout,
        /\[ok\] adapter claude-code: \.claude\/skills\/story-produce\/SKILL\.md/
      );
      assert.match(
        present.capture.output.stdout,
        /\[ok\] adapter claude-code: Claude Code daily flow rules/
      );
      assert.doesNotMatch(present.capture.output.stdout, /AGENTS\.md/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("reports stale indexes when Markdown sources are newer than story.db", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      await new Promise((resolve) => setTimeout(resolve, 20));
      await writeFile(join(cwd, "knowledge", "note.md"), "# 新事实\n", "utf8");

      const result = await runDoctor(cwd);

      assert.equal(result.exitCode, 0);
      assert.match(result.capture.output.stdout, /\[warn\] index:/);
      assert.match(result.capture.output.stdout, /storyctl index rebuild/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("returns a non-zero exit code outside a StoryOS project", async () => {
    const cwd = await createTempDir();

    try {
      const result = await runDoctor(cwd);

      assert.equal(result.exitCode, 1);
      assert.match(result.capture.output.stdout, /\[error\] project\.yaml:/);
      assert.match(result.capture.output.stdout, /storyctl init/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("prints project status for an initialized project", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);

      const result = await runStatus(cwd);

      assert.equal(result.exitCode, 0);
      assert.match(result.capture.output.stdout, /StoryMaker status/);
      assert.match(result.capture.output.stdout, /Project: 未定名项目/);
      assert.match(result.capture.output.stdout, /content_type: superlong_webnovel/);
      assert.match(result.capture.output.stdout, /workflow_profile: production/);
      assert.match(result.capture.output.stdout, /WorkflowState: idle/);
      assert.match(result.capture.output.stdout, /Installed adapters: none/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("prints project status as JSON", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);

      const result = await runStatus(cwd, ["--json"]);
      const json = parseJsonOutput(result.capture.output.stdout);

      assert.equal(result.exitCode, 0);
      assert.equal(result.capture.output.stderr, "");
      assert.equal(json.command, "status");
      assert.equal(json.status, "idle");
      assert.equal(json.currentUnitId, null);
      assert.equal(json.stagedOutputFile, null);
      assert.equal(json.reportFile, null);
      assert.equal(json.nextAction, null);
      assert.doesNotMatch(result.capture.output.stdout, /StoryMaker status/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("starts the dashboard command in one-shot mode", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);

      const result = await runDashboard(cwd, ["--port", "0", "--once", "--json"]);
      const json = parseJsonOutput(result.capture.output.stdout);
      const status = await runStatus(cwd);

      assert.equal(result.exitCode, 0);
      assert.equal(result.capture.output.stderr, "");
      assert.equal(json.command, "dashboard");
      assert.equal(json.closed, true);
      assert.equal(json.status, "stopped");
      assert.equal(json.host, "127.0.0.1");
      assert.match(String(json.url), /^http:\/\/127\.0\.0\.1:\d+\/$/);
      assert.equal(status.exitCode, 0);
      assert.match(status.capture.output.stdout, /StoryMaker status/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("returns a clear error outside a StoryOS project for status", async () => {
    const cwd = await createTempDir();

    try {
      const result = await runStatus(cwd);

      assert.equal(result.exitCode, 1);
      assert.match(result.capture.output.stderr, /Not a StoryOS project/);
      assert.match(result.capture.output.stderr, /storyctl init/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("returns machine-readable errors in JSON mode", async () => {
    const cwd = await createTempDir();

    try {
      const result = await runStatus(cwd, ["--json"]);
      const json = parseJsonOutput(result.capture.output.stderr);
      const error = json.error as Record<string, unknown>;

      assert.equal(result.exitCode, 1);
      assert.equal(result.capture.output.stdout, "");
      assert.equal(json.command, "status");
      assert.equal(json.status, "error");
      assert.match(String(error.message), /Not a StoryOS project/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("shows pending review content when workflow awaits user review", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      await writeFile(
        join(cwd, ".storyos", "workflow-state.json"),
        `${JSON.stringify(
          {
            currentUnitId: "unit-23",
            stagedOutputFile: "outputs/chapters/第0023章 雨夜来客.md",
            status: "awaiting_user_review"
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      const result = await runStatus(cwd);

      assert.equal(result.exitCode, 0);
      assert.match(result.capture.output.stdout, /WorkflowState: awaiting_user_review/);
      assert.match(result.capture.output.stdout, /Current WorkUnit: unit-23/);
      assert.match(result.capture.output.stdout, /Pending review: unit-23/);
      assert.match(result.capture.output.stdout, /第0023章 雨夜来客\.md/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("prompts for index rebuild when story.db is missing", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      await rm(join(cwd, ".storyos", "story.db"), {
        force: true
      });

      const result = await runStatus(cwd);

      assert.equal(result.exitCode, 0);
      assert.match(result.capture.output.stdout, /story\.db missing/);
      assert.match(result.capture.output.stdout, /storyctl index rebuild/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("shows pending review content when resuming awaiting user review", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      await writeFile(
        join(cwd, ".storyos", "workflow-state.json"),
        `${JSON.stringify(
          {
            currentUnitId: "unit-23",
            stagedOutputFile: "outputs/chapters/023-rain.md",
            status: "awaiting_user_review",
            updatedAt: "2026-06-28T00:00:00.000Z"
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      const result = await runResume(cwd);

      assert.equal(result.exitCode, 0);
      assert.match(result.capture.output.stdout, /StoryMaker resume/);
      assert.match(result.capture.output.stdout, /WorkflowState: awaiting_user_review/);
      assert.match(result.capture.output.stdout, /Current WorkUnit: unit-23/);
      assert.match(
        result.capture.output.stdout,
        /Pending review: unit-23 outputs\/chapters\/023-rain\.md/
      );
      assert.match(result.capture.output.stdout, /Next action: Review the staged output/);
      assert.doesNotMatch(result.capture.output.stdout, /storyctl produce next/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("prints resume state as JSON", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      await writeFile(
        join(cwd, ".storyos", "workflow-state.json"),
        `${JSON.stringify(
          {
            currentUnitId: "unit-23",
            stagedOutputFile: "outputs/chapters/023-rain.md",
            status: "awaiting_user_review",
            updatedAt: "2026-06-28T00:00:00.000Z"
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      const result = await runResume(cwd, ["--json"]);
      const json = parseJsonOutput(result.capture.output.stdout);

      assert.equal(result.exitCode, 0);
      assert.equal(result.capture.output.stderr, "");
      assert.equal(json.command, "resume");
      assert.equal(json.status, "awaiting_user_review");
      assert.equal(json.currentUnitId, "unit-23");
      assert.equal(json.stagedOutputFile, "outputs/chapters/023-rain.md");
      assert.match(String(json.nextAction), /Review the staged output/);
      assert.doesNotMatch(result.capture.output.stdout, /StoryMaker resume/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("prompts for index rebuild before resuming when story.db is missing", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      await rm(join(cwd, ".storyos", "story.db"), {
        force: true
      });
      await writeFile(
        join(cwd, ".storyos", "workflow-state.json"),
        `${JSON.stringify(
          {
            currentUnitId: "unit-24",
            status: "ready_to_produce",
            updatedAt: "2026-06-28T00:00:00.000Z"
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      const result = await runResume(cwd);

      assert.equal(result.exitCode, 0);
      assert.match(result.capture.output.stdout, /WorkflowState: ready_to_produce/);
      assert.match(result.capture.output.stdout, /story\.db missing/);
      assert.match(
        result.capture.output.stdout,
        /Next action: Run storyctl index rebuild before resuming\./
      );
      assert.doesNotMatch(result.capture.output.stdout, /storyctl produce next/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("shows failed production step and latest run when resuming interrupted production", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      await writeFile(
        join(cwd, ".storyos", "workflow-state.json"),
        `${JSON.stringify(
          {
            currentRunId: "run-latest",
            currentUnitId: "unit-25",
            status: "producing",
            updatedAt: "2026-06-28T00:00:00.000Z"
          },
          null,
          2
        )}\n`,
        "utf8"
      );
      await writeFile(
        join(cwd, ".storyos", "runs", "run-latest.json"),
        `${JSON.stringify(
          {
            id: "run-latest",
            startedAt: "2026-06-28T00:00:00.000Z",
            status: "failed",
            steps: [
              {
                endedAt: "2026-06-28T00:01:00.000Z",
                error: "model call interrupted",
                id: "draft",
                name: "Draft chapter",
                reportFile: "reviews/run-latest-draft.md",
                startedAt: "2026-06-28T00:00:10.000Z",
                status: "failed"
              }
            ],
            unitId: "unit-25"
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      const result = await runResume(cwd);

      assert.equal(result.exitCode, 0);
      assert.match(result.capture.output.stdout, /WorkflowState: producing/);
      assert.match(result.capture.output.stdout, /Latest run: run-latest \(failed\)/);
      assert.match(result.capture.output.stdout, /Failed step: draft \(Draft chapter\)/);
      assert.match(result.capture.output.stdout, /Failed step error: model call interrupted/);
      assert.match(result.capture.output.stdout, /rerun or continue production/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("prompts the next production step when resuming ready to produce", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      await writeFile(
        join(cwd, ".storyos", "workflow-state.json"),
        `${JSON.stringify(
          {
            currentUnitId: "unit-26",
            status: "ready_to_produce",
            updatedAt: "2026-06-28T00:00:00.000Z"
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      const result = await runResume(cwd);

      assert.equal(result.exitCode, 0);
      assert.match(result.capture.output.stdout, /WorkflowState: ready_to_produce/);
      assert.match(result.capture.output.stdout, /Current WorkUnit: unit-26/);
      assert.match(result.capture.output.stdout, /produce packet --unit next --json/);
      assert.match(result.capture.output.stdout, /draft submit/);
      assert.match(result.capture.output.stdout, /produce next --placeholder/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("returns a clear error outside a StoryOS project for resume", async () => {
    const cwd = await createTempDir();

    try {
      const result = await runResume(cwd);

      assert.equal(result.exitCode, 1);
      assert.match(result.capture.output.stderr, /Not a StoryOS project/);
      assert.match(result.capture.output.stderr, /storyctl init/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("indexes canon Markdown by default and staged Markdown when requested", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      await writeIndexedMarkdown(cwd, join("knowledge", "canon.md"), "canon", "# Canon\n");
      await writeIndexedMarkdown(cwd, join("knowledge", "staged.md"), "staged", "# Staged\n");

      const defaultResult = await runIndex(cwd);

      assert.equal(defaultResult.exitCode, 0);
      assert.match(defaultResult.capture.output.stdout, /Included statuses: canon/);
      assert.deepEqual(readIndexedFacts(cwd), [
        {
          source_path: "knowledge/canon.md",
          status: "canon"
        }
      ]);

      const stagedResult = await runIndex(cwd, ["--include-staged"]);

      assert.equal(stagedResult.exitCode, 0);
      assert.match(stagedResult.capture.output.stdout, /canon, staged/);
      assert.deepEqual(readIndexedFacts(cwd), [
        {
          source_path: "knowledge/canon.md",
          status: "canon"
        },
        {
          source_path: "knowledge/staged.md",
          status: "staged"
        }
      ]);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("rebuilds the index and removes records for deleted Markdown", async () => {
    const cwd = await createTempDir();
    const firstPath = join(cwd, "knowledge", "first.md");

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      await writeIndexedMarkdown(cwd, join("knowledge", "first.md"), "canon", "# First\n");
      assert.equal((await runIndex(cwd)).exitCode, 0);

      await rm(firstPath, {
        force: true
      });
      await writeIndexedMarkdown(cwd, join("knowledge", "second.md"), "canon", "# Second\n");

      const result = await runIndex(cwd, ["rebuild"]);

      assert.equal(result.exitCode, 0);
      assert.match(result.capture.output.stdout, /Mode: rebuild/);
      assert.deepEqual(readIndexedFacts(cwd), [
        {
          source_path: "knowledge/second.md",
          status: "canon"
        }
      ]);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("searches indexed Markdown and prints path title summary and reason", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      await writeIndexedMarkdown(
        cwd,
        join("knowledge", "secret.md"),
        "canon",
        "# 林夏的秘密\n主角林夏现在知道银钥匙可以打开地下室。\n"
      );
      assert.equal((await runIndex(cwd, ["rebuild"])).exitCode, 0);

      const result = await runSearch(cwd, "主角现在知道哪些秘密");

      assert.equal(result.exitCode, 0);
      assert.match(result.capture.output.stdout, /StoryMaker search/);
      assert.match(result.capture.output.stdout, /Search mode: fts5/);
      assert.match(result.capture.output.stdout, /Path: knowledge\/secret\.md/);
      assert.match(result.capture.output.stdout, /1\. 林夏的秘密/);
      assert.match(result.capture.output.stdout, /Summary: 主角林夏/);
      assert.match(result.capture.output.stdout, /Reason: matched.*:/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("builds prompt-ready context from Markdown and the SQLite index", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      await writeIndexedMarkdown(
        cwd,
        join("units", "chapters", "unit-1.md"),
        "canon",
        "# Unit 1 Plan\nunit 1 opening scene in the rain.\n"
      );
      await writeIndexedMarkdown(
        cwd,
        join("knowledge", "characters", "hero.md"),
        "canon",
        "# Hero\nunit 1 hero state: suspicious but determined.\n"
      );
      await writeIndexedMarkdown(
        cwd,
        join("knowledge", "timeline.md"),
        "canon",
        "# Timeline\nunit 1 happens after the midnight call.\n"
      );
      await writeIndexedMarkdown(
        cwd,
        join("bible", "style.md"),
        "canon",
        "# Style Guide\nConcrete sensory detail, no vague summary.\n"
      );
      assert.equal((await runIndex(cwd, ["rebuild"])).exitCode, 0);

      const result = await runContext(cwd, ["--unit", "1"]);

      assert.equal(result.exitCode, 0);
      assert.match(result.capture.output.stdout, /StoryMaker context/);
      assert.match(result.capture.output.stdout, /Unit: 1/);
      assert.match(result.capture.output.stdout, /Index status: ok/);
      assert.match(result.capture.output.stdout, /Path: units\/chapters\/unit-1\.md/);
      assert.match(result.capture.output.stdout, /Origin: index, markdown/);
      assert.match(result.capture.output.stdout, /Prompt-ready context:/);
      assert.match(result.capture.output.stdout, /Use these sources:/);
      assert.match(result.capture.output.stdout, /Known gaps:/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("builds prompt-ready context from structured knowledge", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      const pendingDir = join(cwd, ".storyos", "pending-knowledge-updates");
      await mkdir(pendingDir, {
        recursive: true
      });
      await writeFile(
        join(pendingDir, "pending-structured-context.json"),
        `${JSON.stringify(
          {
            createdAt: "2026-06-28T00:00:00.000Z",
            entityUpdates: [],
            factDrafts: [
              {
                sourceRef: "outputs/chapters/chapter-0001.md",
                subject: "Mira",
                summary: "Mira trusts the clockmaker after the bridge scene.",
                type: "character_state"
              },
              {
                sourceRef: "outputs/chapters/chapter-0001.md",
                subject: "Midnight bell",
                summary: "The midnight bell rings before the harbor fire.",
                type: "timeline_event"
              },
              {
                key: "silver-key",
                sourceRef: "outputs/chapters/chapter-0001.md",
                summary: "The silver key flashes under the rain grate.",
                type: "new_foreshadowing"
              }
            ],
            facts: [],
            foreshadowingUpdates: [],
            id: "pending-structured-context",
            sourceRunId: "run-structured-context",
            status: "committed",
            timelineUpdates: [],
            unitId: "chapter-0001"
          },
          null,
          2
        )}\n`,
        "utf8"
      );
      assert.equal((await runIndex(cwd, ["rebuild"])).exitCode, 0);

      const contextResult = await runContext(cwd, ["--unit", "1"]);

      assert.equal(contextResult.exitCode, 0);
      assert.match(contextResult.capture.output.stdout, /Structured character state/);
      assert.match(contextResult.capture.output.stdout, /Structured timeline/);
      assert.match(contextResult.capture.output.stdout, /Structured foreshadowing/);
      assert.doesNotMatch(contextResult.capture.output.stdout, /Character state not found/);
      assert.doesNotMatch(contextResult.capture.output.stdout, /Timeline context not found/);
      assert.doesNotMatch(contextResult.capture.output.stdout, /Foreshadowing context not found/);

      const searchResult = await runSearch(cwd, "clockmaker");
      assert.equal(searchResult.exitCode, 0);
      assert.match(searchResult.capture.output.stdout, /Reason: matched character_state.*:/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("covers context recall fixtures for character foreshadowing and item location", async () => {
    const fixtures = [
      {
        expectedTitle: "Structured character state",
        gapPattern: /Character state not found/,
        id: "character-state-change",
        sourceFile: "outputs/chapters/character-state-change.md",
        summary: "Mira no longer trusts the clockmaker after the bridge scene.",
        subject: "Mira",
        type: "character_state"
      },
      {
        expectedTitle: "Structured foreshadowing",
        gapPattern: /Foreshadowing context not found/,
        id: "unresolved-foreshadowing",
        sourceFile: "outputs/chapters/unresolved-foreshadowing.md",
        summary: "The silver key remains unresolved beneath the rain grate.",
        subject: "silver-key",
        type: "new_foreshadowing"
      },
      {
        expectedTitle: "Structured item locations",
        id: "item-location-change",
        sourceFile: "outputs/chapters/item-location-change.md",
        summary: "The brass compass moves from the harbor locker to Mira's coat.",
        subject: "brass compass",
        type: "item_location"
      }
    ];
    const tempDirs: string[] = [];

    try {
      for (const fixture of fixtures) {
        const cwd = await createTempDir();
        tempDirs.push(cwd);
        assert.equal((await runInit(cwd)).exitCode, 0);
        await writeIndexedMarkdown(
          cwd,
          fixture.sourceFile,
          "canon",
          `# ${fixture.id}\n${fixture.summary}\n`
        );
        const pendingDir = join(cwd, ".storyos", "pending-knowledge-updates");
        await mkdir(pendingDir, {
          recursive: true
        });
        await writeFile(
          join(pendingDir, `pending-${fixture.id}.json`),
          `${JSON.stringify(
            {
              createdAt: "2026-06-28T00:00:00.000Z",
              entityUpdates: [],
              factDrafts: [
                {
                  sourceRef: fixture.sourceFile,
                  subject: fixture.subject,
                  summary: fixture.summary,
                  type: fixture.type
                }
              ],
              facts: [],
              foreshadowingUpdates: [],
              id: `pending-${fixture.id}`,
              sourceRunId: `run-${fixture.id}`,
              status: "committed",
              timelineUpdates: [],
              unitId: "chapter-0001"
            },
            null,
            2
          )}\n`,
          "utf8"
        );
        assert.equal((await runIndex(cwd, ["rebuild"])).exitCode, 0);

        const result = await runContext(cwd, ["--unit", "1"]);

        assert.equal(result.exitCode, 0);
        assert.match(result.capture.output.stdout, new RegExp(fixture.expectedTitle));
        assert.equal(result.capture.output.stdout.includes(fixture.sourceFile), true);
        assert.match(result.capture.output.stdout, /Known gaps:/);

        if (fixture.gapPattern !== undefined) {
          assert.doesNotMatch(result.capture.output.stdout, fixture.gapPattern);
        }
      }
    } finally {
      await Promise.all(
        tempDirs.map((cwd) =>
          rm(cwd, {
            force: true,
            recursive: true
          })
        )
      );
    }
  });

  it("builds prompt-ready context as JSON", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      await writeIndexedMarkdown(
        cwd,
        join("units", "chapters", "unit-1.md"),
        "canon",
        "# Unit 1 Plan\nunit 1 opening scene in the rain.\n"
      );
      assert.equal((await runIndex(cwd, ["rebuild"])).exitCode, 0);

      const result = await runContext(cwd, ["--unit", "1", "--json"]);
      const json = parseJsonOutput(result.capture.output.stdout);
      const data = json.data as Record<string, unknown>;

      assert.equal(result.exitCode, 0);
      assert.equal(result.capture.output.stderr, "");
      assert.equal(json.command, "context");
      assert.equal(json.status, "ok");
      assert.equal(json.currentUnitId, "1");
      assert.equal(json.reportFile, null);
      assert.equal(data.unit, "1");
      assert.ok(Array.isArray(data.sources));
      assert.doesNotMatch(result.capture.output.stdout, /StoryMaker context/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("builds an AI work packet as JSON with sources gaps and output targets", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      await writeIndexedMarkdown(
        cwd,
        join("units", "chapters", "unit-1.md"),
        "canon",
        "# Unit 1 Plan\nunit 1 should open with the silver key in the rain.\n"
      );
      await writeIndexedMarkdown(
        cwd,
        join("bible", "style.md"),
        "canon",
        "# Style Guide\nUse concrete sensory detail and strong hooks.\n"
      );
      assert.equal((await runIndex(cwd, ["rebuild"])).exitCode, 0);

      const result = await runProducePacket(cwd, ["--unit", "next", "--json"]);
      const json = parseJsonOutput(result.capture.output.stdout);
      const data = json.data as {
        context: {
          gaps: string[];
          sources: Array<{ sourcePath: string; summary: string }>;
          unit: string;
        };
        generation: {
          prompt: string;
          templateId: string;
        };
        outputTarget: {
          draftPath: string;
          knowledgeUpdatePath: string;
          qualityReportPath: string;
        };
        workUnit: {
          id: string;
          status: string;
        };
      };

      assert.equal(result.exitCode, 0);
      assert.equal(result.capture.output.stderr, "");
      assert.equal(json.command, "produce packet");
      assert.equal(json.status, "ok");
      assert.equal(json.currentUnitId, "chapter-0001");
      assert.equal(json.stagedOutputFile, null);
      assert.equal(json.reportFile, null);
      assert.equal(data.workUnit.id, "chapter-0001");
      assert.equal(data.workUnit.status, "planned");
      assert.equal(data.context.unit, "1");
      assert.ok(
        data.context.sources.some((source) => source.sourcePath === "units/chapters/unit-1.md")
      );
      assert.ok(data.context.sources.some((source) => source.sourcePath === "bible/style.md"));
      assert.ok(data.context.gaps.includes("Character state not found."));
      assert.match(data.outputTarget.draftPath, /^outputs\/chapters\//);
      assert.match(data.outputTarget.qualityReportPath, /^reviews\/packet-/);
      assert.match(
        data.outputTarget.knowledgeUpdatePath,
        /^\.storyos\/pending-knowledge-updates\/pending-packet-/
      );
      assert.equal(data.generation.templateId, "story-draft");
      assert.match(data.generation.prompt, /# StoryMaker Prompt: story-draft/);
      assert.match(data.generation.prompt, /Quality report: reviews\/packet-/);
      assert.doesNotMatch(result.capture.output.stdout, /StoryMaker produce packet/);

      assert.equal(await pathExists(join(cwd, ".storyos", "runs")), true);
      assert.deepEqual(await readdir(join(cwd, ".storyos", "runs")), []);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("prints a human-readable AI work packet", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      await writeIndexedMarkdown(
        cwd,
        join("bible", "style.md"),
        "canon",
        "# Style Guide\nUse concrete sensory detail.\n"
      );

      const result = await runProducePacket(cwd, ["--unit=next"]);

      assert.equal(result.exitCode, 0);
      assert.match(result.capture.output.stdout, /StoryMaker produce packet/);
      assert.match(result.capture.output.stdout, /WorkUnit: chapter-0001/);
      assert.match(result.capture.output.stdout, /Output target:/);
      assert.match(result.capture.output.stdout, /Draft: outputs\/chapters\//);
      assert.match(result.capture.output.stdout, /Quality report: reviews\/packet-/);
      assert.match(result.capture.output.stdout, /Sources:/);
      assert.match(result.capture.output.stdout, /Path: bible\/style\.md/);
      assert.match(result.capture.output.stdout, /Gaps:/);
      assert.match(result.capture.output.stdout, /Generation prompt:/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("simulates the agent daily flow from continue to draft submit and review", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);

      const firstContinue = await runContinue(cwd, ["--json"]);
      const firstContinueJson = parseJsonOutput(firstContinue.capture.output.stdout);

      assert.equal(firstContinue.exitCode, 0);
      assert.equal(firstContinue.capture.output.stderr, "");
      assert.equal(firstContinueJson.command, "continue");
      assert.equal(firstContinueJson.status, "idle");
      assert.equal(firstContinueJson.acceptance, null);
      assert.equal(firstContinueJson.stagedOutputFile, null);
      assert.equal(firstContinueJson.reportFile, null);
      assert.match(String(firstContinueJson.nextAction), /produce packet --unit next --json/);
      assert.match(String(firstContinueJson.nextAction), /draft submit/);
      assert.deepEqual(await readdir(join(cwd, ".storyos", "runs")), []);

      const packetResult = await runProducePacket(cwd, ["--unit", "next", "--json"]);
      const packetJson = parseJsonOutput(packetResult.capture.output.stdout);
      const packet = packetJson.data as {
        generation: {
          prompt: string;
          templateId: string;
        };
        outputTarget: {
          draftPath: string;
          knowledgeUpdatePath: string;
          qualityReportPath: string;
        };
        workUnit: {
          id: string;
          status: string;
        };
      };

      assert.equal(packetResult.exitCode, 0);
      assert.equal(packetResult.capture.output.stderr, "");
      assert.equal(packetJson.command, "produce packet");
      assert.equal(packetJson.status, "ok");
      assert.equal(packet.workUnit.id, "chapter-0001");
      assert.equal(packet.workUnit.status, "planned");
      assert.equal(packet.generation.templateId, "story-draft");
      assert.match(packet.generation.prompt, /# StoryMaker Prompt: story-draft/);
      assert.match(packet.outputTarget.draftPath, /^outputs\/chapters\//);
      assert.match(packet.outputTarget.qualityReportPath, /^reviews\/packet-/);
      assert.match(
        packet.outputTarget.knowledgeUpdatePath,
        /^\.storyos\/pending-knowledge-updates\/pending-packet-/
      );
      assert.deepEqual(await readdir(join(cwd, ".storyos", "runs")), []);

      const agentDraftFile = join(cwd, "agent-daily-flow-draft.md");
      await writeFile(
        agentDraftFile,
        `# Agent Draft

Mara follows the mirror-city rainline to the sealed station. She records that the white umbrella signal means the archive door is watched, and she chooses to wait instead of forcing the lock.

\`\`\`storymaker-facts
{
  "factDrafts": [
    {
      "type": "character_state",
      "subject": "Mara",
      "key": "location",
      "value": "sealed station",
      "summary": "Mara reaches the sealed station by following the mirror-city rainline.",
      "confidence": "high"
    },
    {
      "type": "new_foreshadowing",
      "subject": "white umbrella signal",
      "summary": "The white umbrella signal means the archive door is watched."
    }
  ]
}
\`\`\`
`,
        "utf8"
      );

      const submitResult = await runDraftSubmit(cwd, [
        "--unit",
        packet.workUnit.id,
        "--from",
        agentDraftFile,
        "--title",
        "Mirror City Rainline",
        "--json"
      ]);
      const submitJson = parseJsonOutput(submitResult.capture.output.stdout);
      const submitData = submitJson.data as {
        pendingKnowledgeUpdateFile: string;
        quality: {
          authorSummary: {
            approvalRecommendation: string;
            summaryText: string;
          };
          blocksBatchContinue: boolean;
          reportFile: string;
          status: string;
        };
        reportFile: string;
        runFile: string;
        stagedOutputFile: string;
        workUnit: {
          id: string;
          status: string;
        };
      };

      assert.equal(submitResult.exitCode, 0);
      assert.equal(submitResult.capture.output.stderr, "");
      assert.equal(submitJson.command, "draft submit");
      assert.equal(submitJson.status, "awaiting_user_review");
      assert.equal(submitJson.currentUnitId, packet.workUnit.id);
      assert.equal(submitData.workUnit.id, packet.workUnit.id);
      assert.equal(submitData.workUnit.status, "awaiting_user_review");
      assert.match(submitData.stagedOutputFile, /^outputs\/chapters\//);
      assert.match(submitData.reportFile, /^reviews\/draft-submit-/);
      assert.equal(submitData.quality.reportFile, submitData.reportFile);
      assert.equal(
        (submitJson.qualitySummary as Record<string, unknown>).approvalRecommendation,
        submitData.quality.authorSummary.approvalRecommendation
      );
      assert.match(String(submitJson.nextAction), /Review the staged draft/);

      const stagedDraft = await readFile(join(cwd, submitData.stagedOutputFile), "utf8");
      assert.match(stagedDraft, /Mara follows the mirror-city rainline/);
      assert.doesNotMatch(stagedDraft, /storymaker-facts/);
      assert.match(stagedDraft, /status: "staged"/);

      const pendingUpdate = JSON.parse(
        await readFile(join(cwd, submitData.pendingKnowledgeUpdateFile), "utf8")
      ) as {
        factDrafts: Array<{
          sourceRef: string;
          subject?: string;
          summary: string;
          type: string;
        }>;
        sourceRunId: string;
        status: string;
        unitId: string;
      };
      assert.equal(pendingUpdate.status, "staged");
      assert.equal(pendingUpdate.unitId, packet.workUnit.id);
      assert.equal(pendingUpdate.factDrafts.length, 2);
      assert.equal(pendingUpdate.factDrafts[0].sourceRef, submitData.stagedOutputFile);
      assert.equal(pendingUpdate.factDrafts[0].type, "character_state");
      assert.equal(pendingUpdate.factDrafts[1].type, "new_foreshadowing");

      const productionRun = JSON.parse(await readFile(join(cwd, submitData.runFile), "utf8")) as {
        pendingKnowledgeUpdateFile: string;
        reportFile: string;
        stagedOutputFile: string;
        status: string;
        steps: Array<{
          id: string;
          reportFile?: string;
        }>;
        unitId: string;
      };
      assert.equal(productionRun.status, "completed");
      assert.equal(productionRun.unitId, packet.workUnit.id);
      assert.equal(productionRun.stagedOutputFile, submitData.stagedOutputFile);
      assert.equal(productionRun.pendingKnowledgeUpdateFile, submitData.pendingKnowledgeUpdateFile);
      assert.equal(productionRun.reportFile, submitData.reportFile);
      assert.equal(
        productionRun.steps.some((step) => step.id === "prepare-pending-knowledge-update"),
        true
      );
      assert.equal(
        productionRun.steps.some(
          (step) => step.id === "run-quality-gates" && step.reportFile === submitData.reportFile
        ),
        true
      );

      const qualityReport = await readFile(join(cwd, submitData.reportFile), "utf8");
      assert.match(qualityReport, /StoryMaker Draft Submit Quality Report/);
      assert.match(qualityReport, /Overall Conclusion/);
      assert.match(qualityReport, /Approval Recommendation/);

      const reviewContinue = await runContinue(cwd, ["--json"]);
      const reviewJson = parseJsonOutput(reviewContinue.capture.output.stdout);
      const acceptance = reviewJson.acceptance as {
        draftPath: string;
        qualityReportPath: string;
        question: string;
        unitId: string;
      };

      assert.equal(reviewContinue.exitCode, 0);
      assert.equal(reviewContinue.capture.output.stderr, "");
      assert.equal(reviewJson.command, "continue");
      assert.equal(reviewJson.status, "awaiting_user_review");
      assert.equal(reviewJson.stagedOutputFile, submitData.stagedOutputFile);
      assert.equal(reviewJson.reportFile, submitData.reportFile);
      assert.equal(acceptance.unitId, packet.workUnit.id);
      assert.equal(acceptance.draftPath, submitData.stagedOutputFile);
      assert.equal(acceptance.qualityReportPath, submitData.reportFile);
      assert.equal(acceptance.question, "Approve this chapter?");
      assert.match(String(reviewJson.nextAction), /review|approve|reject/i);
      assert.equal(await pathExists(join(cwd, "knowledge", "committed-updates")), false);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("submits a real Markdown draft with a Chinese title from a Windows-sensitive path", async () => {
    const cwd = await createPathStressTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      const sourceDir = join(cwd, "agent output");
      const sourceFile = join(sourceDir, "草稿 来源.md");
      await mkdir(sourceDir, {
        recursive: true
      });
      await writeFile(
        sourceFile,
        "# 临时标题\n\n银钥匙在雨里发亮，林夏终于意识到地下室不是出口。\n",
        "utf8"
      );

      await writeFile(
        sourceFile,
        `# 涓存椂鏍囬

閾堕挜鍖欏湪闆ㄩ噷鍙戜寒锛屾灄澶忕粓浜庢剰璇嗗埌鍦颁笅瀹や笉鏄嚭鍙ｃ€?

\`\`\`storymaker-facts
{
  "factDrafts": [
    {
      "type": "character_state",
      "subject": "林夏",
      "key": "location",
      "value": "地下室",
      "summary": "林夏发现地下室不是出口。",
      "confidence": "high"
    },
    {
      "type": "new_foreshadowing",
      "subject": "银钥匙",
      "summary": "银钥匙在雨中发光，暗示后续门锁规则。"
    }
  ]
}
\`\`\`
`,
        "utf8"
      );

      await writeFile(
        sourceFile,
        `# 临时标题

银钥匙在雨里发亮，林夏终于意识到地下室不是出口。

\`\`\`storymaker-facts
{
  "factDrafts": [
    {
      "type": "character_state",
      "subject": "林夏",
      "key": "location",
      "value": "地下室",
      "summary": "林夏发现地下室不是出口。",
      "confidence": "high"
    },
    {
      "type": "new_foreshadowing",
      "subject": "银钥匙",
      "summary": "银钥匙在雨中发光，暗示后续门锁规则。"
    }
  ]
}
\`\`\`
`,
        "utf8"
      );

      const result = await runDraftSubmit(cwd, [
        "--unit",
        "chapter-0001",
        "--from",
        sourceFile,
        "--title",
        "雨夜钥匙",
        "--json"
      ]);
      const json = parseJsonOutput(result.capture.output.stdout);
      const data = json.data as {
        pendingKnowledgeUpdateFile: string;
        quality: {
          authorSummary: {
            approvalRecommendation: string;
            majorIssues: Array<{
              affectsSetting: boolean;
              message: string;
              severity: string;
              suggestion?: string;
            }>;
            overallConclusion: string;
            recommendedToApprove: boolean;
            settingImpact: string;
            summaryText: string;
          };
          blocksBatchContinue: boolean;
          gateReports: Array<{
            gate: string;
            reportFile: string;
          }>;
          highestSeverity: string | null;
          p2Suggestions: string[];
          reportFile: string;
          status: string;
          totalFindings: number;
        };
        reportFile: string;
        runFile: string;
        stagedOutputFile: string;
        workUnit: {
          id: string;
          stagedOutputFile: string;
          status: string;
        };
      };

      assert.equal(result.exitCode, 0);
      assert.equal(result.capture.output.stderr, "");
      assert.equal(json.command, "draft submit");
      assert.equal(json.status, "awaiting_user_review");
      assert.equal(json.currentUnitId, "chapter-0001");
      assert.match(String(json.stagedOutputFile), /^outputs\/chapters\//);
      assert.match(String(json.reportFile), /^reviews\/draft-submit-/);
      assert.equal(data.workUnit.id, "chapter-0001");
      assert.equal(data.workUnit.status, "awaiting_user_review");
      assert.equal(data.workUnit.stagedOutputFile, data.stagedOutputFile);
      assert.equal(data.quality.reportFile, data.reportFile);
      assert.equal(data.quality.blocksBatchContinue, false);
      assert.equal(data.quality.highestSeverity, "P2");
      assert.equal(data.quality.status, "failed");
      assert.equal(data.quality.authorSummary.approvalRecommendation, "revise_before_approval");
      assert.equal(data.quality.authorSummary.recommendedToApprove, false);
      assert.equal(data.quality.authorSummary.settingImpact, "none_detected");
      assert.match(data.quality.authorSummary.summaryText, /Approval recommendation/);
      assert.equal(
        (json.qualitySummary as Record<string, unknown>).approvalRecommendation,
        "revise_before_approval"
      );
      assert.equal(data.quality.gateReports.length, 4);
      assert.equal(
        data.quality.gateReports.every((gate) => gate.reportFile.startsWith("reviews/")),
        true
      );
      assert.equal(data.quality.p2Suggestions.length > 0, true);

      const stagedDraft = await readFile(join(cwd, data.stagedOutputFile), "utf8");
      const fileStem = data.stagedOutputFile.split("/").at(-1)?.replace(/\.md$/, "") ?? "";
      const heading = stagedDraft.match(/^# (.+)$/m)?.[1];
      assert.equal(heading, fileStem);
      assert.match(stagedDraft, /status: "staged"/);
      assert.doesNotMatch(stagedDraft, /storymaker-facts/);
      assert.doesNotMatch(stagedDraft, /status: "canon"/);
      assert.match(stagedDraft, /银钥匙在雨里发亮/);
      assert.doesNotMatch(stagedDraft, /# 临时标题/);

      const workflowState = JSON.parse(
        await readFile(join(cwd, ".storyos", "workflow-state.json"), "utf8")
      ) as {
        currentRunId: string;
        currentUnitId: string;
        stagedOutputFile: string;
        status: string;
      };
      assert.equal(workflowState.status, "awaiting_user_review");
      assert.equal(workflowState.currentUnitId, "chapter-0001");
      assert.equal(workflowState.stagedOutputFile, data.stagedOutputFile);

      const pendingUpdate = JSON.parse(
        await readFile(join(cwd, data.pendingKnowledgeUpdateFile), "utf8")
      ) as {
        factDrafts: Array<{
          sourceRef: string;
          subject?: string;
          summary: string;
          type: string;
        }>;
        sourceRunId: string;
        status: string;
        unitId: string;
      };
      assert.equal(pendingUpdate.status, "staged");
      assert.equal(pendingUpdate.unitId, "chapter-0001");
      assert.equal(pendingUpdate.sourceRunId, workflowState.currentRunId);
      assert.equal(pendingUpdate.factDrafts.length, 2);
      assert.equal(pendingUpdate.factDrafts[0].type, "character_state");
      assert.equal(pendingUpdate.factDrafts[0].sourceRef, data.stagedOutputFile);
      assert.equal(pendingUpdate.factDrafts[1].type, "new_foreshadowing");

      const productionRun = JSON.parse(await readFile(join(cwd, data.runFile), "utf8")) as {
        pendingKnowledgeUpdateFile: string;
        quality: {
          totalFindings: number;
        };
        reportFile: string;
        stagedOutputFile: string;
        status: string;
        steps: Array<{
          id: string;
          reportFile?: string;
        }>;
        unitId: string;
      };
      assert.equal(productionRun.status, "completed");
      assert.equal(productionRun.unitId, "chapter-0001");
      assert.equal(productionRun.stagedOutputFile, data.stagedOutputFile);
      assert.equal(productionRun.pendingKnowledgeUpdateFile, data.pendingKnowledgeUpdateFile);
      assert.equal(productionRun.reportFile, data.reportFile);
      assert.equal(productionRun.quality.totalFindings, data.quality.totalFindings);
      assert.equal(
        productionRun.steps.some(
          (step) => step.id === "run-quality-gates" && step.reportFile === data.reportFile
        ),
        true
      );
      const qualityReport = await readFile(join(cwd, data.reportFile), "utf8");
      assert.match(qualityReport, /StoryMaker Draft Submit Quality Report/);
      assert.match(qualityReport, /Overall Conclusion/);
      assert.match(qualityReport, /Approval Recommendation/);
      assert.match(qualityReport, /Major Issues/);
      assert.match(qualityReport, /Concrete evidence|Revision suggestion/);
      assert.match(qualityReport, /Affects setting: no/);
      assert.match(qualityReport, /AI Reply Summary/);
      assert.match(qualityReport, /ai_taste/);
      assert.match(qualityReport, /consistency/);
      assert.match(qualityReport, /reader_experience/);
      assert.match(qualityReport, /commercial_review/);
      assert.match(qualityReport, /P2 Revision Suggestions/);
      assert.equal(await pathExists(join(cwd, "knowledge", "committed-updates")), false);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("prints non-blocking P3 draft quality as passed with notes", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      const sourceFile = join(cwd, "draft-with-p3-note.md");
      await writeFile(
        sourceFile,
        `# Draft

Mara followed the mirror-city rainline for what felt like an eternity while she counted each station light and chose the careful route through the service tunnel. She marked every door with chalk before touching the lock, keeping the archive watchers in sight without forcing a confrontation. The final beat leaves her outside the archive, listening to rain measure the hidden patrols while she plans a deliberate return before dawn.
`,
        "utf8"
      );

      const result = await runDraftSubmit(cwd, [
        "--unit",
        "chapter-0001",
        "--from",
        sourceFile,
        "--title",
        "Patient Route"
      ]);
      const reportFile = result.capture.output.stdout.match(/Report: (reviews\/\S+)/)?.[1];

      assert.equal(result.exitCode, 0);
      assert.equal(result.capture.output.stderr, "");
      assert.match(result.capture.output.stdout, /StoryMaker draft submit/);
      assert.match(result.capture.output.stdout, /Quality status: passed_with_notes/);
      assert.doesNotMatch(result.capture.output.stdout, /Quality status: failed/);
      assert.match(result.capture.output.stdout, /Highest severity: P3/);
      assert.match(result.capture.output.stdout, /Blocks batch continue: no/);

      if (reportFile === undefined) {
        throw new Error("Expected draft submit to print a quality report path.");
      }

      const qualityReport = await readFile(join(cwd, reportFile), "utf8");
      assert.match(qualityReport, /Status: passed_with_notes/);
      assert.doesNotMatch(qualityReport, /Status: failed\nHighest severity: P3/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("blocks batch continue when draft quality gates find P1 issues", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      const sourceFile = join(cwd, "draft-with-todo.md");
      await writeFile(
        sourceFile,
        "# Draft\n\nMara reaches the archive door. TODO resolve the escape beat before this chapter is ready for readers.\n",
        "utf8"
      );

      const submitResult = await runDraftSubmit(cwd, [
        "--unit",
        "chapter-0001",
        "--from",
        sourceFile,
        "--title",
        "Archive Door",
        "--json"
      ]);
      const submitJson = parseJsonOutput(submitResult.capture.output.stdout);
      const submitData = submitJson.data as {
        quality: {
          authorSummary: {
            approvalRecommendation: string;
            recommendedToApprove: boolean;
          };
          blocksBatchContinue: boolean;
          highestSeverity: string | null;
        };
        reportFile: string;
      };

      assert.equal(submitResult.exitCode, 0);
      assert.equal(submitData.quality.blocksBatchContinue, true);
      assert.equal(submitData.quality.highestSeverity, "P1");
      assert.equal(
        submitData.quality.authorSummary.approvalRecommendation,
        "manual_review_required"
      );
      assert.equal(submitData.quality.authorSummary.recommendedToApprove, false);
      assert.equal(
        (submitJson.qualitySummary as Record<string, unknown>).approvalRecommendation,
        "manual_review_required"
      );
      assert.match(String(submitJson.nextAction), /batch continue is blocked/);

      const continueResult = await runContinue(cwd, ["--json"]);
      const continueJson = parseJsonOutput(continueResult.capture.output.stdout);

      assert.equal(continueResult.exitCode, 0);
      assert.equal(continueJson.status, "awaiting_user_review");
      assert.equal(continueJson.reportFile, submitData.reportFile);
      assert.match(String(continueJson.nextAction), /batch continue is blocked/);
      assert.match(String(continueJson.nextAction), /P1/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("does not pollute workflow state when draft submit validation fails", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      const workflowBefore = await readFile(join(cwd, ".storyos", "workflow-state.json"), "utf8");

      const result = await runDraftSubmit(cwd, [
        "--unit",
        "chapter-0001",
        "--from",
        join(cwd, "missing draft.md"),
        "--title",
        "Should Not Persist"
      ]);

      assert.equal(result.exitCode, 1);
      assert.match(result.capture.output.stderr, /Draft source file not found/);
      assert.equal(
        await readFile(join(cwd, ".storyos", "workflow-state.json"), "utf8"),
        workflowBefore
      );
      assert.equal(
        await pathExists(join(cwd, ".storyos", "work-units", "chapter-0001.json")),
        false
      );
      assert.deepEqual(await readdir(join(cwd, ".storyos", "runs")), []);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("marks missing context gaps explicitly", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);

      const result = await runContext(cwd, ["--unit=1"]);

      assert.equal(result.exitCode, 0);
      assert.match(result.capture.output.stdout, /Sources:\n- none/);
      assert.match(result.capture.output.stdout, /Gaps:/);
      assert.match(result.capture.output.stdout, /Current unit plan not found/);
      assert.match(result.capture.output.stdout, /Character state not found/);
      assert.match(result.capture.output.stdout, /Style guide not found/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("asks for index rebuild when building context without story.db", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      await rm(join(cwd, ".storyos", "story.db"), {
        force: true
      });

      const result = await runContext(cwd);

      assert.equal(result.exitCode, 0);
      assert.match(result.capture.output.stdout, /story\.db missing/);
      assert.match(result.capture.output.stdout, /storyctl index rebuild/);
      assert.match(result.capture.output.stdout, /SQLite index unavailable/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("returns a clear error outside a StoryOS project for context", async () => {
    const cwd = await createTempDir();

    try {
      const result = await runContext(cwd);

      assert.equal(result.exitCode, 1);
      assert.match(result.capture.output.stderr, /Not a StoryOS project/);
      assert.match(result.capture.output.stderr, /storyctl init/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("plans chapter Markdown output with one safe title for path and heading", () => {
    const plan = createChapterMarkdownOutputPlan({
      outputDir: "outputs/chapters",
      outputFormat: "md",
      title: '  第 0001 章 Bad<>:"/\\|?* Title. '
    });

    assert.equal(plan.relativePath, `outputs/chapters/${plan.markdownTitle}.md`);
    assert.doesNotMatch(plan.markdownTitle, /[<>:"/\\|?*]/);
    assert.equal(
      Array.from(plan.markdownTitle).some((character) => (character.codePointAt(0) ?? 0) < 32),
      false
    );
    assert.doesNotMatch(plan.markdownTitle, /^[ .]/);
    assert.doesNotMatch(plan.markdownTitle, /[ .]$/);
  });

  it("truncates overlong chapter Markdown file titles", () => {
    const plan = createChapterMarkdownOutputPlan({
      outputDir: "outputs/chapters",
      outputFormat: ".md",
      title: "a".repeat(140)
    });

    assert.equal(plan.markdownTitle.length, 96);
    assert.equal(plan.relativePath, `outputs/chapters/${"a".repeat(96)}.md`);
  });

  it("formats failed production progress steps explicitly", () => {
    assert.equal(
      formatProduceProgressLine({
        error: "model call interrupted",
        index: 3,
        status: "failed",
        stepId: "draft-placeholder",
        stepName: "Create placeholder draft",
        total: 12
      }),
      "[3/12] failed: Create placeholder draft (draft-placeholder) - model call interrupted"
    );
  });

  it("formats the final acceptance summary for adapters and users", () => {
    assert.equal(
      formatFinalAcceptanceSummary({
        draftPath: "outputs/chapters/0001.md",
        qualityReportPath: "reviews/run-0001.md",
        question: "Approve this chapter?",
        unitId: "chapter-0001"
      }),
      [
        "Final acceptance",
        "WorkUnit: chapter-0001",
        "Draft path: outputs/chapters/0001.md",
        "Quality report path: reviews/run-0001.md",
        "Question: Approve this chapter?"
      ].join("\n")
    );
  });

  it("requires explicit placeholder mode for produce next", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);

      const result = await runProduceNextWithoutPlaceholder(cwd);

      assert.equal(result.exitCode, 1);
      assert.match(
        result.capture.output.stderr,
        /Placeholder production is a development fallback/
      );
      assert.match(result.capture.output.stderr, /storymaker produce packet --unit next --json/);
      assert.match(result.capture.output.stderr, /storymaker produce next --placeholder/);
      assert.deepEqual(await readdir(join(cwd, ".storyos", "runs")), []);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("runs produce next placeholder skeleton and leaves staged output for review", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      await writeIndexedMarkdown(
        cwd,
        join("bible", "style.md"),
        "canon",
        "# Style Guide\nUse concrete sensory detail in unit 1.\n"
      );

      const result = await runProduceNext(cwd);

      assert.equal(result.exitCode, 0);
      assert.match(result.capture.output.stdout, /StoryMaker produce next/);
      assert.match(result.capture.output.stdout, /Mode: placeholder fallback/);
      assert.match(result.capture.output.stdout, /\[1\/12\] completed: Load project configuration/);
      assert.match(result.capture.output.stdout, /\[12\/12\] completed: Update workflow state/);
      assert.match(result.capture.output.stdout, /WorkUnit status: awaiting_user_review/);
      assert.match(result.capture.output.stdout, /Steps: 12\/12 completed/);
      assert.match(result.capture.output.stdout, /Canon committed: no/);
      assert.match(result.capture.output.stdout, /Final acceptance/);
      assert.match(result.capture.output.stdout, /Draft path: outputs\/chapters\//);
      assert.match(result.capture.output.stdout, /Quality report path: reviews\/run-/);
      assert.match(result.capture.output.stdout, /Question: Approve this chapter\?/);
      assert.match(result.capture.output.stdout, /real flow with produce packet and draft submit/);
      assert.equal(result.capture.output.stderr, "");

      const runFiles = await readdir(join(cwd, ".storyos", "runs"));
      assert.equal(runFiles.length, 1);

      const productionRun = JSON.parse(
        await readFile(join(cwd, ".storyos", "runs", runFiles[0]), "utf8")
      ) as {
        id: string;
        pendingKnowledgeUpdateFile: string;
        reportFile: string;
        stagedOutputFile: string;
        status: string;
        steps: Array<{ status: string }>;
        unitId: string;
      };

      assert.equal(productionRun.status, "completed");
      assert.equal(productionRun.steps.length, 12);
      assert.equal(
        productionRun.steps.every((step) => step.status === "completed"),
        true
      );
      assert.match(productionRun.stagedOutputFile, /^outputs\/chapters\//);
      assert.doesNotMatch(productionRun.stagedOutputFile, /\.staged\.md$/);
      assert.match(productionRun.reportFile, /^reviews\/run-/);
      assert.match(
        productionRun.pendingKnowledgeUpdateFile,
        /^\.storyos\/pending-knowledge-updates\/pending-run-/
      );

      const pendingUpdateFiles = await readdir(join(cwd, ".storyos", "pending-knowledge-updates"));
      assert.equal(pendingUpdateFiles.length, 1);
      const pendingUpdate = JSON.parse(
        await readFile(
          join(cwd, ".storyos", "pending-knowledge-updates", pendingUpdateFiles[0]),
          "utf8"
        )
      ) as {
        facts: unknown[];
        id: string;
        sourceRunId: string;
        status: string;
        unitId: string;
      };
      assert.equal(pendingUpdate.status, "staged");
      assert.equal(pendingUpdate.sourceRunId, productionRun.id);
      assert.equal(pendingUpdate.unitId, productionRun.unitId);
      assert.deepEqual(pendingUpdate.facts, []);
      assert.equal(
        productionRun.pendingKnowledgeUpdateFile,
        `.storyos/pending-knowledge-updates/${pendingUpdate.id}.json`
      );

      const workflowState = JSON.parse(
        await readFile(join(cwd, ".storyos", "workflow-state.json"), "utf8")
      ) as {
        currentRunId: string;
        currentUnitId: string;
        stagedOutputFile: string;
        status: string;
      };
      assert.equal(workflowState.status, "awaiting_user_review");
      assert.equal(workflowState.currentRunId, productionRun.id);
      assert.equal(workflowState.currentUnitId, productionRun.unitId);
      assert.equal(workflowState.stagedOutputFile, productionRun.stagedOutputFile);

      const workUnit = JSON.parse(
        await readFile(join(cwd, ".storyos", "work-units", `${productionRun.unitId}.json`), "utf8")
      ) as {
        id: string;
        stagedOutputFile: string;
        status: string;
      };
      assert.equal(workUnit.id, productionRun.unitId);
      assert.equal(workUnit.status, "awaiting_user_review");
      assert.equal(workUnit.stagedOutputFile, productionRun.stagedOutputFile);

      const stagedOutput = await readFile(join(cwd, productionRun.stagedOutputFile), "utf8");
      const fileName = productionRun.stagedOutputFile.split("/").at(-1) ?? "";
      const fileStem = fileName.replace(/\.md$/, "");
      const heading = stagedOutput.match(/^# (.+)$/m)?.[1];

      assert.equal(heading, fileStem);
      assert.equal(stagedOutput.includes(`title: "${fileStem}"`), true);
      assert.match(stagedOutput, /status: "staged"/);
      assert.match(stagedOutput, /Placeholder production draft/);
      assert.match(stagedOutput, /bible\/style\.md/);
      assert.doesNotMatch(stagedOutput, /status: "canon"/);

      const report = await readFile(join(cwd, productionRun.reportFile), "utf8");
      assert.match(report, /StoryMaker Production Report/);
      assert.match(report, /PendingKnowledgeUpdate:/);
      assert.match(report, /Canon committed: no/);
      assert.match(report, /Steps: 12\/12/);
      assert.match(report, /write-production-report/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("runs produce next and returns JSON without progress text", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);

      const result = await runProduceNext(cwd, ["--json"]);
      const json = parseJsonOutput(result.capture.output.stdout);
      const data = json.data as Record<string, unknown>;

      assert.equal(result.exitCode, 0);
      assert.equal(result.capture.output.stderr, "");
      assert.equal(json.command, "produce next");
      assert.equal(json.status, "awaiting_user_review");
      assert.equal(json.currentUnitId, "chapter-0001");
      assert.match(String(json.stagedOutputFile), /^outputs\/chapters\//);
      assert.match(String(json.reportFile), /^reviews\/run-/);
      assert.match(String(json.nextAction), /Placeholder fallback created/);
      assert.deepEqual(
        (json.acceptance as Record<string, unknown>).question,
        "Approve this chapter?"
      );
      assert.match(
        String((json.acceptance as Record<string, unknown>).draftPath),
        /^outputs\/chapters\//
      );
      assert.match(
        String((json.acceptance as Record<string, unknown>).qualityReportPath),
        /^reviews\/run-/
      );
      assert.equal(data.completedSteps, 12);
      assert.equal(data.totalSteps, 12);
      assert.doesNotMatch(result.capture.output.stdout, /\[1\/12\]/);
      assert.doesNotMatch(result.capture.output.stdout, /StoryMaker produce next/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("continues an idle workflow with real production guidance", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);

      const result = await runContinue(cwd);

      assert.equal(result.exitCode, 0);
      assert.match(result.capture.output.stdout, /StoryMaker continue/);
      assert.doesNotMatch(
        result.capture.output.stdout,
        /\[12\/12\] completed: Update workflow state/
      );
      assert.match(result.capture.output.stdout, /Status: idle/);
      assert.match(result.capture.output.stdout, /Action: show resume guidance/);
      assert.match(result.capture.output.stdout, /Draft: none/);
      assert.match(result.capture.output.stdout, /Report: none/);
      assert.match(result.capture.output.stdout, /produce packet --unit next --json/);
      assert.match(result.capture.output.stdout, /draft submit/);
      assert.match(result.capture.output.stdout, /produce next --placeholder/);

      const workflowState = JSON.parse(
        await readFile(join(cwd, ".storyos", "workflow-state.json"), "utf8")
      ) as {
        currentUnitId: string;
        status: string;
      };
      assert.equal(workflowState.status, "idle");
      assert.equal(workflowState.currentUnitId, undefined);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("continues a ready workflow as JSON with real production guidance", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      await writeFile(
        join(cwd, ".storyos", "workflow-state.json"),
        `${JSON.stringify(
          {
            currentUnitId: "chapter-0001",
            status: "ready_to_produce",
            updatedAt: "2026-06-28T00:00:00.000Z"
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      const result = await runContinue(cwd, ["--json"]);
      const json = parseJsonOutput(result.capture.output.stdout);

      assert.equal(result.exitCode, 0);
      assert.equal(result.capture.output.stderr, "");
      assert.equal(json.command, "continue");
      assert.equal(json.status, "ready_to_produce");
      assert.equal(json.currentUnitId, "chapter-0001");
      assert.equal(json.stagedOutputFile, null);
      assert.equal(json.reportFile, null);
      assert.equal(json.acceptance, null);
      assert.match(String(json.nextAction), /produce packet --unit next --json/);
      assert.match(String(json.nextAction), /draft submit/);
      assert.doesNotMatch(result.capture.output.stdout, /\[1\/12\]/);
      assert.doesNotMatch(result.capture.output.stdout, /StoryMaker continue/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("continues an awaiting-review workflow without creating another run", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      assert.equal((await runProduceNext(cwd)).exitCode, 0);
      const runFilesBefore = await readdir(join(cwd, ".storyos", "runs"));

      const result = await runContinue(cwd);
      const runFilesAfter = await readdir(join(cwd, ".storyos", "runs"));

      assert.equal(result.exitCode, 0);
      assert.deepEqual(runFilesAfter.sort(), runFilesBefore.sort());
      assert.match(result.capture.output.stdout, /StoryMaker continue/);
      assert.match(result.capture.output.stdout, /Status: awaiting_user_review/);
      assert.match(result.capture.output.stdout, /Action: show pending review/);
      assert.match(result.capture.output.stdout, /Draft: outputs\/chapters\//);
      assert.match(result.capture.output.stdout, /Report: reviews\/run-/);
      assert.match(result.capture.output.stdout, /Final acceptance/);
      assert.match(result.capture.output.stdout, /Question: Approve this chapter\?/);
      assert.match(result.capture.output.stdout, /already waiting for review/);
      assert.doesNotMatch(result.capture.output.stdout, /\[1\/12\]/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("continues a producing workflow with resume guidance only", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      await writeFile(
        join(cwd, ".storyos", "workflow-state.json"),
        `${JSON.stringify(
          {
            currentRunId: "run-active",
            currentUnitId: "chapter-0001",
            status: "producing",
            updatedAt: "2026-06-28T00:00:00.000Z"
          },
          null,
          2
        )}\n`,
        "utf8"
      );
      await writeFile(
        join(cwd, ".storyos", "runs", "run-active.json"),
        `${JSON.stringify(
          {
            id: "run-active",
            startedAt: "2026-06-28T00:00:00.000Z",
            status: "running",
            steps: [],
            unitId: "chapter-0001"
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      const result = await runContinue(cwd);
      const runFiles = await readdir(join(cwd, ".storyos", "runs"));

      assert.equal(result.exitCode, 0);
      assert.deepEqual(runFiles, ["run-active.json"]);
      assert.match(result.capture.output.stdout, /Status: producing/);
      assert.match(result.capture.output.stdout, /Action: show resume guidance/);
      assert.match(result.capture.output.stdout, /Latest run: run-active \(running\)/);
      assert.match(result.capture.output.stdout, /inspect \.storyos\/runs\/run-active\.json/);
      assert.doesNotMatch(result.capture.output.stdout, /\[1\/12\]/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("continues a blocked workflow with blocker guidance", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      await writeFile(
        join(cwd, ".storyos", "workflow-state.json"),
        `${JSON.stringify(
          {
            blockedBy: "Rejected chapter-0001: motivation is weak",
            currentUnitId: "chapter-0001",
            lastError: "motivation is weak",
            status: "blocked",
            updatedAt: "2026-06-28T00:00:00.000Z"
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      const result = await runContinue(cwd);

      assert.equal(result.exitCode, 0);
      assert.match(result.capture.output.stdout, /Status: blocked/);
      assert.match(result.capture.output.stdout, /Action: show blocker/);
      assert.match(result.capture.output.stdout, /Resolve blocker/);
      assert.match(result.capture.output.stdout, /motivation is weak/);
      assert.doesNotMatch(result.capture.output.stdout, /\[1\/12\]/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("runs a core workflow from a path with Windows-sensitive characters", async () => {
    const cwd = await createPathStressTempDir();

    try {
      assert.match(cwd, /Windows/);
      assert.match(cwd, /路径/);
      assert.equal((await runInit(cwd)).exitCode, 0);
      assert.equal((await runAdapterInstall(cwd)).exitCode, 0);
      assert.equal((await runDoctor(cwd)).exitCode, 0);
      assert.equal((await runProduceNext(cwd)).exitCode, 0);
      assert.equal((await runApprove(cwd)).exitCode, 0);

      const exported = await runExport(cwd);

      assert.equal(exported.exitCode, 0);
      assert.equal(await pathExists(join(cwd, "exports", "story-export.md")), true);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("keeps the first produced chapter on a four-digit filename", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      assert.equal((await runProduceNext(cwd)).exitCode, 0);

      const workUnit = JSON.parse(
        await readFile(join(cwd, ".storyos", "work-units", "chapter-0001.json"), "utf8")
      ) as {
        displayTitle: string;
        filenameTitle: string;
        stagedOutputFile: string;
      };

      assert.match(workUnit.displayTitle, /0001/);
      assert.match(workUnit.filenameTitle, /0001/);
      assert.match(workUnit.stagedOutputFile, /^outputs\/chapters\/.*0001.*\.md$/);
      assert.equal(await pathExists(join(cwd, workUnit.stagedOutputFile)), true);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("approves an awaiting review unit and commits staged knowledge to canon", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      assert.equal((await runProduceNext(cwd)).exitCode, 0);

      const pendingUpdateFiles = await readdir(join(cwd, ".storyos", "pending-knowledge-updates"));
      const pendingUpdatePath = join(
        cwd,
        ".storyos",
        "pending-knowledge-updates",
        pendingUpdateFiles[0]
      );
      const pendingUpdate = JSON.parse(await readFile(pendingUpdatePath, "utf8")) as {
        factDrafts: Array<Record<string, unknown>>;
        facts: Array<Record<string, unknown>>;
      };
      pendingUpdate.facts = [
        {
          content: "approved silver key fact becomes canon",
          sourceRef: "drafts/chapter-0001.md"
        }
      ];
      pendingUpdate.factDrafts = [
        {
          sourceRef: "drafts/chapter-0001.md",
          summary: "silver key remains hidden beneath the clocktower",
          type: "item_location"
        }
      ];
      await writeFile(pendingUpdatePath, `${JSON.stringify(pendingUpdate, null, 2)}\n`, "utf8");

      const result = await runApprove(cwd);

      assert.equal(result.exitCode, 0);
      assert.match(result.capture.output.stdout, /StoryMaker approve/);
      assert.match(result.capture.output.stdout, /WorkUnit status: final/);
      assert.match(result.capture.output.stdout, /WorkflowState: ready_to_produce/);
      assert.doesNotMatch(result.capture.output.stdout, /StoryMaker produce next/);
      assert.equal(result.capture.output.stderr, "");

      const workflowState = JSON.parse(
        await readFile(join(cwd, ".storyos", "workflow-state.json"), "utf8")
      ) as {
        currentUnitId: string;
        stagedOutputFile?: string;
        status: string;
      };
      assert.equal(workflowState.status, "ready_to_produce");
      assert.equal(workflowState.currentUnitId, "chapter-0002");
      assert.equal("stagedOutputFile" in workflowState, false);

      const workUnit = JSON.parse(
        await readFile(join(cwd, ".storyos", "work-units", "chapter-0001.json"), "utf8")
      ) as {
        outputFile: string;
        stagedOutputFile?: string;
        status: string;
      };
      assert.equal(workUnit.status, "final");
      assert.match(workUnit.outputFile, /^outputs\/chapters\//);
      assert.equal("stagedOutputFile" in workUnit, false);

      const outputMarkdown = await readFile(join(cwd, workUnit.outputFile), "utf8");
      assert.match(outputMarkdown, /status: "canon"/);
      assert.doesNotMatch(outputMarkdown, /status: "staged"/);

      const committedPendingUpdate = JSON.parse(await readFile(pendingUpdatePath, "utf8")) as {
        committedAt: string;
        factDrafts: Array<{ sourceRef?: string; summary?: string }>;
        facts: Array<{ sourceRef?: string }>;
        status: string;
      };
      assert.equal(committedPendingUpdate.status, "committed");
      assert.equal(committedPendingUpdate.committedAt, "2026-06-28T00:00:00.000Z");
      assert.equal(committedPendingUpdate.facts[0].sourceRef, workUnit.outputFile);
      assert.equal(committedPendingUpdate.factDrafts[0].sourceRef, workUnit.outputFile);

      const checkpointFiles = await readdir(join(cwd, ".storyos", "checkpoints"));
      assert.equal(checkpointFiles.length, 1);
      const checkpoint = JSON.parse(
        await readFile(join(cwd, ".storyos", "checkpoints", checkpointFiles[0]), "utf8")
      ) as {
        knowledgeCommit: {
          committedKnowledgeFile: string;
          factDraftCount: number;
          factCount: number;
          pendingKnowledgeUpdateFile: string;
          sourceRef: string;
        };
        reason: string;
        workflowState: {
          status: string;
        };
      };
      assert.equal(checkpoint.reason, "approve");
      assert.equal(checkpoint.workflowState.status, "ready_to_produce");
      assert.equal(
        checkpoint.knowledgeCommit.committedKnowledgeFile,
        "knowledge/committed-updates/chapter-0001.md"
      );
      assert.equal(checkpoint.knowledgeCommit.factCount, 1);
      assert.equal(checkpoint.knowledgeCommit.factDraftCount, 1);
      assert.equal(checkpoint.knowledgeCommit.sourceRef, workUnit.outputFile);

      const committedKnowledgePath = join(cwd, "knowledge", "committed-updates", "chapter-0001.md");
      const committedKnowledge = await readFile(committedKnowledgePath, "utf8");
      assert.match(committedKnowledge, /status: "canon"/);
      assert.match(committedKnowledge, /approved silver key fact becomes canon/);
      assert.match(committedKnowledge, /silver key remains hidden beneath the clocktower/);
      assert.equal(committedKnowledge.includes(`source: ${workUnit.outputFile}`), true);

      assert.equal(
        readIndexedFacts(cwd).some(
          (fact) =>
            fact.source_path === "knowledge/committed-updates/chapter-0001.md" &&
            fact.status === "canon"
        ),
        true
      );

      const searchResult = await runSearch(cwd, "silver key canon");
      assert.equal(searchResult.exitCode, 0);
      assert.match(
        searchResult.capture.output.stdout,
        /knowledge\/committed-updates\/chapter-0001\.md/
      );

      const factDraftSearchResult = await runSearch(cwd, "clocktower");
      assert.equal(factDraftSearchResult.exitCode, 0);
      assert.match(
        factDraftSearchResult.capture.output.stdout,
        /knowledge\/committed-updates\/chapter-0001\.md/
      );
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("approves an awaiting review unit as JSON", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      assert.equal((await runProduceNext(cwd)).exitCode, 0);

      const result = await runApprove(cwd, ["--unit", "1", "--json"]);
      const json = parseJsonOutput(result.capture.output.stdout);
      const data = json.data as Record<string, unknown>;

      assert.equal(result.exitCode, 0);
      assert.equal(result.capture.output.stderr, "");
      assert.equal(json.command, "approve");
      assert.equal(json.status, "ready_to_produce");
      assert.equal(json.currentUnitId, "chapter-0001");
      assert.equal(json.stagedOutputFile, null);
      assert.equal(json.reportFile, null);
      assert.match(String(json.nextAction), /produce packet --unit next --json/);
      assert.match(String(json.nextAction), /draft submit/);
      assert.equal(data.workflowStatus, "ready_to_produce");
      assert.doesNotMatch(result.capture.output.stdout, /StoryMaker approve/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("does not approve a unit when workflow is not awaiting user review", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      assert.equal((await runProduceNext(cwd)).exitCode, 0);
      assert.equal((await runApprove(cwd)).exitCode, 0);

      const result = await runApprove(cwd);

      assert.equal(result.exitCode, 1);
      assert.match(result.capture.output.stderr, /awaiting_user_review/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("continues to the next production run when approve uses --continue", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      assert.equal((await runProduceNext(cwd)).exitCode, 0);

      const result = await runApprove(cwd, ["--unit", "chapter-0001", "--continue"]);

      assert.equal(result.exitCode, 0);
      assert.match(result.capture.output.stdout, /StoryMaker approve/);
      assert.match(
        result.capture.output.stdout,
        /Continuing with storymaker produce next --placeholder/
      );
      assert.match(result.capture.output.stdout, /StoryMaker produce next/);
      assert.match(result.capture.output.stdout, /\[12\/12\] completed: Update workflow state/);

      const runFiles = await readdir(join(cwd, ".storyos", "runs"));
      assert.equal(runFiles.length, 2);

      const firstWorkUnit = JSON.parse(
        await readFile(join(cwd, ".storyos", "work-units", "chapter-0001.json"), "utf8")
      ) as {
        status: string;
      };
      const secondWorkUnit = JSON.parse(
        await readFile(join(cwd, ".storyos", "work-units", "chapter-0002.json"), "utf8")
      ) as {
        status: string;
      };
      assert.equal(firstWorkUnit.status, "final");
      assert.equal(secondWorkUnit.status, "awaiting_user_review");

      const workflowState = JSON.parse(
        await readFile(join(cwd, ".storyos", "workflow-state.json"), "utf8")
      ) as {
        currentUnitId: string;
        status: string;
      };
      assert.equal(workflowState.status, "awaiting_user_review");
      assert.equal(workflowState.currentUnitId, "chapter-0002");

      const pendingUpdates = await Promise.all(
        (await readdir(join(cwd, ".storyos", "pending-knowledge-updates"))).map((fileName) =>
          readFile(join(cwd, ".storyos", "pending-knowledge-updates", fileName), "utf8").then(
            (text) => JSON.parse(text) as { status: string }
          )
        )
      );
      assert.deepEqual(pendingUpdates.map((update) => update.status).sort(), [
        "committed",
        "staged"
      ]);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("rejects an awaiting review unit and preserves the staged draft as a revision", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      assert.equal((await runProduceNext(cwd)).exitCode, 0);

      const pendingUpdateFiles = await readdir(join(cwd, ".storyos", "pending-knowledge-updates"));
      const pendingUpdatePath = join(
        cwd,
        ".storyos",
        "pending-knowledge-updates",
        pendingUpdateFiles[0]
      );
      const pendingUpdate = JSON.parse(await readFile(pendingUpdatePath, "utf8")) as {
        facts: Array<Record<string, unknown>>;
      };
      pendingUpdate.facts = [
        {
          content: "rejected fact must not become canon"
        }
      ];
      await writeFile(pendingUpdatePath, `${JSON.stringify(pendingUpdate, null, 2)}\n`, "utf8");

      const workUnitBefore = JSON.parse(
        await readFile(join(cwd, ".storyos", "work-units", "chapter-0001.json"), "utf8")
      ) as {
        stagedOutputFile: string;
      };

      const result = await runReject(cwd, ["--unit", "chapter-0001", "--reason", "pace too slow"]);

      assert.equal(result.exitCode, 0);
      assert.match(result.capture.output.stdout, /StoryMaker reject/);
      assert.match(result.capture.output.stdout, /WorkUnit status: rejected/);
      assert.match(result.capture.output.stdout, /WorkflowState: blocked/);
      assert.equal(result.capture.output.stderr, "");

      assert.equal(await pathExists(join(cwd, workUnitBefore.stagedOutputFile)), false);

      const workUnit = JSON.parse(
        await readFile(join(cwd, ".storyos", "work-units", "chapter-0001.json"), "utf8")
      ) as {
        revisionDir: string;
        stagedOutputFile?: string;
        status: string;
      };
      assert.equal(workUnit.status, "rejected");
      assert.equal(workUnit.revisionDir, "units/chapters/chapter-0001/revisions");
      assert.equal("stagedOutputFile" in workUnit, false);

      const revisionFiles = await readdir(join(cwd, workUnit.revisionDir));
      const rejectedMarkdownName = revisionFiles.find((fileName) => fileName.endsWith(".md"));
      const rejectReasonName = revisionFiles.find((fileName) => fileName.endsWith(".json"));
      assert.notEqual(rejectedMarkdownName, undefined);
      assert.notEqual(rejectReasonName, undefined);

      const rejectedMarkdown = await readFile(
        join(cwd, workUnit.revisionDir, rejectedMarkdownName ?? ""),
        "utf8"
      );
      assert.match(rejectedMarkdown, /status: "rejected"/);
      assert.match(rejectedMarkdown, /reject_reason: "pace too slow"/);
      assert.match(rejectedMarkdown, /Placeholder production draft/);

      const rejectReason = JSON.parse(
        await readFile(join(cwd, workUnit.revisionDir, rejectReasonName ?? ""), "utf8")
      ) as {
        originalStagedOutputFile: string;
        reason: string;
        unitId: string;
      };
      assert.equal(rejectReason.reason, "pace too slow");
      assert.equal(rejectReason.unitId, "chapter-0001");
      assert.equal(rejectReason.originalStagedOutputFile, workUnitBefore.stagedOutputFile);

      const rejectedPendingUpdate = JSON.parse(await readFile(pendingUpdatePath, "utf8")) as {
        rejectedAt: string;
        status: string;
      };
      assert.equal(rejectedPendingUpdate.status, "rejected");
      assert.equal(rejectedPendingUpdate.rejectedAt, "2026-06-28T00:00:00.000Z");

      const workflowState = JSON.parse(
        await readFile(join(cwd, ".storyos", "workflow-state.json"), "utf8")
      ) as {
        blockedBy: string;
        currentUnitId: string;
        lastError: string;
        status: string;
      };
      assert.equal(workflowState.status, "blocked");
      assert.equal(workflowState.currentUnitId, "chapter-0001");
      assert.match(workflowState.blockedBy, /pace too slow/);
      assert.equal(workflowState.lastError, "pace too slow");

      assert.equal(await pathExists(join(cwd, "knowledge", "committed-updates")), false);
      assert.equal(
        readIndexedFacts(cwd).some((fact) => fact.source_path.includes("committed-updates")),
        false
      );
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("rejects an awaiting review unit as JSON", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      assert.equal((await runProduceNext(cwd)).exitCode, 0);

      const result = await runReject(cwd, ["--unit", "1", "--reason", "pace too slow", "--json"]);
      const json = parseJsonOutput(result.capture.output.stdout);
      const data = json.data as Record<string, unknown>;

      assert.equal(result.exitCode, 0);
      assert.equal(result.capture.output.stderr, "");
      assert.equal(json.command, "reject");
      assert.equal(json.status, "blocked");
      assert.equal(json.currentUnitId, "chapter-0001");
      assert.equal(json.stagedOutputFile, null);
      assert.equal(json.reportFile, null);
      assert.match(String(json.nextAction), /Revise the rejected unit/);
      assert.equal(data.workflowStatus, "blocked");
      assert.doesNotMatch(result.capture.output.stdout, /StoryMaker reject/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("does not reject a unit when workflow is not awaiting user review", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);

      const result = await runReject(cwd);

      assert.equal(result.exitCode, 1);
      assert.match(result.capture.output.stderr, /awaiting_user_review/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("requires a reason when rejecting a unit", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      assert.equal((await runProduceNext(cwd)).exitCode, 0);

      const result = await runReject(cwd, ["--unit", "1"]);

      assert.equal(result.exitCode, 1);
      assert.match(result.capture.output.stderr, /--reason/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("revises a rejected unit back to awaiting user review", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      assert.equal((await runProduceNext(cwd)).exitCode, 0);
      const workUnitBeforeReject = JSON.parse(
        await readFile(join(cwd, ".storyos", "work-units", "chapter-0001.json"), "utf8")
      ) as {
        stagedOutputFile: string;
      };
      await writeFile(
        join(cwd, workUnitBeforeReject.stagedOutputFile),
        `${await readFile(
          join(cwd, workUnitBeforeReject.stagedOutputFile),
          "utf8"
        )}\n\nRejected-only xqzmrp marker.\n`,
        "utf8"
      );
      assert.equal(
        (await runReject(cwd, ["--unit", "1", "--reason", "needs a stronger hook"])).exitCode,
        0
      );

      const revisionDir = join(cwd, "units", "chapters", "chapter-0001", "revisions");
      const revisionFilesBefore = await readdir(revisionDir);

      const result = await runRevise(cwd, ["--unit", "chapter-0001", "--mode", "add_hook"]);

      assert.equal(result.exitCode, 0);
      assert.match(result.capture.output.stdout, /StoryMaker revise/);
      assert.match(result.capture.output.stdout, /Mode: add_hook/);
      assert.match(result.capture.output.stdout, /WorkflowState: awaiting_user_review/);
      assert.equal(result.capture.output.stderr, "");
      assert.deepEqual((await readdir(revisionDir)).sort(), revisionFilesBefore.sort());

      const workUnit = JSON.parse(
        await readFile(join(cwd, ".storyos", "work-units", "chapter-0001.json"), "utf8")
      ) as {
        revisionDir: string;
        stagedOutputFile: string;
        status: string;
      };
      assert.equal(workUnit.status, "awaiting_user_review");
      assert.equal(workUnit.revisionDir, "units/chapters/chapter-0001/revisions");
      assert.match(workUnit.stagedOutputFile, /^outputs\/chapters\//);

      const stagedOutput = await readFile(join(cwd, workUnit.stagedOutputFile), "utf8");
      assert.match(stagedOutput, /status: "staged"/);
      assert.match(stagedOutput, /revision_mode: "add_hook"/);
      assert.match(stagedOutput, /needs a stronger hook/);
      assert.doesNotMatch(stagedOutput, /status: "canon"/);

      const workflowState = JSON.parse(
        await readFile(join(cwd, ".storyos", "workflow-state.json"), "utf8")
      ) as {
        currentUnitId: string;
        stagedOutputFile: string;
        status: string;
      };
      assert.equal(workflowState.status, "awaiting_user_review");
      assert.equal(workflowState.currentUnitId, "chapter-0001");
      assert.equal(workflowState.stagedOutputFile, workUnit.stagedOutputFile);

      const pendingUpdates = await Promise.all(
        (await readdir(join(cwd, ".storyos", "pending-knowledge-updates"))).map((fileName) =>
          readFile(join(cwd, ".storyos", "pending-knowledge-updates", fileName), "utf8").then(
            (text) =>
              JSON.parse(text) as {
                facts: Array<{ content?: string }>;
                status: string;
              }
          )
        )
      );
      assert.deepEqual(pendingUpdates.map((update) => update.status).sort(), [
        "rejected",
        "staged"
      ]);
      assert.equal(
        pendingUpdates.some((update) =>
          update.facts.some((fact) => fact.content?.includes("add_hook"))
        ),
        true
      );

      assert.equal((await runIndex(cwd, ["rebuild", "--include-staged"])).exitCode, 0);

      const defaultSearch = await runSearch(cwd, "deterministic revision");
      assert.equal(defaultSearch.exitCode, 0);
      assert.match(defaultSearch.capture.output.stdout, /No results/);

      const stagedSearch = await runSearch(cwd, "deterministic revision", ["--include-staged"]);
      assert.equal(stagedSearch.exitCode, 0);
      assert.match(stagedSearch.capture.output.stdout, /outputs\/chapters\//);

      const rejectedSearch = await runSearch(cwd, "xqzmrp", ["--include-staged"]);
      assert.equal(rejectedSearch.exitCode, 0);
      assert.match(rejectedSearch.capture.output.stdout, /No results/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("points continue and resume at a fresh revised quality report", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);

      const sourceFile = join(cwd, "draft-for-revision.md");
      await writeFile(
        sourceFile,
        `# 临时标题

银钥匙在雨里发亮，林夏突然意识到地下室不是出口。这个线索需要被记录。

\`\`\`storymaker-facts
{
  "factDrafts": [
    {
      "type": "character_state",
      "subject": "林夏",
      "key": "location",
      "value": "地下室",
      "summary": "林夏发现地下室不是出口。",
      "confidence": "high"
    }
  ]
}
\`\`\`
`,
        "utf8"
      );

      const submitResult = await runDraftSubmit(cwd, [
        "--unit",
        "chapter-0001",
        "--from",
        sourceFile,
        "--title",
        "雨夜钥匙",
        "--json"
      ]);
      const submitJson = parseJsonOutput(submitResult.capture.output.stdout);
      const submitReportFile = String(submitJson.reportFile);

      assert.equal(submitResult.exitCode, 0);
      assert.match(submitReportFile, /^reviews\/draft-submit-/);

      assert.equal(
        (await runReject(cwd, ["--unit", "chapter-0001", "--reason", "needs a stronger hook"]))
          .exitCode,
        0
      );

      const reviseResult = await runRevise(cwd, ["--unit", "chapter-0001", "--mode", "add_hook"]);

      assert.equal(reviseResult.exitCode, 0);
      assert.match(reviseResult.capture.output.stdout, /Report: reviews\/revise-/);
      assert.match(reviseResult.capture.output.stdout, /ProductionRun: \.storyos\/runs\/revise-/);

      const workflowState = JSON.parse(
        await readFile(join(cwd, ".storyos", "workflow-state.json"), "utf8")
      ) as {
        currentRunId: string;
        currentUnitId: string;
        stagedOutputFile: string;
        status: string;
      };
      assert.equal(workflowState.status, "awaiting_user_review");
      assert.equal(workflowState.currentUnitId, "chapter-0001");
      assert.match(workflowState.currentRunId, /^revise-/);

      const revisedRun = JSON.parse(
        await readFile(join(cwd, ".storyos", "runs", `${workflowState.currentRunId}.json`), "utf8")
      ) as {
        pendingKnowledgeUpdateFile: string;
        quality: {
          reportFile: string;
          totalFindings: number;
        };
        reportFile: string;
        stagedOutputFile: string;
        status: string;
        steps: Array<{
          id: string;
          reportFile?: string;
        }>;
        unitId: string;
      };
      assert.equal(revisedRun.status, "completed");
      assert.equal(revisedRun.unitId, "chapter-0001");
      assert.equal(revisedRun.stagedOutputFile, workflowState.stagedOutputFile);
      assert.match(revisedRun.reportFile, /^reviews\/revise-/);
      assert.notEqual(revisedRun.reportFile, submitReportFile);
      assert.equal(revisedRun.quality.reportFile, revisedRun.reportFile);
      assert.equal(
        revisedRun.steps.some(
          (step) => step.id === "run-quality-gates" && step.reportFile === revisedRun.reportFile
        ),
        true
      );

      const continueResult = await runContinue(cwd, ["--json"]);
      const continueJson = parseJsonOutput(continueResult.capture.output.stdout);
      assert.equal(continueResult.exitCode, 0);
      assert.equal(continueJson.status, "awaiting_user_review");
      assert.equal(continueJson.reportFile, revisedRun.reportFile);
      assert.equal(continueJson.stagedOutputFile, workflowState.stagedOutputFile);
      assert.notEqual(continueJson.reportFile, submitReportFile);

      const resumeCapture = createCapture();
      const resumeExitCode = await runStoryctl(["resume"], resumeCapture.io, {
        cwd,
        now: "2026-06-28T00:00:00.000Z"
      });
      assert.equal(resumeExitCode, 0);
      assert.match(
        resumeCapture.output.stdout,
        new RegExp(`Latest run: ${workflowState.currentRunId} \\(completed\\)`)
      );
      assert.match(
        resumeCapture.output.stdout,
        new RegExp(
          `Latest run report: ${revisedRun.reportFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`
        )
      );

      const revisedReport = await readFile(join(cwd, revisedRun.reportFile), "utf8");
      assert.match(revisedReport, /StoryMaker Draft Submit Quality Report/);
      assert.match(revisedReport, /Run: revise-/);
      assert.match(revisedReport, /Source file: outputs\/chapters\//);
      assert.match(revisedReport, /Staged output: outputs\/chapters\//);

      const pendingUpdates = await Promise.all(
        (await readdir(join(cwd, ".storyos", "pending-knowledge-updates"))).map((fileName) =>
          readFile(join(cwd, ".storyos", "pending-knowledge-updates", fileName), "utf8").then(
            (text) =>
              JSON.parse(text) as {
                status: string;
              }
          )
        )
      );
      assert.deepEqual(pendingUpdates.map((update) => update.status).sort(), [
        "rejected",
        "staged"
      ]);
      assert.equal(await pathExists(join(cwd, "knowledge", "committed-updates")), false);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("rejects invalid revise modes", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);

      const result = await runRevise(cwd, ["--unit", "1", "--mode", "tiny"]);

      assert.equal(result.exitCode, 1);
      assert.match(result.capture.output.stderr, /Invalid revise mode/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("does not revise a unit that is not rejected", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      assert.equal((await runProduceNext(cwd)).exitCode, 0);

      const result = await runRevise(cwd);

      assert.equal(result.exitCode, 1);
      assert.match(result.capture.output.stderr, /WorkUnit status is awaiting_user_review/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("renames an awaiting-review staged chapter and updates workflow references", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      assert.equal((await runProduceNext(cwd)).exitCode, 0);

      const workUnitBefore = JSON.parse(
        await readFile(join(cwd, ".storyos", "work-units", "chapter-0001.json"), "utf8")
      ) as {
        stagedOutputFile: string;
      };
      const pendingUpdateFiles = await readdir(join(cwd, ".storyos", "pending-knowledge-updates"));
      const pendingUpdatePath = join(
        cwd,
        ".storyos",
        "pending-knowledge-updates",
        pendingUpdateFiles[0]
      );
      const pendingUpdate = JSON.parse(await readFile(pendingUpdatePath, "utf8")) as {
        facts: Array<Record<string, unknown>>;
      };
      pendingUpdate.facts = [
        {
          content: "renamed staged source",
          sourceRef: workUnitBefore.stagedOutputFile
        }
      ];
      await writeFile(pendingUpdatePath, `${JSON.stringify(pendingUpdate, null, 2)}\n`, "utf8");
      assert.equal((await runIndex(cwd, ["--include-staged"])).exitCode, 0);
      assert.equal(
        readIndexedFacts(cwd).some((fact) => fact.source_path === workUnitBefore.stagedOutputFile),
        true
      );

      const result = await runRename(cwd, ["--unit", "1", "--title", "Rain Hook"]);

      assert.equal(result.exitCode, 0);
      assert.match(result.capture.output.stdout, /StoryMaker rename/);
      assert.match(result.capture.output.stdout, /Title: Rain Hook/);
      assert.match(result.capture.output.stdout, /WorkUnit status: awaiting_user_review/);
      assert.equal(result.capture.output.stderr, "");

      const workUnit = JSON.parse(
        await readFile(join(cwd, ".storyos", "work-units", "chapter-0001.json"), "utf8")
      ) as {
        displayTitle: string;
        filenameTitle: string;
        stagedOutputFile: string;
        title: string;
      };
      assert.equal(workUnit.title, "Rain Hook");
      assert.match(workUnit.displayTitle, /Rain Hook/);
      assert.match(workUnit.filenameTitle, /Rain Hook/);
      assert.notEqual(workUnit.stagedOutputFile, workUnitBefore.stagedOutputFile);
      assert.match(workUnit.stagedOutputFile, /^outputs\/chapters\//);
      assert.equal(await pathExists(join(cwd, workUnitBefore.stagedOutputFile)), false);
      assert.equal(await pathExists(join(cwd, workUnit.stagedOutputFile)), true);

      const stagedOutput = await readFile(join(cwd, workUnit.stagedOutputFile), "utf8");
      assert.match(stagedOutput, /status: "staged"/);
      assert.match(stagedOutput, /title: ".*Rain Hook/);
      assert.match(stagedOutput, /^# .*Rain Hook/m);

      const workflowState = JSON.parse(
        await readFile(join(cwd, ".storyos", "workflow-state.json"), "utf8")
      ) as {
        currentUnit: string;
        currentUnitId: string;
        stagedOutputFile: string;
        status: string;
      };
      assert.equal(workflowState.status, "awaiting_user_review");
      assert.equal(workflowState.currentUnitId, "chapter-0001");
      assert.match(workflowState.currentUnit, /Rain Hook/);
      assert.equal(workflowState.stagedOutputFile, workUnit.stagedOutputFile);

      const runFiles = await readdir(join(cwd, ".storyos", "runs"));
      const productionRun = JSON.parse(
        await readFile(join(cwd, ".storyos", "runs", runFiles[0]), "utf8")
      ) as {
        stagedOutputFile: string;
      };
      assert.equal(productionRun.stagedOutputFile, workUnit.stagedOutputFile);

      const rewrittenPendingUpdate = JSON.parse(await readFile(pendingUpdatePath, "utf8")) as {
        facts: Array<{ sourceRef?: string }>;
      };
      assert.equal(rewrittenPendingUpdate.facts[0].sourceRef, workUnit.stagedOutputFile);
      assert.equal(
        readIndexedFacts(cwd).some((fact) => fact.source_path === workUnitBefore.stagedOutputFile),
        false
      );
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("indexes a renamed staged chapter with a Chinese filename", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      assert.equal((await runProduceNext(cwd)).exitCode, 0);

      const result = await runRename(cwd, ["--unit", "1", "--title", "雨夜来客"]);

      assert.equal(result.exitCode, 0);

      const workUnit = JSON.parse(
        await readFile(join(cwd, ".storyos", "work-units", "chapter-0001.json"), "utf8")
      ) as {
        stagedOutputFile: string;
        title: string;
      };
      assert.equal(workUnit.title, "雨夜来客");
      assert.match(workUnit.stagedOutputFile, /雨夜来客/);
      assert.equal(await pathExists(join(cwd, workUnit.stagedOutputFile)), true);

      assert.equal((await runIndex(cwd, ["--include-staged"])).exitCode, 0);
      assert.equal(
        readIndexedFacts(cwd).some((fact) => fact.source_path === workUnit.stagedOutputFile),
        true
      );
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("renames an approved chapter output and refreshes the canon index", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      assert.equal((await runProduceNext(cwd)).exitCode, 0);
      assert.equal((await runApprove(cwd)).exitCode, 0);

      const workUnitBefore = JSON.parse(
        await readFile(join(cwd, ".storyos", "work-units", "chapter-0001.json"), "utf8")
      ) as {
        outputFile: string;
      };

      const result = await runRename(cwd, ["--unit", "chapter-0001", "--title", "Final Hook"]);

      assert.equal(result.exitCode, 0);
      assert.match(result.capture.output.stdout, /StoryMaker rename/);
      assert.match(result.capture.output.stdout, /WorkUnit status: final/);
      assert.equal(result.capture.output.stderr, "");

      const workUnit = JSON.parse(
        await readFile(join(cwd, ".storyos", "work-units", "chapter-0001.json"), "utf8")
      ) as {
        displayTitle: string;
        filenameTitle: string;
        outputFile: string;
        stagedOutputFile?: string;
        title: string;
      };
      assert.equal(workUnit.title, "Final Hook");
      assert.match(workUnit.displayTitle, /Final Hook/);
      assert.match(workUnit.filenameTitle, /Final Hook/);
      assert.equal("stagedOutputFile" in workUnit, false);
      assert.notEqual(workUnit.outputFile, workUnitBefore.outputFile);
      assert.equal(await pathExists(join(cwd, workUnitBefore.outputFile)), false);
      assert.equal(await pathExists(join(cwd, workUnit.outputFile)), true);

      const outputMarkdown = await readFile(join(cwd, workUnit.outputFile), "utf8");
      assert.match(outputMarkdown, /status: "canon"/);
      assert.match(outputMarkdown, /title: ".*Final Hook/);
      assert.match(outputMarkdown, /^# .*Final Hook/m);

      const workflowState = JSON.parse(
        await readFile(join(cwd, ".storyos", "workflow-state.json"), "utf8")
      ) as {
        currentUnitId: string;
        stagedOutputFile?: string;
        status: string;
      };
      assert.equal(workflowState.status, "ready_to_produce");
      assert.equal(workflowState.currentUnitId, "chapter-0002");
      assert.equal("stagedOutputFile" in workflowState, false);

      assert.deepEqual(readIndexedFacts(cwd), [
        {
          source_path: "knowledge/committed-updates/chapter-0001.md",
          status: "canon"
        },
        {
          source_path: workUnit.outputFile,
          status: "canon"
        }
      ]);
      assert.equal(
        readIndexedFacts(cwd).some((fact) => fact.source_path === workUnitBefore.outputFile),
        false
      );

      const committedKnowledge = await readFile(
        join(cwd, "knowledge", "committed-updates", "chapter-0001.md"),
        "utf8"
      );
      assert.match(committedKnowledge, /Knowledge Update: .*Final Hook/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("requires a title when renaming a unit", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);

      const result = await runRename(cwd, ["--unit", "1"]);

      assert.equal(result.exitCode, 1);
      assert.match(result.capture.output.stderr, /--title/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("replans a range and writes a pending change log", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      const workflowStateBefore = await readFile(
        join(cwd, ".storyos", "workflow-state.json"),
        "utf8"
      );

      const result = await runReplan(cwd);

      assert.equal(result.exitCode, 0);
      assert.match(result.capture.output.stdout, /StoryMaker replan/);
      assert.match(result.capture.output.stdout, /Range: 21-30/);
      assert.match(result.capture.output.stdout, /Status: pending user confirmation/);
      assert.match(result.capture.output.stdout, /Option 1: /);
      assert.match(result.capture.output.stdout, /Option 2: /);
      assert.match(result.capture.output.stdout, /Option 3: /);
      assert.match(result.capture.output.stdout, /Advantages:/);
      assert.match(result.capture.output.stdout, /Risks:/);
      assert.match(result.capture.output.stdout, /Reader expectations:/);
      assert.match(result.capture.output.stdout, /user confirmation/);
      assert.equal(result.capture.output.stderr, "");

      const changeLog = await readFile(join(cwd, "plans", "change-log.md"), "utf8");
      assert.match(changeLog, /## Replan 21-30 - 2026-06-28T00:00:00\.000Z/);
      assert.match(changeLog, /Status: pending user confirmation/);
      assert.match(changeLog, /Major direction changes are not applied automatically/);
      assert.match(changeLog, /Option 1: /);
      assert.match(changeLog, /Option 2: /);
      assert.match(changeLog, /Option 3: /);
      assert.match(changeLog, /Advantages:/);
      assert.match(changeLog, /Risks:/);
      assert.match(changeLog, /Reader expectations:/);
      assert.equal(
        await readFile(join(cwd, ".storyos", "workflow-state.json"), "utf8"),
        workflowStateBefore
      );
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("rejects invalid replan ranges", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);

      const result = await runReplan(cwd, ["--range", "30-21"]);

      assert.equal(result.exitCode, 1);
      assert.equal(result.capture.output.stdout, "");
      assert.match(result.capture.output.stderr, /Invalid replan range/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("exports final chapters by default and staged chapters only when requested", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      assert.equal((await runProduceNext(cwd)).exitCode, 0);
      assert.equal((await runApprove(cwd)).exitCode, 0);
      assert.equal((await runProduceNext(cwd)).exitCode, 0);

      const finalWorkUnit = JSON.parse(
        await readFile(join(cwd, ".storyos", "work-units", "chapter-0001.json"), "utf8")
      ) as {
        outputFile: string;
      };
      const stagedWorkUnit = JSON.parse(
        await readFile(join(cwd, ".storyos", "work-units", "chapter-0002.json"), "utf8")
      ) as {
        stagedOutputFile: string;
      };

      await writeFile(
        join(cwd, finalWorkUnit.outputFile),
        '---\nstatus: "canon"\n---\n# Chapter 0001\n\nFinal body.\n',
        "utf8"
      );
      await writeFile(
        join(cwd, stagedWorkUnit.stagedOutputFile),
        '---\nstatus: "staged"\n---\n# Chapter 0002\n\nStaged body.\n',
        "utf8"
      );

      const defaultResult = await runExport(cwd);

      assert.equal(defaultResult.exitCode, 0);
      assert.match(defaultResult.capture.output.stdout, /StoryMaker export/);
      assert.match(defaultResult.capture.output.stdout, /Format: md/);
      assert.match(defaultResult.capture.output.stdout, /Output: exports\/story-export\.md/);
      assert.match(defaultResult.capture.output.stdout, /Chapters exported: 1/);
      assert.match(defaultResult.capture.output.stdout, /Chapters skipped: 1/);
      assert.equal(defaultResult.capture.output.stderr, "");

      const defaultExport = await readFile(join(cwd, "exports", "story-export.md"), "utf8");
      assert.match(defaultExport, /^# Chapter 0001/m);
      assert.doesNotMatch(defaultExport, /Chapter 0002/);

      const stagedResult = await runExport(cwd, ["--format=md", "--include-staged"]);

      assert.equal(stagedResult.exitCode, 0);
      assert.match(stagedResult.capture.output.stdout, /Chapters exported: 2/);
      assert.match(stagedResult.capture.output.stdout, /Chapters skipped: 0/);

      const stagedExport = await readFile(join(cwd, "exports", "story-export.md"), "utf8");
      assert.match(stagedExport, /# Chapter 0001[\s\S]+# Chapter 0002/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("accepts txt docx and epub export formats", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      assert.equal((await runProduceNext(cwd)).exitCode, 0);
      assert.equal((await runApprove(cwd)).exitCode, 0);

      const workUnit = JSON.parse(
        await readFile(join(cwd, ".storyos", "work-units", "chapter-0001.json"), "utf8")
      ) as {
        outputFile: string;
      };
      await writeFile(
        join(cwd, workUnit.outputFile),
        '---\nstatus: "canon"\n---\n# Chapter 0001\n\nFinal body.\n',
        "utf8"
      );

      const txtResult = await runExport(cwd, ["--format", "txt"]);
      const docxResult = await runExport(cwd, ["--format", "docx"]);
      const epubResult = await runExport(cwd, ["--format", "epub"]);

      assert.equal(txtResult.exitCode, 0);
      assert.equal(docxResult.exitCode, 0);
      assert.equal(epubResult.exitCode, 0);
      assert.match(txtResult.capture.output.stdout, /Fidelity: real/);
      assert.doesNotMatch(txtResult.capture.output.stdout, /Warning: .*placeholder/i);
      assert.match(docxResult.capture.output.stdout, /Fidelity: placeholder/);
      assert.match(docxResult.capture.output.stdout, /Warning: docx export is a placeholder/);
      assert.match(epubResult.capture.output.stdout, /Fidelity: placeholder/);
      assert.match(epubResult.capture.output.stdout, /Warning: epub export is a placeholder/);

      const txt = await readFile(join(cwd, "exports", "story-export.txt"), "utf8");
      const docx = await readFile(join(cwd, "exports", "story-export.docx"), "utf8");
      const epub = await readFile(join(cwd, "exports", "story-export.epub"), "utf8");

      assert.match(txt, /^Chapter 0001/m);
      assert.doesNotMatch(txt, /^# Chapter 0001/m);
      assert.match(docx, /StoryMaker docx export placeholder/);
      assert.match(epub, /StoryMaker epub export placeholder/);
      assert.match(docx, /not a real docx\/epub package/);
      assert.match(epub, /not a real docx\/epub package/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("rejects invalid export formats", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);

      const result = await runExport(cwd, ["--format", "pdf"]);

      assert.equal(result.exitCode, 1);
      assert.match(result.capture.output.stderr, /Invalid export format/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("imports old project chapters into final WorkUnits knowledge and index", async () => {
    const cwd = await createTempDir();
    const oldProject = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      await writeFile(
        join(oldProject, "02-second.md"),
        "# Second Imported\n\nSecond body with blue lantern.\n",
        "utf8"
      );
      await writeFile(
        join(oldProject, "01-first.md"),
        "# First Imported\n\nFirst body with red door.\n",
        "utf8"
      );

      const result = await runImportChapters(cwd, ["--from", oldProject]);

      assert.equal(result.exitCode, 0);
      assert.match(result.capture.output.stdout, /StoryMaker import chapters/);
      assert.match(result.capture.output.stdout, /Imported chapters: 2/);
      assert.match(result.capture.output.stdout, /Knowledge: knowledge\/imported-initial\.md/);
      assert.match(result.capture.output.stdout, /Index: 3 files indexed/);
      assert.equal(result.capture.output.stderr, "");

      const firstWorkUnit = JSON.parse(
        await readFile(join(cwd, ".storyos", "work-units", "chapter-0001.json"), "utf8")
      ) as {
        outputFile: string;
        status: string;
        title: string;
      };
      const secondWorkUnit = JSON.parse(
        await readFile(join(cwd, ".storyos", "work-units", "chapter-0002.json"), "utf8")
      ) as {
        outputFile: string;
        status: string;
        title: string;
      };

      assert.equal(firstWorkUnit.status, "final");
      assert.equal(secondWorkUnit.status, "final");
      assert.equal(firstWorkUnit.title, "First Imported");
      assert.equal(secondWorkUnit.title, "Second Imported");
      assert.match(firstWorkUnit.outputFile, /^outputs\/chapters\//);
      assert.match(secondWorkUnit.outputFile, /^outputs\/chapters\//);

      const firstOutput = await readFile(join(cwd, firstWorkUnit.outputFile), "utf8");
      const secondOutput = await readFile(join(cwd, secondWorkUnit.outputFile), "utf8");
      const knowledge = await readFile(join(cwd, "knowledge", "imported-initial.md"), "utf8");

      assert.match(firstOutput, /status: "canon"/);
      assert.match(firstOutput, /^# First Imported/m);
      assert.match(secondOutput, /status: "canon"/);
      assert.match(secondOutput, /^# Second Imported/m);
      assert.match(knowledge, /status: "canon"/);
      assert.match(knowledge, /chapter-0001/);
      assert.match(knowledge, /chapter-0002/);

      assert.deepEqual(
        readIndexedFacts(cwd).map((fact) => fact.status),
        ["canon", "canon", "canon"]
      );

      const search = await runSearch(cwd, "red door");
      assert.equal(search.exitCode, 0);
      assert.match(search.capture.output.stdout, /First Imported/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
      await rm(oldProject, {
        force: true,
        recursive: true
      });
    }
  });

  it("requires a source directory when importing chapters", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);

      const result = await runImportChapters(cwd, []);

      assert.equal(result.exitCode, 1);
      assert.match(result.capture.output.stderr, /--from/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("returns a clear error outside a StoryOS project for produce next", async () => {
    const cwd = await createTempDir();

    try {
      const result = await runProduceNext(cwd);

      assert.equal(result.exitCode, 1);
      assert.match(result.capture.output.stderr, /Not a StoryOS project/);
      assert.match(result.capture.output.stderr, /storyctl init/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });

  it("asks for index rebuild when searching without story.db", async () => {
    const cwd = await createTempDir();

    try {
      assert.equal((await runInit(cwd)).exitCode, 0);
      await rm(join(cwd, ".storyos", "story.db"), {
        force: true
      });

      const result = await runSearch(cwd, "主角");

      assert.equal(result.exitCode, 1);
      assert.match(result.capture.output.stderr, /storyctl index rebuild/);
    } finally {
      await rm(cwd, {
        force: true,
        recursive: true
      });
    }
  });
});
