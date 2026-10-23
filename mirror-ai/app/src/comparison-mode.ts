import type { ComparisonMode } from "./types.ts";

export function parseComparisonMode(value: unknown): ComparisonMode {
  return value === "repository" ? "repository" : "module";
}
