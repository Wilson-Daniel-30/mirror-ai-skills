import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Location } from "./types.ts";

export interface CodeSnippet {
  file: string;
  line: number;
  language: string;
  startLine: number;
  code: string;
}

export function readSnippet(root: string, location: Location): CodeSnippet | null {
  if (!location.file || location.file === "(no counterpart)" || location.line < 1) return null;
  const full = path.join(root, location.file);
  if (!existsSync(full)) return null;
  const lines = readFileSync(full, "utf8").split(/\r?\n/);
  if (lines.length === 0) return null;
  const target = Math.min(location.line, lines.length) - 1;
  let start = findBlockStart(lines, target);
  while (start > 0 && lines[start - 1].trim().startsWith("@")) start -= 1;
  const end = findBlockEnd(lines, start);
  return {
    file: location.file,
    line: target + 1,
    language: languageOf(location.file),
    startLine: start + 1,
    code: lines.slice(start, end).join("\n"),
  };
}

function findBlockStart(lines: string[], index: number): number {
  for (let i = index; i >= 0; i--) {
    if (isDeclaration(lines[i] ?? "")) return i;
  }
  return Math.max(0, index - 6);
}

function findBlockEnd(lines: string[], start: number): number {
  let depth = 0;
  let opened = false;
  for (let i = start; i < lines.length; i++) {
    const delta = depthDelta(lines[i] ?? "");
    depth += delta;
    if (delta > 0 || (lines[i] ?? "").includes("{")) opened = true;
    if (opened && depth <= 0) return i + 1;
    if (i - start > 70) return Math.min(lines.length, start + 48);
  }
  return Math.min(lines.length, start + 24);
}

function isDeclaration(line: string): boolean {
  return /\b(?:fun|func|class|struct|interface|object|enum)\b/.test(line);
}

function depthDelta(line: string): number {
  const code = stripStrings(line);
  let delta = 0;
  for (const char of code) {
    if (char === "{") delta += 1;
    else if (char === "}") delta -= 1;
  }
  return delta;
}

function stripStrings(line: string): string {
  let quote = false;
  let out = "";
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === "\\") {
      i += 1;
      out += "  ";
      continue;
    }
    if (char === '"') {
      quote = !quote;
      out += " ";
      continue;
    }
    out += quote ? " " : char;
  }
  const comment = out.indexOf("//");
  return comment >= 0 ? out.slice(0, comment) : out;
}

function languageOf(file: string): string {
  if (file.endsWith(".java")) return "java";
  if (file.endsWith(".swift")) return "swift";
  return "kotlin";
}
