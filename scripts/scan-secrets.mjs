import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const rootDir = process.cwd();
const skippedDirectories = new Set([".git", ".vitest", "coverage", "dist", "node_modules"]);
const maxFileSize = 2_000_000;

const secretPatterns = [
  ["AWS access key", /AKIA[0-9A-Z]{16}/g],
  ["GitHub token", /gh[pousr]_[A-Za-z0-9_]{36,}/g],
  ["GitLab token", /glpat-[A-Za-z0-9\-_]{20,}/g],
  ["Slack token", /xox[bpors]-[0-9]{10,13}-[A-Za-z0-9-]{20,}/g],
  ["Private key", /-----BEGIN\s(?:RSA|DSA|EC|OPENSSH|PGP)\sPRIVATE\sKEY(?:\sBLOCK)?-----/g],
  [
    "Database URL with embedded password",
    /(?:mysql|postgres|postgresql|mongodb|redis|amqp):\/\/[^:\s]+:[^@\s]+@/gi
  ],
  ["JWT-like token", /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g]
];

const isLikelyText = (buffer) => !buffer.includes(0);

const scanFile = (filePath) => {
  const stats = statSync(filePath);

  if (stats.size > maxFileSize) {
    return [];
  }

  const buffer = readFileSync(filePath);

  if (!isLikelyText(buffer)) {
    return [];
  }

  const relativePath = relative(rootDir, filePath).replaceAll("\\", "/");
  const lines = buffer.toString("utf8").split(/\r?\n/);
  const findings = [];

  for (const [lineIndex, line] of lines.entries()) {
    for (const [type, pattern] of secretPatterns) {
      pattern.lastIndex = 0;

      if (pattern.test(line)) {
        findings.push({
          file: relativePath,
          line: lineIndex + 1,
          type
        });
      }
    }
  }

  return findings;
};

const scanDirectory = (directory) => {
  const findings = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) {
      continue;
    }

    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      findings.push(...scanDirectory(entryPath));
    } else if (entry.isFile()) {
      findings.push(...scanFile(entryPath));
    }
  }

  return findings;
};

const findings = scanDirectory(rootDir);

if (findings.length > 0) {
  console.error("Potential secrets were detected. Values are intentionally redacted.");
  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line} ${finding.type}`);
  }
  process.exitCode = 1;
} else {
  console.log("No high-confidence secret patterns detected.");
}
