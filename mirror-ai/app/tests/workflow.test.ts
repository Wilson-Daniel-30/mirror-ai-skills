import assert from "node:assert/strict";
import { test } from "node:test";
import { bestLocalSkill, chooseRemoteSkill, parseRoute, parseSkillsFind } from "../src/workflow.ts";

test("skills find skips tiny installs and prefers a known source", () => {
  const output = [
    "Install with npx skills add <owner/repo@skill>",
    "someone/repo@popular 2.2K installs",
    "└ https://skills.sh/someone/repo/popular",
    "vercel-labs/skills@find-skills 3.8M installs",
    "unknown/repo@tiny 50 installs",
    "jpoindexter/design-and-ai-skills@platform-conventions 4 installs",
  ].join("\n");
  const chosen = chooseRemoteSkill(parseSkillsFind(output));
  assert.equal(chosen?.ownerRepo, "vercel-labs/skills");
  assert.equal(chosen?.name, "find-skills");
  assert.equal(chooseRemoteSkill(parseSkillsFind("evil/repo@meh 150 installs")), null);
});

test("a single ios mention does not select a local skill", () => {
  const swiftui = {
    name: "swiftui-liquid-glass",
    description: "Implement SwiftUI features using the iOS 26 Liquid Glass API",
    dir: "/skills/swiftui-liquid-glass",
  };
  const compare = {
    name: "android-ios-diff",
    description: "Compare Android and iOS screen behavior",
    dir: "/skills/android-ios-diff",
  };
  assert.equal(bestLocalSkill([swiftui], "Android/iOS comparison", ["Android/iOS comparison"]), null);
  assert.equal(
    bestLocalSkill([swiftui, compare], "Android/iOS comparison", ["Android/iOS comparison"])?.name,
    "android-ios-diff",
  );
  assert.equal(
    bestLocalSkill(
      [{ name: "shop", description: "Catalog browsing", dir: "/skills/shop" }],
      "Shop",
      ["Shop"],
    )?.name,
    "shop",
  );
});

test("route output keeps the agent name", () => {
  assert.equal(parseRoute("Routed to Debugger\n\nAgent: Debugger (debugger)\n"), "Debugger");
  assert.equal(parseRoute({ status: 1, stdout: "", stderr: "Database not found" }), "unavailable (Database not found)");
});
