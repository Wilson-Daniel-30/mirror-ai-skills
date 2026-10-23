import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { compareRepos, renderReport } from "../src/index.ts";
import { comparisonRequest, prepareWorkflow } from "../src/workflow.ts";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const androidPath = path.join(root, "fixtures/android-app");
const iosPath = path.join(root, "fixtures/ios-app");
const reportPath = path.join(root, "reports/fixture-comparison.stub.md");

test("fixture comparison reports a confirmed mismatch and a needs-verification finding", () => {
  const scope = { kind: "full" } as const;
  const logPath = path.join(root, "tests/.npx.log");
  writeFileSync(logPath, "");
  const savedPath = process.env.PATH;
  process.env.PATH = `${path.join(root, "tests/bin")}${path.delimiter}${savedPath ?? ""}`;
  process.env.MIRROR_AI_NPX_LOG = logPath;
  try {
  const request = comparisonRequest(scope);
  const workflow = prepareWorkflow(request, root);
  const result = compareRepos({
    androidPath,
    iosPath,
    scope,
  });
  result.workflow = workflow;
  const cli = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      path.join(root, "src/cli.ts"),
      "--android",
      androidPath,
      "--ios",
      iosPath,
      "--full",
      "--out",
      reportPath,
    ],
    { cwd: root, encoding: "utf8", env: process.env },
  );
  assert.equal(cli.status, 0, `${cli.stdout}\n${cli.stderr}`);
  const markdown = readFileSync(reportPath, "utf8");
  assert.equal(markdown, renderReport(result));
  const calls = readFileSync(logPath, "utf8");
  assert.match(calls, /skills find Android\/iOS comparison/);
  assert.match(calls, /ruflo memory search/);
  assert.match(calls, /ruflo route Compare Android and iOS/);
  assert.match(calls, /ruflo memory store -k compare-android-ios/);
  assert.doesNotMatch(calls, /skills add/);
  assert.match(markdown, /^- Skill: none$/m);
  assert.match(markdown, /^- Ruflo route: Tester$/m);

  assert.ok(result.discoveredNames.includes("Just for You"));
  assert.ok(result.discoveredNames.includes("Shop"));
  assert.equal(result.compared.length, 2);

  const justForYou = result.compared.find((module) => module.name === "Just for You");
  const shop = result.compared.find((module) => module.name === "Shop");
  assert.ok(justForYou?.android);
  assert.ok(justForYou?.ios);
  assert.ok(shop?.android);
  assert.ok(shop?.ios);
  assert.ok(justForYou.android.files.some((file) => file.endsWith("RecommendationViewModel.kt")));
  assert.ok(justForYou.ios.files.some((file) => file.endsWith("PersonalizedShelfView.swift")));
  assert.ok(justForYou.ios.files.some((file) => file.endsWith("ShelfLoader.swift")));
  assert.ok(justForYou.android.files.some((file) => file.endsWith("Recommendation.kt")));
  assert.ok(justForYou.ios.files.some((file) => file.endsWith("RecommendationItem.swift")));
  assert.ok(shop.android.files.some((file) => file.endsWith("AisleBrowser.kt")));
  assert.ok(shop.ios.files.some((file) => file.endsWith("ProductGridView.swift")));
  assert.ok(justForYou.android.navigationFiles.some((file) => file.endsWith("NavHost.kt")));
  assert.ok(justForYou.ios.navigationFiles.some((file) => file.endsWith("AppRouter.swift")));
  assert.ok(shop.android.navigationFiles.some((file) => file.endsWith("NavHost.kt")));
  assert.ok(
    justForYou.mappingBasis.some((basis) => /screen title/i.test(basis) && /Just for You/.test(basis)),
  );
  assert.ok(justForYou.mappingBasis.some((basis) => basis.includes("/v1/feed/recommendations")));
  assert.ok(justForYou.mappingBasis.some((basis) => /call relationship/i.test(basis)));
  assert.ok(shop.mappingBasis.some((basis) => basis.includes("/v1/catalog/products")));

  const confirmed = result.findings.filter((finding) => finding.status === "confirmed mismatch");
  const verify = result.findings.filter((finding) => finding.status === "needs runtime verification");
  assert.ok(confirmed.length >= 1);
  assert.ok(verify.length >= 1);
  assert.ok(
    confirmed.some(
      (finding) =>
        finding.category === "Business logic and user flows" &&
        finding.module === "Just for You" &&
        /price/i.test(`${finding.difference} ${finding.evidence}`) &&
        /12/.test(`${finding.difference} ${finding.evidence}`),
    ),
  );
  assert.ok(
    confirmed.some(
      (finding) =>
        finding.category === "API and data parity" &&
        finding.module === "Shop" &&
        /popularity/.test(finding.evidence) &&
        /relevance/.test(finding.evidence),
    ),
  );
  assert.ok(
    confirmed.some(
      (finding) =>
        finding.category === "UI and design parity" &&
        finding.module === "Shop" &&
        finding.evidence.includes("No products in this aisle") &&
        finding.evidence.includes("Your shop is empty"),
    ),
  );
  assert.ok(confirmed.some((finding) => finding.category === "Test coverage and quality"));
  assert.ok(
    verify.some(
      (finding) =>
        finding.category === "UI and design parity" &&
        /skeleton|ProgressView/i.test(`${finding.difference} ${finding.evidence}`),
    ),
  );

  for (const finding of result.findings) {
    assert.ok(finding.difference.length > 0);
    assert.ok(finding.evidence.length > 0);
    assert.ok(finding.suggestedFix.length > 0);
    assert.match(markdown, new RegExp(finding.status));
    assert.ok(lineAt(androidPath, finding.android.file, finding.android.line).trim());
    assert.ok(lineAt(iosPath, finding.ios.file, finding.ios.line).trim());
  }
  assert.match(markdown, /confirmed mismatch/);
  assert.match(markdown, /needs runtime verification/);
  assert.match(markdown, /RecommendationViewModel\.kt:\d+/);
  assert.match(markdown, /PersonalizedShelfView\.swift|ShelfLoader\.swift/);
  } finally {
    if (savedPath === undefined) delete process.env.PATH;
    else process.env.PATH = savedPath;
    delete process.env.MIRROR_AI_NPX_LOG;
  }
});

test("selected module limits the report to that module", () => {
  const shop = compareRepos({
    androidPath,
    iosPath,
    scope: { kind: "modules", names: ["Shop"] },
  });
  assert.ok(shop.findings.length > 0);
  assert.ok(shop.findings.every((finding) => finding.module === "Shop"));
  assert.deepEqual(shop.omittedNames, ["Just for You"]);
  assert.deepEqual(shop.missingRequests, []);

  const missing = compareRepos({
    androidPath,
    iosPath,
    scope: { kind: "modules", names: ["Offers"] },
  });
  assert.deepEqual(missing.missingRequests, ["Offers"]);
  assert.equal(missing.findings.length, 0);
});

function lineAt(rootDir: string, file: string, line: number): string {
  const text = readFileSync(path.join(rootDir, file), "utf8").split(/\r?\n/);
  return text[line - 1] ?? "";
}
