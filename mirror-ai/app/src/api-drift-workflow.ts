import { readFileSync } from "node:fs";
import path from "node:path";
import type { ComparisonMode } from "./types.ts";

/**
 * Canonical full-market workflow from superapp-workspace
 * (`docs/10-api-contract-drift.md`, branch `feature/api-contract-drift-v2`).
 * The api-skill pass reads this at runtime so section 4 is always discovered
 * from the pinned Android/iOS checkouts, never from a baked-in market report.
 */
export const API_DRIFT_WORKFLOW = "prompts/references/api-contract-drift-workflow.md";

export function readApiDriftWorkflow(projectRoot: string): string {
  try {
    return readFileSync(path.join(projectRoot, API_DRIFT_WORKFLOW), "utf8").trim();
  } catch {
    return "";
  }
}

/** Extra instructions appended to the api-skill system prompt for this audit. */
export function apiDriftScopeNote(mode: ComparisonMode): string {
  if (mode === "repository") {
    return [
      "## Scope for this run — full market",
      "",
      "Inventory **every wired BFF path** in both checkouts at the pinned commits.",
      "Follow the workflow's full-market discovery gates and tables (Meta, KPIs, inventory, baseline, stale, environment).",
      "**Do not** paste rows from another market, an old `docs/reports/*.md`, or Mirror AI's `reference/` folder — only code you read in these two repos.",
    ].join("\n");
  }
  return [
    "## Scope for this run — this module only",
    "",
    "Inventory BFF paths **this module** reaches on each platform (directly or via repositories/use cases).",
    "Use the same contract values, drift tags, and column sets as the workflow.",
    "**Do not** paste another module's or market's inventory; discover from the pinned checkouts.",
  ].join("\n");
}
