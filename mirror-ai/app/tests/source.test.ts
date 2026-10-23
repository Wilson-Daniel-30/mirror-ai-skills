import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { readSourceView, resolveFile, withinRoot } from "../src/source.ts";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const android = path.join(root, "fixtures/android-app");
const ios = path.join(root, "fixtures/ios-app");

test("resolves a citation written in full, abbreviated, or as a bare filename", () => {
  const full = "app/src/main/java/com/example/store/catalog/CatalogApi.kt";
  assert.equal(resolveFile(android, full), full);
  assert.equal(resolveFile(android, "app/.../catalog/CatalogApi.kt"), full);
  assert.equal(resolveFile(android, "CatalogApi.kt"), full);
  assert.equal(resolveFile(ios, "App/Features/Browse/CatalogClient.swift"), "App/Features/Browse/CatalogClient.swift");
});

test("refuses a citation that names no file, or more than one", () => {
  assert.equal(resolveFile(android, "NotHere.kt"), null);
  assert.equal(resolveFile(android, ""), null);
  // Both platforms declare a Product; within one checkout the name is unique,
  // but a segment that does not appear in the path must not match.
  assert.equal(resolveFile(android, "feed/CatalogApi.kt"), null);
});

test("shows the cited lines in context and marks them", async () => {
  const view = await readSourceView(android, "CatalogApi.kt", 8, 10);
  assert.ok(view);
  assert.equal(view.file, "app/src/main/java/com/example/store/catalog/CatalogApi.kt");
  assert.equal(view.focusStart, 8);
  assert.equal(view.focusEnd, 10);
  assert.ok(view.start < 8, "a few lines of context come first");
  assert.ok(view.end > 10, "a few lines of context come after");
  assert.equal((view.html.match(/class="line cited"/g) ?? []).length, 3);
  assert.match(view.html, /class="shiki/);
});

test("a line past the end of the file clamps instead of failing", async () => {
  const view = await readSourceView(android, "CatalogApi.kt", 9_999, 10_000);
  assert.ok(view);
  assert.ok(view.focusStart <= view.end);
  assert.equal(view.focusEnd, view.focusStart);
});

test("a citation cannot escape the checkout", () => {
  assert.equal(withinRoot(android, "app/src/main/java/com/example/store/catalog/Product.kt"), true);
  assert.equal(withinRoot(android, "../ios-app/App/Router/AppRouter.swift"), false);
  assert.equal(withinRoot(android, "/etc/passwd"), false);
});

test("an absolute citation from the other checkout's working directory still opens", () => {
  // A CLI run works from the Android checkout, so it tends to cite iOS files
  // absolutely. The page's pattern captures the tail of that path.
  const relative = "App/Features/Browse/CatalogClient.swift";
  assert.equal(resolveFile(ios, `/Users/someone/work/repos/ios-app/${relative}`), relative);
  assert.equal(resolveFile(ios, `AI/repos/ios-app/${relative}`), relative);
  assert.equal(resolveFile(ios, `./${relative}`), relative);
});

test("a tail that belongs to no file is still refused", () => {
  assert.equal(resolveFile(ios, "/Users/someone/work/repos/ios-app/App/Nope.swift"), null);
  assert.equal(resolveFile(android, "feed/CatalogApi.kt"), null);
});
