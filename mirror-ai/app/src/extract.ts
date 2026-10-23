import type { Language, Signal, SourceUnit } from "./types.ts";
import { countChar, excerpt, isTestPath, normPath, stripComment } from "./text.ts";

const NAMED_LITERAL_SKIP = new Set([
  "if",
  "return",
  "val",
  "var",
  "let",
  "fun",
  "func",
  "class",
  "when",
  "route",
  "routepath",
  "screentitle",
  "title",
  "path",
  "name",
  "message",
  "text",
  "errormessage",
  "package",
  "import",
]);

interface FunctionSpan {
  name: string;
  start: number;
  end: number;
}

export function extractSource(file: string, text: string): SourceUnit {
  const language: Language = file.endsWith(".swift")
    ? "swift"
    : file.endsWith(".java")
      ? "java"
      : "kotlin";
  const lines = text.split(/\r?\n/);
  const signals: Signal[] = [];
  const push = (signal: Omit<Signal, "file">) => {
    signals.push({ ...signal, file });
  };

  const constants = collectConstants(lines);
  for (const constant of constants) {
    push({
      kind: "constant",
      key: constant.name,
      display: `${constant.name} = ${constant.value}`,
      line: constant.line,
      excerpt: excerpt(lines[constant.line - 1] ?? ""),
      meta: { name: constant.name, value: constant.value },
    });
  }

  let owner = "";
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const code = stripComment(raw);
    const line = i + 1;
    const typeName = matchTypeName(code);
    if (typeName) owner = typeName;
    const pascalFun = code.match(/\b(?:fun|func)\s+([A-Z][A-Za-z0-9_]*)/);
    if (pascalFun) owner = pascalFun[1];

    if (typeName) {
      push({
        kind: "symbol",
        key: typeName,
        display: typeName,
        line,
        excerpt: excerpt(raw),
        meta: { owner: typeName },
      });
    }
    if (pascalFun) {
      push({
        kind: "symbol",
        key: pascalFun[1],
        display: pascalFun[1],
        line,
        excerpt: excerpt(raw),
        meta: { owner: pascalFun[1] },
      });
    }

    for (const ref of matchReferences(code)) {
      push({
        kind: "reference",
        key: ref,
        display: ref,
        line,
        excerpt: excerpt(raw),
        meta: { owner },
      });
    }

    for (const title of matchScreenTitles(code, lines, i)) {
      push({
        kind: "screen-title",
        key: title.toLowerCase(),
        display: title,
        line,
        excerpt: excerpt(raw),
        meta: {},
      });
    }

    for (const route of matchRoutes(code)) {
      push({
        kind: "route",
        key: route,
        display: route,
        line,
        excerpt: excerpt(raw),
        meta: {},
      });
    }

    for (const endpoint of matchEndpoints(code)) {
      const path = normPath(endpoint.path);
      push({
        kind: "endpoint",
        key: path,
        display: `${endpoint.method} ${path}`,
        line,
        excerpt: excerpt(raw),
        meta: { method: endpoint.method, path },
      });
    }

    for (const param of matchQueryParams(code)) {
      push({
        kind: "query-param",
        key: param.name.toLowerCase(),
        display: param.value ? `${param.name}=${param.value}` : param.name,
        line,
        excerpt: excerpt(raw),
        meta: {
          name: param.name,
          value: param.value,
          declared: param.declared ? "true" : "false",
        },
      });
    }

    for (const rule of matchRules(code, constants)) {
      push({
        kind: "business-rule",
        key: rule.key,
        display: rule.display,
        line,
        excerpt: excerpt(raw),
        meta: rule.meta,
      });
    }

    for (const guard of matchSourceSystemGuards(code)) {
      push({
        kind: "business-rule",
        key: `source-system:${guard.system}`,
        display: guard.display,
        line,
        excerpt: excerpt(raw),
        meta: { effect: "source-system", system: guard.system },
      });
    }

    const copy = matchUiCopy(lines, i);
    if (copy) {
      push({
        kind: "ui-copy",
        key: `${copy.state}:${copy.text.toLowerCase()}`,
        display: copy.text,
        line,
        excerpt: excerpt(raw),
        meta: { state: copy.state, text: copy.text },
      });
    }

    const widget = matchWidget(code);
    if (widget) {
      push({
        kind: "ui-widget",
        key: `${widget.role}:${widget.family}`,
        display: widget.token,
        line,
        excerpt: excerpt(raw),
        meta: { role: widget.role, family: widget.family, token: widget.token },
      });
    }
  }

  for (const field of kotlinDataFields(lines)) {
    push({
      kind: "model-field",
      key: field.name,
      display: field.name,
      line: field.line,
      excerpt: excerpt(lines[field.line - 1] ?? ""),
      meta: { typeName: field.typeName, field: field.name, fieldType: field.fieldType },
    });
    push({
      kind: "symbol",
      key: field.typeName,
      display: field.typeName,
      line: field.line,
      excerpt: excerpt(lines[field.line - 1] ?? ""),
      meta: { owner: field.typeName },
    });
  }

  for (const field of swiftStructFields(lines)) {
    push({
      kind: "model-field",
      key: field.name,
      display: field.name,
      line: field.line,
      excerpt: excerpt(lines[field.line - 1] ?? ""),
      meta: { typeName: field.typeName, field: field.name, fieldType: field.fieldType },
    });
  }

  for (const test of matchTests(lines, language)) {
    push({
      kind: "test",
      key: test.name,
      display: test.name,
      line: test.line,
      excerpt: excerpt(lines[test.line - 1] ?? ""),
      meta: { scenarios: test.scenarios.join(",") },
    });
  }

  for (const span of functionSpans(lines, language)) {
    const bodyLines = lines.slice(span.start, span.end + 1);
    const body = bodyLines.map(stripComment).join("\n");
    const shapes = /\.filter\b|\.take\b|\.prefix\b|\.drop\b|\.dropLast\b|limited\(\s*to:/.test(body);
    const returnLine = bodyLines.findIndex((line) => /^\s*return\s+[A-Za-z_]/.test(stripComment(line)));
    const assignLine = bodyLines.findIndex((line) =>
      /\b(?:items|products)\s*=\s*await\b/.test(stripComment(line)),
    );
    const fetches = /\bfetch|\bload|\brequest|\brecommendations\b|\bproducts\b/i.test(body);
    if (shapes || !fetches || (returnLine < 0 && assignLine < 0)) continue;
    const offset = returnLine >= 0 ? returnLine : assignLine;
    const line = span.start + offset + 1;
    push({
      kind: "business-rule",
      key: "passthrough",
      display: `${span.name} returns fetched items without an extra filter or cap`,
      line,
      excerpt: excerpt(lines[line - 1] ?? ""),
      meta: {
        effect: "passthrough",
        fn: span.name,
        returns: returnLine >= 0 ? "return" : "assign",
      },
    });
  }

  return {
    path: file,
    language,
    role: isTestPath(file) ? "test" : "production",
    signals: dedupe(signals),
  };
}

function dedupe(signals: Signal[]): Signal[] {
  const seen = new Set<string>();
  const out: Signal[] = [];
  for (const signal of signals) {
    const id = [
      signal.kind,
      signal.key,
      signal.line,
      signal.meta.name ?? "",
      signal.meta.value ?? "",
      signal.meta.field ?? "",
      signal.meta.owner ?? "",
    ].join("|");
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(signal);
  }
  return out;
}

function matchTypeName(code: string): string | null {
  const match = code.match(
    /\b(?:data\s+class|sealed\s+class|enum\s+class|class|interface|object|struct|enum|actor)\s+([A-Z][A-Za-z0-9_]*)/,
  );
  return match?.[1] ?? null;
}

function matchReferences(code: string): string[] {
  const refs = new Set<string>();
  for (const match of code.matchAll(/\b([A-Z][A-Za-z0-9_]*)\b/g)) {
    refs.add(match[1]);
  }
  return [...refs];
}

function matchScreenTitles(code: string, lines: string[], index: number): string[] {
  const titles: string[] = [];
  const named = code.match(/\bscreenTitle\b[^"\n]{0,40}"([^"]+)"/);
  if (named) titles.push(named[1]);
  const navigation = code.match(/\.?navigationTitle\(\s*"([^"]+)"\s*\)/);
  if (navigation) titles.push(navigation[1]);
  const text = code.match(/\bText\(\s*"([^"]+)"\s*\)/);
  if (text && lineLooksLikeTitle(code, lines, index)) titles.push(text[1]);
  return titles;
}

function lineLooksLikeTitle(code: string, lines: string[], index: number): boolean {
  if (/title\s*=|TopAppBar|navigationTitle/i.test(code)) return true;
  const previous = stripComment(lines[index - 1] ?? "");
  return /title\s*=|TopAppBar|navigationTitle/i.test(previous);
}

function matchRoutes(code: string): string[] {
  const routes: string[] = [];
  const patterns = [
    /(?:const\s+val|(?:private\s+|fileprivate\s+|public\s+|internal\s+)?(?:val|let|var))\s+[A-Za-z0-9_]*route[A-Za-z0-9_]*\s*(?::\s*[A-Za-z0-9_<>.?\[\]]+)?\s*=\s*"([^"]+)"/i,
    /\broute\s*[:=]\s*"([^"]+)"/,
    /\bcomposable\(\s*"([^"]+)"/,
  ];
  for (const pattern of patterns) {
    const match = code.match(pattern);
    if (!match) continue;
    const value = match[1];
    if (value.startsWith("/v") || value.includes("://")) continue;
    routes.push(value);
  }
  return routes;
}

function matchEndpoints(code: string): { method: string; path: string }[] {
  const found: { method: string; path: string }[] = [];
  const annotated = code.match(/@(GET|POST|PUT|DELETE|PATCH)\(\s*"([^"]+)"\s*\)/);
  if (annotated) found.push({ method: annotated[1], path: annotated[2] });
  const assigned = code.match(/\.path\s*=\s*"([^"]+)"/);
  if (assigned && assigned[1].startsWith("/")) {
    found.push({ method: "GET", path: assigned[1] });
  }
  return found;
}

interface QueryMatch {
  name: string;
  value: string;
  declared: boolean;
}

function matchQueryParams(code: string): QueryMatch[] {
  const params: QueryMatch[] = [];
  for (const match of code.matchAll(/@Query\(\s*"([^"]+)"\s*\)/g)) {
    params.push({ name: match[1], value: "", declared: true });
  }
  for (const match of code.matchAll(
    /URLQueryItem\(\s*name:\s*"([^"]+)"\s*,\s*value:\s*("([^"]*)"|[^)\n]+?)\s*\)/g,
  )) {
    const literal = match[3];
    params.push({
      name: match[1],
      value: literal ?? "",
      declared: true,
    });
  }
  for (const match of code.matchAll(
    /\b([A-Za-z_][A-Za-z0-9_]*)\s*[:=]\s*(?:"([^"]+)"|(true|false|-?\d+(?:\.\d+)?))/g,
  )) {
    const name = match[1];
    if (NAMED_LITERAL_SKIP.has(name.toLowerCase())) continue;
    const value = match[2] ?? match[3] ?? "";
    if (!value) continue;
    params.push({ name, value, declared: false });
  }
  return params;
}

function collectConstants(lines: string[]): { name: string; value: string; line: number }[] {
  const constants: { name: string; value: string; line: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = stripComment(lines[i] ?? "").match(
      /\b(?:const\s+val|let|var|val)\s+([A-Z][A-Z0-9_]*)\s*(?::\s*[A-Za-z0-9_<>.?]+)?\s*=\s*(-?\d+(?:\.\d+)?)/,
    );
    if (!match) continue;
    constants.push({ name: match[1], value: match[2], line: i + 1 });
  }
  return constants;
}

function matchSourceSystemGuards(code: string): { system: string; display: string }[] {
  const guards: { system: string; display: string }[] = [];
  const inBranch =
    /\b(?:when|if|guard|switch|case)\b/.test(code) ||
    /onClick|onTap|\.tap\b|Button\s*\(|clickable|onTapped|handleTap/i.test(code);
  if (!inBranch) return guards;
  const systems: { system: string; pattern: RegExp }[] = [
    { system: "cerillion", pattern: /cerillion/i },
    { system: "liberate", pattern: /liberate/i },
  ];
  for (const { system, pattern } of systems) {
    if (pattern.test(code)) {
      guards.push({ system, display: `${system} source/account guard` });
    }
  }
  if (/sourceSystem|source_system|accountType|billingSystem|bssType/i.test(code)) {
    const literal = code.match(/"([a-zA-Z_]+)"/);
    if (literal && !NAMED_LITERAL_SKIP.has(literal[1].toLowerCase())) {
      guards.push({ system: literal[1].toLowerCase(), display: `sourceSystem / account type "${literal[1]}"` });
    }
  }
  return guards;
}

function matchRules(
  code: string,
  constants: { name: string; value: string }[],
): { key: string; display: string; meta: Record<string, string> }[] {
  const rules: { key: string; display: string; meta: Record<string, string> }[] = [];
  if (/\b(?:filter|where|removeAll|if)\b/.test(code)) {
    for (const match of code.matchAll(
      /([A-Za-z_][A-Za-z0-9_]*)\s*(<=|>=|==|!=|<|>)\s*(-?\d+(?:\.\d+)?)/g,
    )) {
      const field = match[1];
      if (["if", "return", "when"].includes(field)) continue;
      const op = match[2];
      const value = match[3];
      rules.push({
        key: `filter:${field}:${op}:${value}`,
        display: `${field} ${op} ${value}`,
        meta: { effect: "filter", field, op, value },
      });
    }
  }
  const limit = code.match(/\.(?:take|prefix|drop|dropLast|suffix)\(\s*([A-Za-z_][A-Za-z0-9_]*|\d+)\s*\)/);
  if (limit) {
    const raw = limit[1];
    const resolved = /^\d/.test(raw) ? raw : constants.find((item) => item.name === raw)?.value;
    const value = resolved ?? raw;
    rules.push({
      key: `limit:${value}`,
      display: resolved && resolved !== raw ? `${raw} = ${resolved}` : `limit ${value}`,
      meta: { effect: "limit", raw, value },
    });
  }
  return rules;
}

function matchUiCopy(
  lines: string[],
  index: number,
): { state: string; text: string } | null {
  const code = stripComment(lines[index] ?? "");
  const match = code.match(/"([^"]*[ ][^"]*)"/);
  if (!match) return null;
  const text = match[1];
  if (text.startsWith("/") || text.includes("://")) return null;
  const state = nearestUiState(lines, index);
  if (!state) return null;
  if (state === "title") return null;
  return { state, text };
}

function nearestUiState(lines: string[], index: number): "empty" | "error" | "loading" | "title" | null {
  for (let j = index; j >= Math.max(0, index - 6); j--) {
    const code = stripComment(lines[j] ?? "");
    if (j < index && /\bText\s*\(|navigationTitle\s*\(/.test(code)) break;
    if (j < index && /^\s*(?:@|private\b|public\b|fileprivate\b|internal\b|var\b|let\b|val\b|const\b)/.test(code)) {
      continue;
    }
    if (/title\s*=|TopAppBar|navigationTitle|screenTitle/.test(code) && !/\bisEmpty\b|\berror\b|\bisLoading\b/.test(code)) {
      return "title";
    }
    if (/\.isEmpty\b|\bisEmpty\s*\(/.test(code)) return "empty";
    if (/\berror(?:Message)?\b/.test(code)) return "error";
    if (/\bisLoading\b|\bloading\b/i.test(code)) return "loading";
  }
  return null;
}

function matchWidget(code: string): { role: string; family: string; token: string } | null {
  const skeleton = code.match(/\b([A-Za-z0-9_]*(?:Skeleton|Shimmer))\b/);
  if (skeleton) return { role: "loading", family: "skeleton", token: skeleton[1] };
  const spinner = code.match(/\b(ProgressView|CircularProgressIndicator|UIActivityIndicator)\b/);
  if (spinner) return { role: "loading", family: "spinner", token: spinner[1] };
  return null;
}

function kotlinDataFields(lines: string[]): { typeName: string; name: string; fieldType: string; line: number }[] {
  const fields: { typeName: string; name: string; fieldType: string; line: number }[] = [];
  let typeName = "";
  let active = false;
  let started = false;
  let depth = 0;
  let startDepth = 0;
  for (let i = 0; i < lines.length; i++) {
    const code = stripComment(lines[i] ?? "");
    if (!active) {
      const match = code.match(/\bdata\s+class\s+([A-Z][A-Za-z0-9_]*)\s*\(/);
      if (match) {
        active = true;
        started = false;
        typeName = match[1];
        startDepth = depth;
      }
    }
    const open = countChar(code, "(");
    const close = countChar(code, ")");
    if (active) {
      if (open > 0) started = true;
      const field = code.match(/\b(?:val|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z0-9_<>.?]+)/);
      if (field) {
        fields.push({ typeName, name: field[1], fieldType: field[2], line: i + 1 });
      }
    }
    depth += open - close;
    if (active && started && depth <= startDepth) active = false;
  }
  return fields;
}

function swiftStructFields(lines: string[]): { typeName: string; name: string; fieldType: string; line: number }[] {
  const fields: { typeName: string; name: string; fieldType: string; line: number }[] = [];
  let typeName = "";
  let active = false;
  let depth = 0;
  let startDepth = 0;
  let opened = false;
  for (let i = 0; i < lines.length; i++) {
    const code = stripComment(lines[i] ?? "");
    if (!active) {
      const match = code.match(/\bstruct\s+([A-Z][A-Za-z0-9_]*)\b/);
      if (match) {
        active = true;
        opened = false;
        typeName = match[1];
        startDepth = depth;
      }
    }
    const open = countChar(code, "{");
    const close = countChar(code, "}");
    if (active && opened && depth === startDepth + 1) {
      const field = code.match(/^\s*(?:public |internal |fileprivate |private )?(?:let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z0-9_<>\[\]?.]+)\s*$/);
      if (field && !code.includes("=") && !code.includes("@")) {
        fields.push({ typeName, name: field[1], fieldType: field[2], line: i + 1 });
      }
    }
    depth += open - close;
    if (active && open > 0) opened = true;
    if (active && opened && depth <= startDepth) active = false;
  }
  return fields;
}

function matchTests(lines: string[], language: Language): { name: string; line: number; scenarios: string[] }[] {
  const tests: { name: string; line: number; scenarios: string[] }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const code = stripComment(lines[i] ?? "");
    const previous = stripComment(lines[i - 1] ?? "");
    let name = "";
    if (language === "swift") {
      const match = code.match(/\bfunc\s+(test[A-Za-z0-9_]*)\s*\(/);
      if (match) name = match[1];
    } else if (/@Test\b/.test(previous) || /@Test\b/.test(code)) {
      const match = code.match(/\bfun\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
      if (match) name = match[1];
    }
    if (!name) continue;
    tests.push({ name, line: i + 1, scenarios: scenarioTags(name) });
  }
  return tests;
}

function scenarioTags(name: string): string[] {
  const tokens = name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase();
  const tags: string[] = [];
  if (/\bempt(?:y|ies)\b/.test(tokens)) tags.push("empty");
  if (/\berrors?\b|\bfail/.test(tokens)) tags.push("error");
  if (/\bfilters?\b|\bprices?\b|\bnon\s*positive\b/.test(tokens)) tags.push("filter");
  if (/\bsort\b|\bpopular\b|\brelevance\b/.test(tokens)) tags.push("sort");
  if (/\bstock\b/.test(tokens)) tags.push("stock");
  if (/\blimit\b|\bcap\b|\bmax\b/.test(tokens)) tags.push("limit");
  if (/\bloading\b|\bskeleton\b|\bprogress\b/.test(tokens)) tags.push("loading");
  return tags;
}

function functionSpans(lines: string[], language: Language): FunctionSpan[] {
  const spans: FunctionSpan[] = [];
  let brace = 0;
  let pending: { name: string; start: number; base: number; opened: boolean } | null = null;
  const decl = language === "swift" ? /\bfunc\s+([A-Za-z_][A-Za-z0-9_]*)/ : /\bfun\s+([A-Za-z_][A-Za-z0-9_]*)/;
  for (let i = 0; i < lines.length; i++) {
    const code = stripComment(lines[i] ?? "");
    const match = code.match(decl);
    if (match && (!pending || !pending.opened)) {
      const ahead = lines.slice(i, i + 4).map(stripComment).join("\n");
      if (ahead.includes("{")) {
        pending = { name: match[1], start: i, base: brace, opened: false };
      }
    }
    const opens = countChar(code, "{");
    const closes = countChar(code, "}");
    brace += opens - closes;
    if (!pending) continue;
    if (opens > 0) pending.opened = true;
    if (pending.opened && brace <= pending.base) {
      spans.push({ name: pending.name, start: pending.start, end: i });
      pending = null;
    }
  }
  return spans;
}
