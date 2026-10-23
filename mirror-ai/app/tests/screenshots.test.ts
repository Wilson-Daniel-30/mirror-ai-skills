import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { listScreenshots, readScreenshot, screenshotDir, SCREENSHOTS_DIR } from "../src/screenshots.ts";

// A one-pixel PNG, so the bytes are a real image rather than a placeholder.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function project(): string {
  const root = mkdtempSync(path.join(tmpdir(), "mirror-shots-"));
  for (const platform of ["android", "ios"] as const) {
    mkdirSync(screenshotDir(root, "flowoffers", platform), { recursive: true });
  }
  return root;
}

test("frames are listed per platform, Android first", () => {
  const root = project();
  try {
    writeFileSync(path.join(screenshotDir(root, "flowoffers", "android"), "flow_offers_loading.png"), PNG);
    writeFileSync(path.join(screenshotDir(root, "flowoffers", "android"), "flow_offers.png"), PNG);
    writeFileSync(path.join(screenshotDir(root, "flowoffers", "ios"), "flow-offers.png"), PNG);

    const shots = listScreenshots(root, "flowoffers");
    assert.equal(shots.length, 3);
    assert.deepEqual(shots.map((shot) => shot.platform), ["android", "android", "ios"]);
    // The caption reads as words, not a filename.
    assert.deepEqual(shots.slice(0, 2).map((shot) => shot.name), ["flow offers", "flow offers loading"]);
    assert.ok(shots[0].bytes > 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a module with no frames yet lists nothing rather than failing", () => {
  const root = project();
  try {
    assert.deepEqual(listScreenshots(root, "flowoffers"), []);
    assert.deepEqual(listScreenshots(root, "never-rendered"), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a frame is read back with the right content type", () => {
  const root = project();
  try {
    writeFileSync(path.join(screenshotDir(root, "flowoffers", "android"), "a.png"), PNG);
    const shot = readScreenshot(root, "flowoffers", "android", "a.png");
    assert.ok(shot);
    assert.equal(shot.contentType, "image/png");
    assert.deepEqual(shot.body, PNG);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a file name cannot escape its own folder", () => {
  const root = project();
  try {
    writeFileSync(path.join(root, "secret.png"), PNG);
    for (const name of ["../secret.png", "../../secret.png", "sub/a.png", "..\\secret.png"]) {
      assert.equal(readScreenshot(root, "flowoffers", "android", name), null, name);
    }
    // And a non-image is refused even inside the folder.
    writeFileSync(path.join(screenshotDir(root, "flowoffers", "android"), "notes.txt"), "hello");
    assert.equal(readScreenshot(root, "flowoffers", "android", "notes.txt"), null);
    assert.deepEqual(listScreenshots(root, "flowoffers"), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("frames live beside the saved reports", () => {
  assert.match(SCREENSHOTS_DIR, /^generated reports[/\\]screenshots$/);
});
