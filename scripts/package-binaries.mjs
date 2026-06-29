import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(rootDir, "bin", "platform");
const cliEntryFromOutput = "../../packages/cli/dist/index.js";

const launcherSource = (platformName) => `#!/usr/bin/env node
import { main } from "${cliEntryFromOutput}";

process.env.STORYOS_PACKAGED_PLATFORM = "${platformName}";
await main(process.argv.slice(2));
`;

await mkdir(outputDir, {
  recursive: true
});

await writeFile(join(outputDir, "storyctl-macos"), launcherSource("macos"), {
  encoding: "utf8",
  mode: 0o755
});
await writeFile(join(outputDir, "storyctl-linux"), launcherSource("linux"), {
  encoding: "utf8",
  mode: 0o755
});

const csharpSource = String.raw`
using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Text;

public static class StoryctlLauncher
{
    public static int Main(string[] args)
    {
        string exeDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
        string cliEntry = Path.GetFullPath(Path.Combine(exeDir, "..", "..", "packages", "cli", "dist", "index.js"));
        string arguments = Quote(cliEntry);

        foreach (string arg in args)
        {
            arguments += " " + Quote(arg);
        }

        try
        {
            Process process = new Process();
            process.StartInfo.FileName = "node";
            process.StartInfo.Arguments = arguments;
            process.StartInfo.UseShellExecute = false;
            process.Start();
            process.WaitForExit();
            return process.ExitCode;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine("StoryMaker platform launcher requires Node.js 24 or newer on PATH.");
            Console.Error.WriteLine(error.Message);
            return 1;
        }
    }

    private static string Quote(string value)
    {
        if (value.Length == 0)
        {
            return "\"\"";
        }

        if (value.IndexOfAny(new char[] { ' ', '\t', '\n', '\v', '"' }) < 0)
        {
            return value;
        }

        StringBuilder result = new StringBuilder();
        result.Append('"');

        int backslashes = 0;
        foreach (char character in value)
        {
            if (character == '\\')
            {
                backslashes++;
                continue;
            }

            if (character == '"')
            {
                result.Append('\\', backslashes * 2 + 1);
                result.Append('"');
                backslashes = 0;
                continue;
            }

            if (backslashes > 0)
            {
                result.Append('\\', backslashes);
                backslashes = 0;
            }

            result.Append(character);
        }

        if (backslashes > 0)
        {
            result.Append('\\', backslashes * 2);
        }

        result.Append('"');
        return result.ToString();
    }
}
`;

if (process.platform === "win32") {
  const tempDir = await mkdtemp(join(tmpdir(), "storymaker-launcher-"));
  const sourcePath = join(tempDir, "StoryctlLauncher.cs");
  const outputPath = join(outputDir, "storyctl.exe");

  try {
    await writeFile(sourcePath, csharpSource, "utf8");
    const compile = spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `Add-Type -Path '${sourcePath.replaceAll("'", "''")}' -OutputAssembly '${outputPath.replaceAll("'", "''")}' -OutputType ConsoleApplication`
      ],
      {
        cwd: rootDir,
        encoding: "utf8"
      }
    );

    if (compile.status !== 0) {
      throw new Error(`Failed to compile storyctl.exe.\n${compile.stdout}\n${compile.stderr}`);
    }
  } finally {
    await rm(tempDir, {
      force: true,
      recursive: true
    });
  }
} else {
  await writeFile(join(outputDir, "storyctl.exe"), launcherSource("windows"), {
    encoding: "utf8",
    mode: 0o755
  });
}

await writeFile(
  join(outputDir, "README.md"),
  `# StoryMaker 平台启动器

由 \`corepack pnpm package:binaries\` 生成。该命令写入的是依赖 Node.js 的启动器，不是原生单文件二进制。

产物：

- \`storyctl.exe\`
- \`storyctl-macos\`
- \`storyctl-linux\`

这些文件保留 \`storyctl\` 文件名，用于兼容已有自动化。它们不内置 Node.js，也不包含 CLI 源码。运行时要求系统 \`PATH\` 中存在 Node.js 24 或更新版本，并执行 \`packages/cli/dist/index.js\`。

生成的 \`storyctl.exe\`、\`storyctl-macos\`、\`storyctl-linux\` 不进入源码仓库；发布或本地验证时重新运行生成命令即可。

Unix 启动器由生成脚本以可执行权限写入；如果通过压缩包或非 Git 渠道复制后权限丢失，请重新运行 \`corepack pnpm package:binaries\`。
`,
  "utf8"
);

console.log(`Wrote StoryMaker platform launchers to ${outputDir}`);
