import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SKIP_DIRS = new Set([
  "node_modules",
  "build",
  ".git",
  ".gradle",
  "DerivedData",
  "out",
]);

export interface RepoSource {
  relativePath: string;
  text: string;
  /** `text` lowercased once, so keyword sweeps over a whole repo stay cheap. */
  lower: string;
}

const sourceCache = new Map<string, RepoSource[]>();

export function walkSources(root: string): string[] {
  const resolved = path.resolve(root);
  if (!statSync(resolved, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Repository path is not a directory: ${root}`);
  }
  const files: string[] = [];
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(full);
        continue;
      }
      if (/\.(kt|kts|java|swift)$/.test(entry.name)) files.push(full);
    }
  };
  visit(resolved);
  return files.sort();
}

/**
 * Checkouts live in a content-addressed cache directory and never change while
 * the server runs, so a repository is read from disk once per process. Every
 * selected module would otherwise re-read the whole tree.
 */
export function readSources(root: string): RepoSource[] {
  const resolved = path.resolve(root);
  const cached = sourceCache.get(resolved);
  if (cached) return cached;
  const sources = walkSources(resolved).map((full) => {
    const text = readFileSync(full, "utf8");
    return {
      relativePath: path.relative(resolved, full).split(path.sep).join("/"),
      text,
      lower: text.toLowerCase(),
    };
  });
  sourceCache.set(resolved, sources);
  return sources;
}

export function clearSourceCache(): void {
  sourceCache.clear();
}
