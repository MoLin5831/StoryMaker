import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const QualityGateSeverityValues = ["P0", "P1", "P2", "P3"] as const;

export type QualityGateSeverity = (typeof QualityGateSeverityValues)[number];

export const QualityGateStatusValues = ["passed", "failed"] as const;

export type QualityGateStatus = (typeof QualityGateStatusValues)[number];

export type QualityGateFinding = {
  id: string;
  message: string;
  severity: QualityGateSeverity;
  sourceRef?: string;
  snippet?: string;
  suggestion?: string;
};

export type QualityGateResult = {
  id: string;
  createdAt: string;
  findings: QualityGateFinding[];
  gate: string;
  status: QualityGateStatus;
  summary?: string;
};

export type QualityGateContext = {
  cwd?: string;
  input?: unknown;
  metadata?: Record<string, unknown>;
  now?: string;
  sourceText?: string;
  unitId?: string;
};

export type QualityGateRunOutput = {
  findings?: QualityGateFinding[];
  id?: string;
  status?: QualityGateStatus;
  summary?: string;
};

export type QualityGateDefinition = {
  id: string;
  run: (context: QualityGateContext) => Promise<QualityGateRunOutput> | QualityGateRunOutput;
};

export type QualityGateReportWriteResult = {
  absolutePath: string;
  relativePath: string;
};

export class QualityGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QualityGateError";
  }
}

const isQualityGateSeverity = (value: string): value is QualityGateSeverity =>
  QualityGateSeverityValues.includes(value as QualityGateSeverity);

const isQualityGateStatus = (value: string): value is QualityGateStatus =>
  QualityGateStatusValues.includes(value as QualityGateStatus);

export const assertQualityGateSeverity = (value: string): QualityGateSeverity => {
  if (!isQualityGateSeverity(value)) {
    throw new QualityGateError(`Invalid quality gate severity: ${value}.`);
  }

  return value;
};

export const assertQualityGateStatus = (value: string): QualityGateStatus => {
  if (!isQualityGateStatus(value)) {
    throw new QualityGateError(`Invalid quality gate status: ${value}.`);
  }

  return value;
};

const sanitizeReportSegment = (value: string): string =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "quality-gate";

const createResultId = (gateId: string, now: string): string =>
  `${sanitizeReportSegment(gateId)}-${sanitizeReportSegment(now)}`;

const validateFinding = (finding: QualityGateFinding): QualityGateFinding => {
  if (!finding.id.trim()) {
    throw new QualityGateError("Quality gate finding id is required.");
  }

  if (!finding.message.trim()) {
    throw new QualityGateError("Quality gate finding message is required.");
  }

  assertQualityGateSeverity(finding.severity);

  return finding;
};

export const createQualityGateResult = (
  gateId: string,
  output: QualityGateRunOutput,
  options: {
    now?: string;
  } = {}
): QualityGateResult => {
  if (!gateId.trim()) {
    throw new QualityGateError("Quality gate id is required.");
  }

  const createdAt = options.now ?? new Date().toISOString();
  const findings = (output.findings ?? []).map(validateFinding);
  const status = output.status ?? (findings.length > 0 ? "failed" : "passed");

  assertQualityGateStatus(status);

  return {
    id: output.id ?? createResultId(gateId, createdAt),
    createdAt,
    findings,
    gate: gateId,
    status,
    summary: output.summary
  };
};

export const runQualityGate = async (
  gate: QualityGateDefinition,
  context: QualityGateContext = {}
): Promise<QualityGateResult> => {
  const output = await gate.run(context);

  return createQualityGateResult(gate.id, output, {
    now: context.now
  });
};

export const getQualityGateReportPath = (
  cwd: string,
  result: QualityGateResult
): QualityGateReportWriteResult => {
  const fileName = `${sanitizeReportSegment(result.id)}.json`;
  const relativePath = `reviews/${fileName}`;

  return {
    absolutePath: join(cwd, "reviews", fileName),
    relativePath
  };
};

export const writeQualityGateReport = async (
  cwd: string,
  result: QualityGateResult
): Promise<QualityGateReportWriteResult> => {
  const reportPath = getQualityGateReportPath(cwd, result);

  await mkdir(join(cwd, "reviews"), {
    recursive: true
  });
  await writeFile(reportPath.absolutePath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  return reportPath;
};

export const CONSISTENCY_GATE_ID = "consistency";

export const ConsistencyFactCategoryValues = [
  "character_state",
  "timeline",
  "ability",
  "item"
] as const;

export type ConsistencyFactCategory = (typeof ConsistencyFactCategoryValues)[number];

export type ConsistencyFact = {
  category: ConsistencyFactCategory;
  id: string;
  key: string;
  sourceRef?: string;
  subject: string;
  value: string;
};

const consistencySeverityByCategory: Record<ConsistencyFactCategory, QualityGateSeverity> = {
  ability: "P1",
  character_state: "P1",
  item: "P1",
  timeline: "P0"
};

const consistencyCategoryLabel: Record<ConsistencyFactCategory, string> = {
  ability: "ability",
  character_state: "character state",
  item: "item",
  timeline: "timeline"
};

const createConsistencyGroupKey = (fact: ConsistencyFact): string =>
  [fact.category, fact.subject, fact.key].map((part) => part.trim().toLowerCase()).join("\u0000");

const createConsistencyFindingId = (fact: ConsistencyFact): string =>
  [
    "consistency",
    fact.category,
    sanitizeReportSegment(fact.subject),
    sanitizeReportSegment(fact.key)
  ].join("-");

const formatDistinctValues = (facts: readonly ConsistencyFact[]): string =>
  [...new Set(facts.map((fact) => fact.value))]
    .sort((left, right) => left.localeCompare(right))
    .join(", ");

const formatSourceRefs = (facts: readonly ConsistencyFact[]): string | undefined => {
  const sourceRefs = [
    ...new Set(
      facts
        .map((fact) => fact.sourceRef)
        .filter((sourceRef): sourceRef is string => sourceRef !== undefined)
    )
  ];

  return sourceRefs.length > 0 ? sourceRefs.join(", ") : undefined;
};

export const findConsistencyConflicts = (
  facts: readonly ConsistencyFact[]
): QualityGateFinding[] => {
  const groups = new Map<string, ConsistencyFact[]>();

  for (const fact of facts) {
    const groupKey = createConsistencyGroupKey(fact);
    const group = groups.get(groupKey) ?? [];
    group.push(fact);
    groups.set(groupKey, group);
  }

  const findings: QualityGateFinding[] = [];

  for (const group of groups.values()) {
    const distinctValues = new Set(group.map((fact) => fact.value.trim()));

    if (distinctValues.size <= 1) {
      continue;
    }

    const first = group[0];
    findings.push({
      id: createConsistencyFindingId(first),
      message: `${consistencyCategoryLabel[first.category]} conflict for ${first.subject}.${first.key}: ${formatDistinctValues(group)}.`,
      severity: consistencySeverityByCategory[first.category],
      sourceRef: formatSourceRefs(group),
      suggestion: "Choose one canonical value or split the facts by time/context."
    });
  }

  return findings.sort((left, right) => left.id.localeCompare(right.id));
};

export const runConsistencyGate = async (
  facts: readonly ConsistencyFact[],
  context: QualityGateContext = {}
): Promise<QualityGateResult> =>
  runQualityGate(
    {
      id: CONSISTENCY_GATE_ID,
      run: () => ({
        findings: findConsistencyConflicts(facts),
        summary:
          facts.length === 0
            ? "No consistency facts provided."
            : `Checked ${facts.length} consistency facts.`
      })
    },
    context
  );

export const blocksAutomaticBatchProduction = (result: QualityGateResult): boolean =>
  result.findings.some((finding) => finding.severity === "P0" || finding.severity === "P1");

export const AI_TASTE_GATE_ID = "ai_taste";

export type AiTasteRuleKind = "banned_cliche" | "template_feel" | "anti_intelligence";

export type AiTasteRule = {
  id: string;
  kind: AiTasteRuleKind;
  label: string;
  pattern: RegExp;
  severity: QualityGateSeverity;
  suggestion: string;
};

export type AiTasteGateInput = {
  rules?: readonly AiTasteRule[];
  sourceRef?: string;
  sourceText: string;
};

const createRulePattern = (phrase: string): RegExp =>
  new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");

export const DEFAULT_AI_TASTE_RULES: readonly AiTasteRule[] = [
  {
    id: "heart-pounded",
    kind: "banned_cliche",
    label: "heart pounded",
    pattern: createRulePattern("heart pounded"),
    severity: "P2",
    suggestion: "Replace the stock body reaction with a specific action or image."
  },
  {
    id: "little-did-they-know",
    kind: "banned_cliche",
    label: "little did they know",
    pattern: createRulePattern("little did they know"),
    severity: "P2",
    suggestion: "Create dramatic irony through scene evidence instead of narrator warning."
  },
  {
    id: "for-what-felt-like-an-eternity",
    kind: "banned_cliche",
    label: "for what felt like an eternity",
    pattern: createRulePattern("for what felt like an eternity"),
    severity: "P3",
    suggestion: "Use a concrete duration, sensory beat, or interruption."
  },
  {
    id: "not-just-but",
    kind: "template_feel",
    label: "not just X but Y template",
    pattern: /\bnot just\b[^.!?\n]{0,120}\bbut\b/gi,
    severity: "P2",
    suggestion: "Collapse the template into one precise claim or dramatize it in action."
  },
  {
    id: "testament-to",
    kind: "template_feel",
    label: "testament to",
    pattern: createRulePattern("testament to"),
    severity: "P3",
    suggestion: "Name the concrete behavior that proves the quality."
  },
  {
    id: "somehow",
    kind: "anti_intelligence",
    label: "somehow",
    pattern: createRulePattern("somehow"),
    severity: "P2",
    suggestion: "Explain the causal mechanism or remove the unsupported shortcut."
  },
  {
    id: "as-if-by-magic",
    kind: "anti_intelligence",
    label: "as if by magic",
    pattern: createRulePattern("as if by magic"),
    severity: "P2",
    suggestion: "Replace with the actual mechanism or cost."
  }
];

const findSentenceSnippet = (
  sourceText: string,
  matchStart: number,
  matchEnd: number
): {
  offset: number;
  sentence: number;
  snippet: string;
} => {
  const sentencePattern = /[^.!?\n]+[.!?]?/g;
  let sentenceIndex = 0;
  let match = sentencePattern.exec(sourceText);

  while (match !== null) {
    sentenceIndex += 1;
    const sentenceStart = match.index;
    const sentenceEnd = sentenceStart + match[0].length;

    if (matchStart >= sentenceStart && matchEnd <= sentenceEnd) {
      return {
        offset: matchStart,
        sentence: sentenceIndex,
        snippet: match[0].trim()
      };
    }

    match = sentencePattern.exec(sourceText);
  }

  return {
    offset: matchStart,
    sentence: 1,
    snippet: sourceText.slice(matchStart, matchEnd).trim()
  };
};

const createAiTasteFindingId = (
  rule: AiTasteRule,
  location: {
    offset: number;
    sentence: number;
  }
): string =>
  [
    "ai-taste",
    rule.kind,
    sanitizeReportSegment(rule.id),
    `sentence-${location.sentence}`,
    `offset-${location.offset}`
  ].join("-");

export const findAiTasteFindings = (input: AiTasteGateInput): QualityGateFinding[] => {
  const rules = input.rules ?? DEFAULT_AI_TASTE_RULES;
  const findings: QualityGateFinding[] = [];

  for (const rule of rules) {
    const pattern = new RegExp(
      rule.pattern.source,
      rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`
    );
    let match = pattern.exec(input.sourceText);

    while (match !== null) {
      const matchedText = match[0];
      const location = findSentenceSnippet(
        input.sourceText,
        match.index,
        match.index + matchedText.length
      );

      findings.push({
        id: createAiTasteFindingId(rule, location),
        message: `${rule.kind} issue: "${rule.label}" at sentence ${location.sentence}.`,
        severity: rule.severity,
        sourceRef: input.sourceRef
          ? `${input.sourceRef}#sentence-${location.sentence}`
          : `sentence-${location.sentence}`,
        snippet: location.snippet,
        suggestion: rule.suggestion
      });
      match = pattern.exec(input.sourceText);
    }
  }

  return findings.sort((left, right) => left.id.localeCompare(right.id));
};

export const runAiTasteGate = async (
  input: AiTasteGateInput,
  context: QualityGateContext = {}
): Promise<QualityGateResult> =>
  runQualityGate(
    {
      id: AI_TASTE_GATE_ID,
      run: () => ({
        findings: findAiTasteFindings(input),
        summary: `Checked ${input.sourceText.length} characters for AI taste issues.`
      })
    },
    {
      ...context,
      sourceText: input.sourceText
    }
  );

export type AutomaticRevisionMode = "light" | "rewrite" | "add_hook" | "reduce_fluff";

export type AutomaticRevisionAction = "auto_revise" | "pause" | "record_suggestions";

export type AutomaticRevisionPlan = {
  action: AutomaticRevisionAction;
  mode?: AutomaticRevisionMode;
  reason: string;
  severity?: QualityGateSeverity;
  suggestions: string[];
};

export type AutomaticRevisionRequest = {
  mode: AutomaticRevisionMode;
  qualityGateResult: QualityGateResult;
  reason: string;
  suggestions: readonly string[];
};

export type AutomaticRevisionResult = AutomaticRevisionPlan & {
  stagedOutputFile?: string;
};

export type AutomaticRevisionStrategyOptions = {
  p1RevisionAttempts?: number;
};

export type AutomaticRevisionApplyOptions = AutomaticRevisionStrategyOptions & {
  createRevision: (request: AutomaticRevisionRequest) =>
    | Promise<{
        stagedOutputFile: string;
      }>
    | {
        stagedOutputFile: string;
      };
};

const severityRank: Record<QualityGateSeverity, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3
};

const getHighestSeverity = (result: QualityGateResult): QualityGateSeverity | undefined =>
  [...result.findings]
    .map((finding) => finding.severity)
    .sort((left, right) => severityRank[left] - severityRank[right])[0];

const collectRevisionSuggestions = (result: QualityGateResult): string[] => [
  ...new Set(
    result.findings
      .map((finding) => finding.suggestion)
      .filter((suggestion): suggestion is string => suggestion !== undefined)
  )
];

export const planAutomaticRevisionStrategy = (
  result: QualityGateResult,
  options: AutomaticRevisionStrategyOptions = {}
): AutomaticRevisionPlan => {
  const severity = getHighestSeverity(result);
  const suggestions = collectRevisionSuggestions(result);

  if (severity === undefined || result.status === "passed") {
    return {
      action: "record_suggestions",
      reason: "Quality gate passed; no automatic revision is needed.",
      suggestions
    };
  }

  if (severity === "P0") {
    return {
      action: "pause",
      reason: "P0 quality gate finding requires user review before revision.",
      severity,
      suggestions
    };
  }

  if (severity === "P1") {
    if ((options.p1RevisionAttempts ?? 0) > 0) {
      return {
        action: "pause",
        reason: "P1 quality gate finding still failed after one automatic revision.",
        severity,
        suggestions
      };
    }

    return {
      action: "auto_revise",
      mode: "rewrite",
      reason: "P1 quality gate finding allows one automatic revision attempt.",
      severity,
      suggestions
    };
  }

  if (severity === "P2") {
    return {
      action: "auto_revise",
      mode: "light",
      reason: "P2 quality gate finding can be automatically revised.",
      severity,
      suggestions
    };
  }

  return {
    action: "record_suggestions",
    reason: "P3 quality gate finding records suggestions without mandatory revision.",
    severity,
    suggestions
  };
};

export const applyAutomaticRevisionStrategy = async (
  result: QualityGateResult,
  options: AutomaticRevisionApplyOptions
): Promise<AutomaticRevisionResult> => {
  const plan = planAutomaticRevisionStrategy(result, options);

  if (plan.action !== "auto_revise") {
    return plan;
  }

  if (!plan.mode) {
    throw new QualityGateError("Automatic revision mode is required.");
  }

  const revision = await options.createRevision({
    mode: plan.mode,
    qualityGateResult: result,
    reason: plan.reason,
    suggestions: plan.suggestions
  });

  if (!revision.stagedOutputFile.trim()) {
    throw new QualityGateError("Automatic revision did not produce a stagedOutputFile.");
  }

  return {
    ...plan,
    stagedOutputFile: revision.stagedOutputFile
  };
};

export type UnitCharacterProgression = {
  character: string;
  from?: string;
  note?: string;
  to?: string;
};

export type UnitRetrospectiveSummary = {
  characterProgression?: readonly UnitCharacterProgression[];
  foreshadowingAdded?: readonly string[];
  foreshadowingRecovered?: readonly string[];
  highlightBeats?: readonly string[];
  id: string;
  index: number;
  payoffBeats?: readonly string[];
  risks?: readonly string[];
  title: string;
};

export type UnitRetrospectiveInput = {
  createdAt?: string;
  range: {
    end: number;
    start: number;
  };
  units: readonly UnitRetrospectiveSummary[];
};

export type RepeatedBeat = {
  beat: string;
  count: number;
  unitIds: string[];
};

export type UnitRetrospectiveReport = {
  characterProgression: UnitCharacterProgression[];
  createdAt: string;
  foreshadowing: {
    added: string[];
    recovered: string[];
  };
  id: string;
  range: {
    end: number;
    start: number;
  };
  repeatedBeats: RepeatedBeat[];
  risks: string[];
  unitCount: number;
};

const normalizeBeat = (beat: string): string => beat.trim().toLowerCase();

const collectUniqueStrings = (values: readonly string[]): string[] =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );

const collectRepeatedBeats = (units: readonly UnitRetrospectiveSummary[]): RepeatedBeat[] => {
  const beats = new Map<
    string,
    {
      beat: string;
      unitIds: Set<string>;
    }
  >();

  for (const unit of units) {
    for (const beat of [...(unit.payoffBeats ?? []), ...(unit.highlightBeats ?? [])]) {
      const normalized = normalizeBeat(beat);
      if (!normalized) {
        continue;
      }

      const current = beats.get(normalized) ?? {
        beat: beat.trim(),
        unitIds: new Set<string>()
      };
      current.unitIds.add(unit.id);
      beats.set(normalized, current);
    }
  }

  return [...beats.values()]
    .map((entry) => ({
      beat: entry.beat,
      count: entry.unitIds.size,
      unitIds: [...entry.unitIds].sort()
    }))
    .filter((entry) => entry.count > 1)
    .sort((left, right) => left.beat.localeCompare(right.beat));
};

export const generateUnitRetrospective = (
  input: UnitRetrospectiveInput
): UnitRetrospectiveReport => {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const characterProgression = input.units.flatMap((unit) => unit.characterProgression ?? []);
  const foreshadowingAdded = collectUniqueStrings(
    input.units.flatMap((unit) => unit.foreshadowingAdded ?? [])
  );
  const foreshadowingRecovered = collectUniqueStrings(
    input.units.flatMap((unit) => unit.foreshadowingRecovered ?? [])
  );
  const repeatedBeats = collectRepeatedBeats(input.units);
  const explicitRisks = collectUniqueStrings(input.units.flatMap((unit) => unit.risks ?? []));
  const derivedRisks = [
    ...(repeatedBeats.length > 0
      ? ["Repeated payoff or highlight beats may reduce reader impact."]
      : []),
    ...(foreshadowingAdded.length > 0 && foreshadowingRecovered.length === 0
      ? ["Foreshadowing was added but not recovered in this range."]
      : [])
  ];

  return {
    characterProgression,
    createdAt,
    foreshadowing: {
      added: foreshadowingAdded,
      recovered: foreshadowingRecovered
    },
    id: `retro-${input.range.start}-${input.range.end}-${sanitizeReportSegment(createdAt)}`,
    range: input.range,
    repeatedBeats,
    risks: collectUniqueStrings([...explicitRisks, ...derivedRisks]),
    unitCount: input.units.length
  };
};

export const writeUnitRetrospectiveReport = async (
  cwd: string,
  report: UnitRetrospectiveReport
): Promise<QualityGateReportWriteResult> => {
  const fileName = `${sanitizeReportSegment(report.id)}.json`;
  const reportPath = {
    absolutePath: join(cwd, "reviews", fileName),
    relativePath: `reviews/${fileName}`
  };

  await mkdir(join(cwd, "reviews"), {
    recursive: true
  });
  await writeFile(reportPath.absolutePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return reportPath;
};
