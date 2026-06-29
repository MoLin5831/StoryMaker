export type FrontMatterScalar = string | number | boolean | null;
export type FrontMatterValue =
  | FrontMatterScalar
  | FrontMatterScalar[];
export type FrontMatter = Record<string, FrontMatterValue>;

export type MarkdownWithFrontMatter = {
  body: string;
  frontMatter: FrontMatter;
};

const keyPattern = /^[A-Za-z_][A-Za-z0-9_-]*$/;

const readLine = (
  text: string,
  start: number
): { line: string; nextIndex: number } => {
  const newlineIndex = text.indexOf("\n", start);

  if (newlineIndex === -1) {
    return {
      line: text.slice(start).replace(/\r$/, ""),
      nextIndex: text.length
    };
  }

  return {
    line: text.slice(start, newlineIndex).replace(/\r$/, ""),
    nextIndex: newlineIndex + 1
  };
};

const findSeparator = (line: string): number => {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const previous = line[index - 1];

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && previous !== "\\" && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === ":" && !inSingleQuote && !inDoubleQuote) {
      return index;
    }
  }

  return -1;
};

const splitArrayItems = (value: string): string[] => {
  const items: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const previous = value[index - 1];

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += char;
      continue;
    }

    if (char === '"' && previous !== "\\" && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += char;
      continue;
    }

    if (char === "," && !inSingleQuote && !inDoubleQuote) {
      items.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (inSingleQuote || inDoubleQuote) {
    throw new Error("Invalid front matter array: unterminated quoted value.");
  }

  items.push(current.trim());
  return items;
};

const parseQuotedString = (value: string): string => {
  if (value.startsWith('"')) {
    if (!value.endsWith('"') || value.length === 1) {
      throw new Error("Invalid front matter string: unterminated double quote.");
    }

    return value
      .slice(1, -1)
      .replaceAll('\\"', '"')
      .replaceAll("\\n", "\n")
      .replaceAll("\\\\", "\\");
  }

  if (value.startsWith("'")) {
    if (!value.endsWith("'") || value.length === 1) {
      throw new Error("Invalid front matter string: unterminated single quote.");
    }

    return value.slice(1, -1).replaceAll("''", "'");
  }

  return value;
};

const parseScalar = (value: string): FrontMatterScalar => {
  const trimmed = value.trim();

  if (trimmed === "") {
    return "";
  }

  if (trimmed === "true") {
    return true;
  }

  if (trimmed === "false") {
    return false;
  }

  if (trimmed === "null") {
    return null;
  }

  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  return parseQuotedString(trimmed);
};

const parseValue = (value: string): FrontMatterValue => {
  const trimmed = value.trim();

  if (trimmed.startsWith("[") || trimmed.endsWith("]")) {
    if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
      throw new Error("Invalid front matter array: expected [item, item].");
    }

    const content = trimmed.slice(1, -1).trim();

    if (content === "") {
      return [];
    }

    return splitArrayItems(content).map(parseScalar);
  }

  return parseScalar(trimmed);
};

const parseFrontMatterYaml = (yaml: string): FrontMatter => {
  const frontMatter: FrontMatter = {};

  for (const rawLine of yaml.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (line === "" || line.startsWith("#")) {
      continue;
    }

    const separator = findSeparator(line);

    if (separator <= 0) {
      throw new Error(`Invalid front matter line: ${rawLine}`);
    }

    const key = line.slice(0, separator).trim();

    if (!keyPattern.test(key)) {
      throw new Error(`Invalid front matter key: ${key}`);
    }

    frontMatter[key] = parseValue(line.slice(separator + 1));
  }

  return frontMatter;
};

const validateValue = (key: string, value: unknown): FrontMatterValue => {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => {
      if (
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean" ||
        item === null
      ) {
        return item;
      }

      throw new Error(`Invalid front matter array value for key: ${key}`);
    });
  }

  throw new Error(`Invalid front matter value for key: ${key}`);
};

export const validateFrontMatter = (
  frontMatter: unknown
): FrontMatter => {
  if (
    frontMatter === null ||
    typeof frontMatter !== "object" ||
    Array.isArray(frontMatter)
  ) {
    throw new Error("Front matter must be an object.");
  }

  const normalized: FrontMatter = {};

  for (const [key, value] of Object.entries(frontMatter)) {
    if (!keyPattern.test(key)) {
      throw new Error(`Invalid front matter key: ${key}`);
    }

    normalized[key] = validateValue(key, value);
  }

  return normalized;
};

export const readMarkdownWithFrontMatter = (
  markdown: string
): MarkdownWithFrontMatter => {
  const text = markdown.replace(/^\uFEFF/, "");
  const firstLine = readLine(text, 0);

  if (firstLine.line !== "---") {
    return {
      body: text,
      frontMatter: {}
    };
  }

  if (firstLine.nextIndex === text.length) {
    throw new Error("Invalid front matter: missing closing delimiter.");
  }

  const yamlStart = firstLine.nextIndex;
  let cursor = yamlStart;

  while (cursor < text.length) {
    const lineStart = cursor;
    const line = readLine(text, cursor);

    if (line.line === "---") {
      return {
        body: text.slice(line.nextIndex),
        frontMatter: parseFrontMatterYaml(text.slice(yamlStart, lineStart))
      };
    }

    cursor = line.nextIndex;
  }

  throw new Error("Invalid front matter: missing closing delimiter.");
};

const renderScalar = (value: FrontMatterScalar): string => {
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value === null) {
    return "null";
  }

  return JSON.stringify(value);
};

const renderValue = (value: FrontMatterValue): string => {
  if (Array.isArray(value)) {
    return `[${value.map(renderScalar).join(", ")}]`;
  }

  return renderScalar(value);
};

export const writeMarkdownWithFrontMatter = (
  frontMatter: unknown,
  body: string
): string => {
  const normalized = validateFrontMatter(frontMatter);
  const keys = Object.keys(normalized).sort();

  if (keys.length === 0) {
    return body;
  }

  const yaml = keys
    .map((key) => `${key}: ${renderValue(normalized[key])}`)
    .join("\n");

  return `---\n${yaml}\n---\n${body}`;
};
