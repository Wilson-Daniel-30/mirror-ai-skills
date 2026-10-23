import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { RenderQueue, type RenderTarget } from "../src/render-jobs.ts";
import { failingFrames, findIosPreviews, harnessSource, parsePreviews } from "../src/screenshot-render-ios.ts";
import { findScreens } from "../src/screenshot-render.ts";
import { clearSourceCache } from "../src/scan.ts";
import { screenshotDir } from "../src/screenshots.ts";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("previews are read with their titles, and commented or preview-only ones are skipped", () => {
  const previews = parsePreviews(`
#Preview("Card — expired") {
    CardView(title: "a } brace in a string")
        .padding()
}

//#Preview {
//    Hidden()
//}

#Preview {
    @Previewable @State var on = true
    Toggle("x", isOn: $on)
}

#Preview(traits: .sizeThatFitsLayout) {
    Plain()
}
`);
  assert.equal(previews.length, 2);
  assert.equal(previews[0].label, "Card — expired");
  assert.match(previews[0].body, /a \} brace in a string/);
  assert.match(previews[0].body, /\.padding\(\)/);
  assert.equal(previews[1].label, null);
  assert.match(previews[1].body, /Plain\(\)/);
});

test("iOS previews match the module by path or by what the preview builds", () => {
  const root = mkdtempSync(path.join(tmpdir(), "mirror-ios-"));
  try {
    mkdirSync(path.join(root, "App/Modules/AutoPay"), { recursive: true });
    mkdirSync(path.join(root, "App/Modules/Settings"), { recursive: true });
    mkdirSync(path.join(root, "App/Modules/Home"), { recursive: true });
    writeFileSync(path.join(root, "App/Modules/AutoPay/CardView.swift"), '#Preview("Card") {\n    CardView()\n}\n');
    writeFileSync(
      path.join(root, "App/Modules/Settings/ToggleView.swift"),
      '#Preview("Biometric") {\n    BiometricView()\n}\n#Preview("Auto Logout") {\n    HandleAutoLogoutView()\n}\n',
    );
    writeFileSync(path.join(root, "App/Modules/Home/Tile.swift"), "// opens autopay\n#Preview {\n    Tile()\n}\n");
    clearSourceCache();
    assert.deepEqual(
      findIosPreviews(root, ["AUTO_PAY", "AutoPay"]).map((preview) => preview.label),
      ["Card"],
    );
    assert.deepEqual(
      findIosPreviews(root, ["AUTO_LOGOUT"]).map((preview) => preview.label),
      ["Auto Logout"],
    );
  } finally {
    clearSourceCache();
    rmSync(root, { recursive: true, force: true });
  }
});

test("a compile error is traced back to the preview it came from", () => {
  const harness = harnessSource("App", [
    { file: "A.swift", label: "One", body: "    One()" },
    { file: "B.swift", label: "Two", body: "    Two()" },
  ]);
  const twoLine = harness.text.split("\n").findIndex((line) => line.includes("Two()")) + 1;
  const output = `/x/MirrorAIFrames.swift:${twoLine}:5: error: cannot find 'Two' in scope\n/x/Other.swift:3:1: error: unrelated`;
  assert.deepEqual([...failingFrames(output, harness.lines)], [1]);
  assert.match(harness.text, /@testable import App/);
  assert.match(harness.text, /name: "two"/);
});

function target(root: string, moduleKey: string): RenderTarget {
  return { projectRoot: root, androidPath: "/a", iosPath: "/i", moduleKey, keywords: [moduleKey] };
}

test("renders run once per platform and a platform with frames is left alone", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "mirror-queue-"));
  try {
    mkdirSync(screenshotDir(root, "autopay", "android"), { recursive: true });
    writeFileSync(path.join(screenshotDir(root, "autopay", "android"), "hub.png"), PNG);
    const calls: string[] = [];
    const queue = new RenderQueue({
      android: async (job) => {
        calls.push(`android:${job.moduleKey}`);
        return { frames: ["a.png"], screens: [], gradleModules: [], log: "" };
      },
      ios: async (job) => {
        calls.push(`ios:${job.moduleKey}`);
        return { frames: [], screens: [], gradleModules: [], log: "", error: "No iOS view with a #Preview matches this module." };
      },
    });

    const job = queue.enqueue(target(root, "autopay"));
    assert.equal(job.android.state, "skipped");
    assert.equal(job.ios.state, "queued");
    // A second request while it is running joins the same job.
    assert.equal(queue.enqueue(target(root, "autopay")), job);
    await queue.idle();

    assert.deepEqual(calls, ["ios:autopay"]);
    assert.equal(queue.status("autopay")?.ios.state, "failed");
    assert.match(queue.status("autopay")?.ios.error ?? "", /No iOS view/);

    queue.enqueue(target(root, "autopay"), true);
    await queue.idle();
    assert.deepEqual(calls, ["ios:autopay", "android:autopay", "ios:autopay"]);
    assert.equal(queue.status("autopay")?.android.state, "done");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a renderer that throws is reported, and the queue keeps going", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "mirror-queue-"));
  try {
    const queue = new RenderQueue({
      android: async () => {
        throw new Error("Gradle exploded");
      },
      ios: async () => ({ frames: ["x.png"], screens: [], gradleModules: [], log: "" }),
    });
    queue.enqueue(target(root, "flowoffers"));
    await queue.idle();
    assert.equal(queue.status("flowoffers")?.android.error, "Gradle exploded");
    assert.equal(queue.status("flowoffers")?.ios.state, "done");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("android screens are the files named for the module, and a parenthesised preview name still parses", () => {
  const root = mkdtempSync(path.join(tmpdir(), "mirror-android-"));
  try {
    const main = (module: string) => path.join(root, module, "src/main/java/com/app");
    mkdirSync(main("feature/autopay"), { recursive: true });
    mkdirSync(main("feature/home"), { recursive: true });
    writeFileSync(
      path.join(main("feature/autopay"), "ActivateAutopaySheet.kt"),
      'package com.app\n\n@Preview(showBackground = true, name = "Sheet (Figma 8053:58487)")\n@Composable\nprivate fun SheetPreview() {}\n',
    );
    writeFileSync(
      path.join(main("feature/home"), "HomeScreen.kt"),
      'package com.app\n// opens Autopay\n@Preview(name = "Home")\n@Composable\nprivate fun HomePreview() {}\n',
    );
    clearSourceCache();
    const screens = findScreens(root, ["AUTO_PAY", "Autopay"]);
    assert.deepEqual(screens.map((screen) => path.basename(screen.file)), ["ActivateAutopaySheet.kt"]);
    assert.deepEqual(screens[0].previews, [{ name: "SheetPreview", label: "Sheet (Figma 8053:58487)" }]);
  } finally {
    clearSourceCache();
    rmSync(root, { recursive: true, force: true });
  }
});
