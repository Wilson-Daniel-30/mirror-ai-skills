import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
// Stub reports go here, never into the real "generated reports" folder, which
// holds audits that took real minutes and real money to produce.
const reports = mkdtempSync(path.join(tmpdir(), "mirror-ai-reports-"));
const realReports = path.join(root, "generated reports");
const realBefore = existsSync(realReports) ? readdirSync(realReports).sort() : [];
const android = path.join(root, "fixtures/android-app");
const ios = path.join(root, "fixtures/ios-app");

/** Runs the CLI with the stub `claude` ahead of the real one on PATH. */
function cli(args: string[]) {
  const result = spawnSync("node", ["--experimental-strip-types", "src/audit-cli.ts", ...args], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${path.join(root, "tests/bin")}${path.delimiter}${process.env.PATH ?? ""}`,
      MIRROR_AI_RUNNER: "cli",
      MIRROR_AI_CLI_LOG: path.join(root, "tests/.claude-args.log"),
      MIRROR_AI_REPORTS_DIR: reports,
    },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test("--help explains the flags and exits clean", () => {
  const result = cli(["--help"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /--android <url\|path>/);
  assert.match(result.stdout, /--module <id>/);
  assert.match(result.stdout, /--common/);
});

test("a run with no repositories refuses and says why", () => {
  const result = cli(["--module", "catalog"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Both --android and --ios are required/);
});

test("--list groups every module and names the enums it read", () => {
  const result = cli(["--android", android, "--ios", ios, "--list"]);
  assert.equal(result.status, 0);
  assert.match(result.stderr, /Android: StoreModuleType/);
  assert.match(result.stderr, /iOS: StoreDestination/);
  assert.match(result.stdout, /Common modules \(4\)/);
  assert.match(result.stdout, /Android only \(1\)\n\s+CHECKOUT/);
  assert.match(result.stdout, /iOS only \(1\)\n\s+SHELF/);
  assert.match(result.stdout, /CATALOG\s+Catalog/);
});

test("a module is selectable by its constant or its label", () => {
  for (const name of ["CATALOG", "catalog", "Catalog"]) {
    const result = cli(["--android", android, "--ios", ios, "--module", name]);
    assert.equal(result.status, 0, `--module ${name} should run`);
    assert.match(result.stdout, /# Business logic audit — Catalog/);
    assert.match(result.stdout, /Stub audit of the Catalog module/);
  }
});

test("a name that matches nothing stops rather than auditing the wrong thing", () => {
  const result = cli(["--android", android, "--ios", ios, "--module", "nope"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No module matched nope/);
});

test("naming no module at all says how to choose one", () => {
  const result = cli(["--android", android, "--ios", ios]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--list shows the names/);
});

test("--common audits every shared module and --out writes the report", () => {
  const out = path.join(root, "tests/.cli-report.md");
  const result = cli(["--android", android, "--ios", ios, "--common", "--out", out]);
  assert.equal(result.status, 0);
  assert.match(result.stderr, /Auditing 4 module\(s\) with the cli runner/);
  assert.match(result.stderr, /Report written to/);
  assert.equal(result.stdout.trim(), "", "the report goes to the file, not stdout");
  const report = readFileSync(out, "utf8");
  for (const label of ["Aisle", "Catalog", "Feed", "Shop"]) {
    assert.match(report, new RegExp(`# Business logic audit — ${label}`));
  }
});

test("progress goes to stderr so the report can be piped", () => {
  const result = cli(["--android", android, "--ios", ios, "--module", "CATALOG"]);
  assert.match(result.stderr, /Reading both repositories/);
  assert.doesNotMatch(result.stdout, /Reading both repositories/);
  assert.ok(result.stdout.startsWith("# Business logic audit"));
});

test("a second run of the same module replays the saved report", () => {
  // Only the report files, never the tree: it also holds rendered screenshots.
  const clearReports = () => {
    mkdirSync(reports, { recursive: true });
    for (const entry of readdirSync(reports, { withFileTypes: true }).filter((item) => item.isFile())) {
      rmSync(path.join(reports, entry.name), { force: true });
    }
  };
  clearReports();
  try {
    const first = cli(["--android", android, "--ios", ios, "--module", "CATALOG"]);
    assert.equal(first.status, 0);
    assert.doesNotMatch(first.stderr, /reused the report/);
    assert.match(first.stdout, /Stub audit of the Catalog module/);
    const saved = readdirSync(reports);
    assert.ok(saved.some((file) => /^catalog--[0-9a-f]{16}\.md$/.test(file)), saved.join(", "));
    assert.ok(saved.some((file) => /^catalog--[0-9a-f]{16}\.json$/.test(file)));

    // The stub records its argv on every call; a replay must not invoke it.
    const log = path.join(root, "tests/.claude-args.log");
    rmSync(log, { force: true });
    const second = cli(["--android", android, "--ios", ios, "--module", "CATALOG"]);
    assert.equal(second.status, 0);
    assert.match(second.stderr, /Catalog: reused the report saved/);
    assert.match(second.stdout, /Stub audit of the Catalog module/);
    assert.equal(existsSync(log), false, "the replay must not run the audit again");

    // --refresh ignores what was saved and audits anyway.
    const forced = cli(["--android", android, "--ios", ios, "--module", "CATALOG", "--refresh"]);
    assert.equal(forced.status, 0);
    assert.doesNotMatch(forced.stderr, /reused the report/);
    assert.equal(existsSync(log), true, "--refresh runs the audit");
  } finally {
    clearReports();
  }
});

test("--reports lists what has been saved", () => {
  // Only the report files, never the tree: it also holds rendered screenshots.
  const clearReports = () => {
    mkdirSync(reports, { recursive: true });
    for (const entry of readdirSync(reports, { withFileTypes: true }).filter((item) => item.isFile())) {
      rmSync(path.join(reports, entry.name), { force: true });
    }
  };
  clearReports();
  try {
    assert.match(cli(["--reports"]).stdout, /No saved reports yet/);
    cli(["--android", android, "--ios", ios, "--module", "CATALOG"]);
    const listed = cli(["--reports"]);
    assert.equal(listed.status, 0);
    // One saved section per run: the business logic and each skill.
    assert.match(listed.stdout, /3 saved reports in "/);
    assert.match(listed.stdout, /Catalog {2}/);
    assert.match(listed.stdout, /Catalog · UI Difference/);
    assert.match(listed.stdout, /Catalog · API Contract Drift/);
  } finally {
    clearReports();
  }
});

test("the CLI tests leave the real reports folder alone", () => {
  const after = existsSync(realReports) ? readdirSync(realReports).sort() : [];
  assert.deepEqual(after, realBefore);
});
