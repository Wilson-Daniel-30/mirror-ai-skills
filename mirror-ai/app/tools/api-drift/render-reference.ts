/**
 * Renders the full-market API contract drift report from the data a
 * superapp-workspace canvas carries (`META`, `KPIS`, `BASELINE_HEADERS`,
 * `APIS`, `STALE` and the high-risk table), in the layout of that workspace's
 * `docs/templates/api-contract-drift-summary.template.md`.
 *
 *   node --experimental-strip-types tools/api-drift/render-reference.ts \
 *     <canvas.tsx> <out.md> [--slug superapp-jamaica-api-contract-drift] [--source "<repo> @ <branch>"]
 *
 * The data blocks are plain literals; they are evaluated in an empty context
 * with no globals, so nothing in the canvas can reach this process.
 */
import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";

type Contract = "same" | "drift" | "android-only" | "ios-only";
interface ApiRow {
  path: string;
  category: string;
  contract: Contract;
  drift: string[];
  risk: string;
  android: string;
  ios: string;
  notes: string;
  androidExtra: string;
  iosExtra: string;
}
interface BaselineRow { header: string; android: string; ios: string; status: string; tag: string }
interface StaleRow { path: string; android: string; ios: string; notes: string }
interface RiskRow { path: string; contract: string; check: string; drift: string[] }

const MODULE_ORDER = ["Auth", "Account", "Storefront", "Payments", "Loyalty", "Comms"];
const CONTRACT_LABEL: Record<Contract, string> = {
  same: "Same",
  drift: "Drift",
  "android-only": "Android only",
  "ios-only": "iOS only",
};

const [canvasPath, outPath, ...rest] = process.argv.slice(2);
if (!canvasPath || !outPath) {
  console.error("usage: render-reference.ts <canvas.tsx> <out.md> [--slug <slug>] [--source <text>]");
  process.exit(2);
}
const option = (name: string) => {
  const at = rest.indexOf(name);
  return at >= 0 ? rest[at + 1] : undefined;
};
const slug = option("--slug") ?? "superapp-jamaica-api-contract-drift";
const source = option("--source");

const canvas = readFileSync(canvasPath, "utf8");
const META = literal<Record<string, string>>("META");
const KPIS = literal<Record<string, number>>("KPIS");
const BASELINE = literal<BaselineRow[]>("BASELINE_HEADERS");
const APIS = literal<ApiRow[]>("APIS");
const STALE = literal<StaleRow[]>("STALE");
const RISKS = highRiskRows();

const title = option("--title") ?? "Superapp Jamaica — API Contract Drift";

checkKpis();
writeFileSync(outPath, render());
// The same data, as the page's canvas renderer reads it: next to the .md, as .json.
const dataPath = outPath.replace(/\.md$/, ".json");
writeFileSync(dataPath, `${JSON.stringify(canvasData(), null, 2)}\n`);
console.log(`wrote ${outPath} and ${dataPath}: ${APIS.length} paths, ${BASELINE.length} baseline headers, ${STALE.length} stale, ${RISKS.length} high-risk rows`);

/** Everything the canvas draws, in the shape `public/drift-canvas.js` takes. */
function canvasData() {
  return {
    title,
    meta: {
      sprint: META.sprint,
      androidSha: META.androidSha,
      iosSha: META.iosSha,
      generated: META.generated,
      chips: [`BFF ${META.bffPrefix}`, "POST JSON", `Hosts ${META.hostMatch}`, `Tenant ${META.tenantId}`],
      androidBaselineEvidence: META.androidBaselineEvidence,
      iosBaselineEvidence: META.iosBaselineEvidence,
      source: source ?? "",
    },
    kpis: { ...KPIS, exclusive: KPIS.androidOnly + KPIS.iosOnly },
    modules: MODULE_ORDER,
    apis: APIS.map((row) => ({
      path: row.path,
      category: row.category,
      contract: row.contract,
      drift: row.drift,
      risk: row.risk,
      android: row.android,
      ios: row.ios,
      notes: row.notes,
      androidExtra: row.androidExtra,
      iosExtra: row.iosExtra,
    })),
    baseline: BASELINE,
    highRisk: RISKS,
    stale: STALE,
    env: ["Dev", "Staging", "Pre-prod", "Prod"].map((env, at) => {
      const host = ["dev.", "stg.", "pre-prod.", ""][at] + META.host;
      return { env, android: host, ios: host, match: "same" };
    }),
    keyPatterns: keyPatterns(),
  };
}

// ------------------------------------------------------------------ parsing

/** `const NAME[: Type] = <literal>;` — the literal runs to the first `;` that ends a line at depth 0. */
function literal<T>(name: string): T {
  const start = new RegExp(`^const ${name}\\b[^=]*=\\s*`, "m").exec(canvas);
  if (!start) throw new Error(`${name} is not in ${canvasPath}`);
  const from = start.index + start[0].length;
  let depth = 0;
  let quote = "";
  for (let at = from; at < canvas.length; at++) {
    const char = canvas[at];
    if (quote) {
      if (char === "\\") at++;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "{" || char === "[") depth++;
    else if (char === "}" || char === "]") {
      depth--;
      if (depth === 0) {
        return vm.runInNewContext(`(${canvas.slice(from, at + 1)})`, Object.create(null), { timeout: 1000 }) as T;
      }
    }
  }
  throw new Error(`${name} never closes in ${canvasPath}`);
}

/** The high-risk table is written as JSX rows, not data, so it is read out of the markup. */
function highRiskRows(): RiskRow[] {
  const head = canvas.indexOf('headers={["Path", "Contract", "What to check", "Drift"]}');
  if (head < 0) throw new Error("No high-risk table in the canvas.");
  // The table's rows close with `]}` on a line of their own; chips inside them
  // close with `/>` too, so that cannot mark the end.
  const block = canvas.slice(head, canvas.indexOf("\n          ]}", head));
  const rows: RiskRow[] = [];
  const row =
    /<CodeInline>([\s\S]*?)<\/CodeInline>,\s*<TintedLabelChip label="([^"]+)"[^>]*\/>,\s*"((?:[^"\\]|\\.)*)",\s*<DriftTags tags=\{(\[[^\]]*\])\}/g;
  for (const match of block.matchAll(row)) {
    rows.push({
      path: match[1].replace(/\{"([^"]*)"\}/g, "$1").trim(),
      contract: match[2],
      check: JSON.parse(`"${match[3]}"`),
      drift: JSON.parse(match[4]),
    });
  }
  if (rows.length === 0) throw new Error("The high-risk table has no rows the parser recognises.");
  return rows;
}

/** The canvas states its KPIs by hand; refuse to publish if they disagree with its own rows. */
function checkKpis(): void {
  const count = (contract: Contract) => APIS.filter((row) => row.contract === contract).length;
  const derived = {
    total: APIS.length,
    same: count("same"),
    drift: count("drift"),
    androidOnly: count("android-only"),
    iosOnly: count("ios-only"),
    stale: STALE.length,
  };
  for (const [key, value] of Object.entries(derived)) {
    if (KPIS[key] !== value) throw new Error(`KPIS.${key} is ${KPIS[key]} but the rows give ${value}.`);
  }
}

// ---------------------------------------------------------------- rendering

function render(): string {
  const out: string[] = [];
  const total = APIS.length;
  const exclusive = KPIS.androidOnly + KPIS.iosOnly;

  out.push(
    `> **Interactive report:** open \`${slug}.canvas.tsx\` in Cursor (canvases folder) — same \`${slug}\` as this markdown file basename.`,
    "> This file includes the full API inventory and baseline header tables (same data as the canvas).",
    "",
    `# ${META.market} — API contract drift`,
    "",
    "| | |",
    "|---|---|",
    `| **Generated** | ${META.generated} |`,
    `| **Market** | ${META.market} |`,
    `| **Sprint branch** | \`${META.sprint}\` |`,
    `| **Android** | \`lla-superapp-android\` @ \`${META.androidSha}\` |`,
    `| **iOS** | \`lla-superapp-ios\` @ \`${META.iosSha}\` |`,
    `| **BFF prefix** | \`${META.bffPrefix}\` |`,
    "| **Method** | POST JSON |",
    `| **Hosts** | ${META.hostMatch} — \`${META.host}\` on both |`,
    `| **Tenant** | ${META.tenantId} |`,
  );
  if (source) out.push(`| **Source** | ${source} |`);

  out.push(
    "",
    "## KPIs",
    "",
    "| Metric | Count |",
    "|--------|------:|",
    `| APIs audited | ${KPIS.total} |`,
    `| Contract match | ${KPIS.same} |`,
    `| Drift | ${KPIS.drift} |`,
    `| Platform exclusive | ${exclusive} |`,
    `| High risk | ${KPIS.highRisk} |`,
    `| Stale constants | ${KPIS.stale} |`,
    "",
    "## Contract status",
    "",
    "| Status | Count | % |",
    "|--------|------:|--:|",
    `| Same | ${KPIS.same} | ${pct(KPIS.same, total)} |`,
    `| Drift | ${KPIS.drift} | ${pct(KPIS.drift, total)} |`,
    `| Android only | ${KPIS.androidOnly} | ${pct(KPIS.androidOnly, total)} |`,
    `| iOS only | ${KPIS.iosOnly} | ${pct(KPIS.iosOnly, total)} |`,
    "",
    `**Total paths:** ${total} · **Wired on both:** ${KPIS.same + KPIS.drift}`,
    "",
    "## How to read",
    "",
    "| Column | Meaning |",
    "|--------|---------|",
    "| **Contract** | Cross-platform alignment per path: **Same** · **Drift** · **Android only** · **iOS only** |",
    "| **Drift** | Mismatch type when shared: `BODY` · `HDR` · `ROUTE` · `TYPE` · `CASE` · `HOST` |",
    "| **Android extra / iOS extra** | Per-call headers beyond interceptor baseline — *baseline* when none; `+ lob`, `+ countryCode`, uid casing notes |",
    "",
    "## Module summary",
    "",
    "| Module | APIs | Same | Drift | HDR | Exclusive | Total diff |",
    "|--------|-----:|-----:|------:|----:|----------:|-----------:|",
  );
  for (const module of MODULE_ORDER) {
    const s = summarize(APIS.filter((row) => row.category === module));
    out.push(`| ${module} | ${s.apis} | ${s.same} | ${dash(s.drift)} | ${dash(s.hdr)} | ${s.exclusive} | ${s.totalDiff} |`);
  }

  out.push(
    "",
    "## High-risk findings",
    "",
    "| Path | Contract | What to check | Drift |",
    "|------|----------|---------------|-------|",
    ...RISKS.map((r) => row([code(r.path), bold(r.contract), r.check, tags(r.drift)])),
  );

  const status = (value: string) => BASELINE.filter((h) => h.status === value).length;
  const baselineDiff = status("Drift") + status("A only") + status("iOS only");
  out.push(
    "",
    "## Baseline headers (interceptors)",
    "",
    "| | Count |",
    "|---|------:|",
    `| Headers audited | ${BASELINE.length} |`,
    `| Same | ${status("Same")} |`,
    `| Drift | ${status("Drift")} |`,
    `| Android only | ${status("A only")} |`,
    `| iOS only | ${status("iOS only")} |`,
    `| **Total diffs** | ${baselineDiff} |`,
    "",
    "**Full baseline table** (interceptors @ sprint SHA):",
    "",
    "| Header | Android | iOS | Status | Tag |",
    "|--------|---------|-----|--------|-----|",
    ...BASELINE.map((h) => row([code(h.header), h.android, h.ios, h.status, h.tag === "—" ? "—" : tags([h.tag])])),
    "",
    `Source: Android \`${META.androidBaselineEvidence}\` · iOS \`${META.iosBaselineEvidence}\``,
    "",
    "## API inventory by module",
    "",
    "All paths at pinned SHA. Columns: **Path · Contract · Drift · Android extra · iOS extra · Android body · iOS body · Notes**",
  );
  for (const module of MODULE_ORDER) {
    out.push(
      "",
      `### ${module}`,
      "",
      "| Path | Contract | Drift | Android extra | iOS extra | Android body | iOS body | Notes |",
      "|------|----------|-------|---------------|-----------|--------------|----------|-------|",
      ...APIS.filter((r) => r.category === module).map((r) =>
        row([
          code(r.path),
          bold(CONTRACT_LABEL[r.contract]),
          r.drift.length ? tags(r.drift) : "—",
          extra(r.androidExtra),
          extra(r.iosExtra),
          r.android,
          r.ios,
          r.notes || "—",
        ]),
      ),
    );
  }

  out.push(
    "",
    "## Stale constants",
    "",
    "| Path | Android | iOS | Notes |",
    "|------|---------|-----|-------|",
    ...STALE.map((s) => row([code(s.path), s.android, s.ios, s.notes])),
    "",
    "## Environment base URLs",
    "",
    "| Env | Android | iOS | Match |",
    "|-----|---------|-----|-------|",
    `| Dev | \`dev.${META.host}\` | \`dev.${META.host}\` | same |`,
    `| Staging | \`stg.${META.host}\` | \`stg.${META.host}\` | same |`,
    `| Pre-prod | \`pre-prod.${META.host}\` | \`pre-prod.${META.host}\` | same |`,
    `| Prod | \`${META.host}\` | \`${META.host}\` | same |`,
    "",
    "## Key patterns",
    "",
    ...keyPatterns().map((line) => `- ${line}`),
    "",
    "---",
    "",
    "Generated by API contract drift workflow · `docs/10-api-contract-drift.md`  ",
    `Market: ${META.market} · SHAs: ${META.androidSha} / ${META.iosSha} · **Canvas (charts + tinted UI):** \`${slug}.canvas.tsx\``,
    "",
  );
  return out.join("\n");
}

/** Read off the rows, so a regenerated canvas cannot leave a stale claim behind. */
function keyPatterns(): string[] {
  const patterns: string[] = [];
  const casing = BASELINE.find((h) => h.tag === "CASE");
  if (casing) {
    patterns.push(`\`${casing.header}\` casing on every authenticated call — Android ${casing.android}; iOS ${casing.ios}.`);
  }
  const androidOnly = APIS.filter((r) => r.contract === "android-only");
  const byModule = MODULE_ORDER.map((m) => [m, androidOnly.filter((r) => r.category === m).length] as const)
    .filter(([, n]) => n > 0)
    .map(([m, n]) => `${m} ${n}`)
    .join(", ");
  const pa = androidOnly.filter((r) => r.path.startsWith("PA/")).map((r) => `\`${r.path}\``);
  patterns.push(
    `${androidOnly.length} Android-only paths (${byModule})${pa.length ? `, including the Sigma/ESB payment paths ${pa.join(", ")} with no iOS wiring` : ""}.`,
  );
  const orchestration = APIS.filter((r) => r.contract === "drift" && r.drift.includes("ROUTE"));
  for (const r of orchestration) patterns.push(`Orchestration split on \`${r.path}\` — Android ${r.android}; iOS ${r.ios}.`);
  const bodyDrift = APIS.filter((r) => r.contract === "drift" && r.drift.includes("BODY") && !r.drift.includes("ROUTE"));
  if (bodyDrift.length) {
    patterns.push(`Body drift on shared paths, mostly in Payments: ${bodyDrift.map((r) => `\`${r.path}\``).join(", ")}.`);
  }
  // A HeaderMap may well carry lob, so a row with one is not counted as one-sided.
  const lobOneSide = APIS.filter(
    (r) =>
      (r.contract === "same" || r.contract === "drift") &&
      !/HeaderMap/.test(r.androidExtra + r.iosExtra) &&
      /lob/.test(r.androidExtra) !== /lob/.test(r.iosExtra),
  );
  if (lobOneSide.length) {
    patterns.push(`\`+ lob\` is sent on one platform only for ${lobOneSide.map((r) => `\`${r.path}\``).join(", ")}.`);
  }
  return patterns.slice(0, 5);
}

function summarize(items: ApiRow[]) {
  return {
    apis: items.length,
    same: items.filter((r) => r.contract === "same").length,
    drift: items.filter((r) => r.contract === "drift").length,
    hdr: items.filter((r) => r.drift.includes("HDR")).length,
    exclusive: items.filter((r) => r.contract === "android-only" || r.contract === "ios-only").length,
    totalDiff: items.filter((r) => r.contract !== "same" || r.drift.includes("HDR")).length,
  };
}

function row(cells: string[]): string {
  for (const cell of cells) {
    if (cell.includes("|")) throw new Error(`A cell contains a pipe and would split the table: ${cell}`);
  }
  return `| ${cells.map(literalStars).join(" | ")} |`;
}

// A value like the Accept header's `*/*` is data, not emphasis; code
// formatting keeps it literal.
function literalStars(cell: string): string {
  if (!cell.includes("*") || cell.includes("`")) return cell;
  if (/^\*\*\w[^*]*\*\*$|^\*\w[^*]*\*$/.test(cell)) return cell;
  return code(cell);
}

function pct(count: number, total: number): string {
  return total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
}

function dash(value: number): string {
  return value === 0 ? "—" : String(value);
}

function code(value: string): string {
  return `\`${value}\``;
}

function bold(value: string): string {
  return `**${value}**`;
}

function tags(values: string[]): string {
  return values.map(code).join(", ");
}

function extra(value: string): string {
  return value === "baseline" ? "*baseline*" : value === "—" ? "—" : code(value);
}
