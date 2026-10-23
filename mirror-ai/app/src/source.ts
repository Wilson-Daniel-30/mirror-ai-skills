import path from "node:path";
import { createHighlighter, type Highlighter } from "shiki";
import { readSources } from "./scan.ts";

const THEME = "github-dark";
const LANGS = ["kotlin", "java", "swift"] as const;
/** Lines of surrounding code shown either side of the cited range. */
const CONTEXT = 4;
const MAX_LINES = 400;

export interface SourceView {
  file: string;
  start: number;
  end: number;
  focusStart: number;
  focusEnd: number;
  html: string;
}

let highlighter: Promise<Highlighter> | null = null;

function highlighterOnce(): Promise<Highlighter> {
  highlighter ??= createHighlighter({ themes: [THEME], langs: [...LANGS] });
  return highlighter;
}

/**
 * Reports cite a repo-relative path, but a long one is sometimes abbreviated
 * (`feature/common/.../AccountData.kt`), and a run whose working directory is
 * the other checkout tends to cite this one absolutely. Three attempts, each
 * stricter than the next is forgiving; an ambiguous citation is refused rather
 * than guessed.
 */
export function resolveFile(root: string, cited: string): string | null {
  const wanted = cited.replace(/^\.?\/+/, "").split("/").filter((part) => part && part !== "...");
  if (wanted.length === 0) return null;
  const sources = readSources(root);

  // 1. The path as written, once any leading slash is gone.
  const exact = sources.find((source) => source.relativePath === wanted.join("/"));
  if (exact) return exact.relativePath;

  // 2. The longest tail of the citation that is a whole path. This is what
  //    recovers an absolute path: the checkout's own prefix falls away.
  for (let from = 1; from < wanted.length; from++) {
    const tail = wanted.slice(from).join("/");
    const hit = sources.find((source) => source.relativePath === tail);
    if (hit) return hit.relativePath;
  }

  // 3. Named segments in order, which is what an abbreviated path leaves.
  const matches = sources.filter((source) => {
    const parts = source.relativePath.split("/");
    if (parts[parts.length - 1] !== wanted[wanted.length - 1]) return false;
    let at = 0;
    for (const part of wanted) {
      at = parts.indexOf(part, at);
      if (at < 0) return false;
      at += 1;
    }
    return true;
  });
  return matches.length === 1 ? matches[0].relativePath : null;
}

export async function readSourceView(
  root: string,
  cited: string,
  start: number,
  end: number,
): Promise<SourceView | null> {
  const file = resolveFile(root, cited);
  if (!file) return null;
  const source = readSources(root).find((item) => item.relativePath === file);
  if (!source) return null;
  const lines = source.text.split("\n");
  const focusStart = clamp(start, 1, lines.length);
  const focusEnd = clamp(Math.max(end || focusStart, focusStart), focusStart, lines.length);
  const from = Math.max(1, focusStart - CONTEXT);
  const to = Math.min(lines.length, Math.min(focusEnd + CONTEXT, from + MAX_LINES - 1));
  const code = lines.slice(from - 1, to).join("\n");
  const shiki = await highlighterOnce();
  const html = shiki.codeToHtml(code, {
    lang: languageOf(file),
    theme: THEME,
    transformers: [
      {
        line(node, line) {
          const number = from + line - 1;
          if (number >= focusStart && number <= focusEnd) {
            this.addClassToHast(node, "cited");
          }
        },
      },
    ],
  });
  return { file, start: from, end: to, focusStart, focusEnd, html };
}

function languageOf(file: string): (typeof LANGS)[number] {
  if (/\.swift$/.test(file)) return "swift";
  if (/\.java$/.test(file)) return "java";
  return "kotlin";
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/** Guards against a citation escaping the checkout it claims to come from. */
export function withinRoot(root: string, file: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, file);
  return resolved === resolvedRoot || resolved.startsWith(resolvedRoot + path.sep);
}
