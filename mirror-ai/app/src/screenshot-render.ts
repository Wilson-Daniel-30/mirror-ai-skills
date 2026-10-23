import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { screenshotDir } from "./screenshots.ts";
import { readSources } from "./scan.ts";

const VARIANT = process.env.MIRROR_AI_ANDROID_VARIANT || "JmDevDebug";
const PLUGIN_VERSION = process.env.COMPOSE_SCREENSHOT_VERSION || "0.0.1-alpha16";
const TIMEOUT_MS = Number(process.env.MIRROR_AI_RENDER_TIMEOUT_MS) || 1_800_000;
/** Rendering every screen a big module touches would take far too long. */
const MAX_SCREENS = Number(process.env.MIRROR_AI_MAX_SCREENS) || 6;

export interface RenderRequest {
  projectRoot: string;
  androidPath: string;
  moduleKey: string;
  keywords: string[];
}

export interface RenderResult {
  frames: string[];
  screens: string[];
  gradleModules: string[];
  log: string;
  error?: string;
}

interface PreviewFn {
  name: string;
  /** The `name =` on the original @Preview, which becomes the frame's filename. */
  label: string;
}

interface ScreenFile {
  /** Absolute path of the screen's source file. */
  file: string;
  packageName: string;
  gradleModule: string;
  gradlePath: string;
  previews: PreviewFn[];
}

/**
 * Renders a module's Android screens through layoutlib by borrowing the app's
 * own previews. They are `private`, so the file is briefly rewritten to make
 * them `internal` — a test source set can see that — and a generated
 * `screenshotTest` class calls each one under `@PreviewTest`, which is what the
 * plugin's JUnit engine discovers. Every edit is reverted before returning.
 */
export async function renderAndroidScreens(request: RenderRequest): Promise<RenderResult> {
  const screens = findScreens(request.androidPath, request.keywords).slice(0, MAX_SCREENS);
  if (screens.length === 0) {
    return { frames: [], screens: [], gradleModules: [], log: "", error: "No Android screen with a @Preview matches this module." };
  }
  const gradleModules = [...new Set(screens.map((screen) => screen.gradlePath))];
  const edits = new Map<string, string | null>();
  const remember = (file: string) => {
    if (!edits.has(file)) edits.set(file, existsSync(file) ? readFileSync(file, "utf8") : null);
  };
  const generated: string[] = [];

  try {
    for (const screen of screens) {
      remember(screen.file);
      writeFileSync(screen.file, openPreviews(readFileSync(screen.file, "utf8"), screen.previews));
      const harness = harnessPath(request.androidPath, screen);
      mkdirSync(path.dirname(harness), { recursive: true });
      remember(harness);
      writeFileSync(harness, harnessSource(screen));
      generated.push(path.dirname(harness));
    }
    for (const gradleModule of gradleModules) {
      const dir = path.join(request.androidPath, gradleModule.replace(/^:/, "").replace(/:/g, "/"));
      const build = path.join(dir, "build.gradle.kts");
      remember(build);
      writeFileSync(build, enableScreenshots(readFileSync(build, "utf8")));
    }
    // The plugins {} block is evaluated before android {}, so the module-level
    // property alone is too late to let the plugin apply. The project-wide flag
    // has to be set as well.
    const gradleProperties = path.join(request.androidPath, "gradle.properties");
    remember(gradleProperties);
    const properties = readFileSync(gradleProperties, "utf8");
    if (!properties.includes("android.experimental.enableScreenshotTest")) {
      writeFileSync(gradleProperties, `${properties.trimEnd()}\nandroid.experimental.enableScreenshotTest=true\n`);
    }

    const localProperties = path.join(request.androidPath, "local.properties");
    if (!existsSync(localProperties)) {
      remember(localProperties);
      writeFileSync(localProperties, `sdk.dir=${process.env.ANDROID_HOME || `${process.env.HOME}/Library/Android/sdk`}\n`);
    }

    const tasks = gradleModules.map((gradleModule) => `${gradleModule}:update${VARIANT}ScreenshotTest`);
    const run = await gradle(request.androidPath, tasks);
    if (run.code !== 0) {
      return {
        frames: [],
        screens: screens.map((screen) => path.basename(screen.file)),
        gradleModules,
        log: run.output,
        error: gradleError(run.output),
      };
    }
    const frames = collect(request, gradleModules);
    return {
      frames,
      screens: screens.map((screen) => path.basename(screen.file)),
      gradleModules,
      log: run.output,
      error: frames.length === 0 ? "The build succeeded but produced no frames." : undefined,
    };
  } finally {
    // Put every file back, including ones that did not exist before.
    for (const [file, original] of edits) {
      if (original === null) rmSync(file, { force: true });
      else writeFileSync(file, original);
    }
    for (const dir of new Set(generated)) rmSync(dir, { recursive: true, force: true });
    for (const gradleModule of gradleModules) {
      const dir = path.join(request.androidPath, gradleModule.replace(/^:/, "").replace(/:/g, "/"), "src");
      for (const entry of safeReaddir(dir)) {
        if (entry.startsWith("screenshotTest")) rmSync(path.join(dir, entry), { recursive: true, force: true });
      }
    }
  }
}

/**
 * Which source file each of a module's frames was rendered from, keyed by
 * frame name: a frame is named for its preview's label, so the label leads
 * back to the file. The page uses it to put a frame on the screen it shows.
 */
export function androidFrameSources(androidPath: string, keywords: string[]): Map<string, string> {
  const sources = new Map<string, string>();
  for (const screen of findScreens(androidPath, keywords)) {
    for (const preview of screen.previews) {
      sources.set(slug(preview.label), path.relative(path.resolve(androidPath), screen.file));
    }
  }
  return sources;
}

export function findScreens(androidPath: string, keywords: string[]): ScreenFile[] {
  const needles = keywords.map((keyword) => keyword.toLowerCase()).filter((keyword) => keyword.length >= 4);
  const screens: ScreenFile[] = [];
  for (const source of readSources(androidPath)) {
    // Teams keep previews beside the screen or in a sibling `…Previews.kt`;
    // sheets and dialogs are screens too.
    if (!/(Screen|Sheet|Dialog|Previews?)\.kt$/.test(source.relativePath)) continue;
    if (!source.relativePath.includes("/src/main/")) continue;
    if (!source.text.includes("@Preview")) continue;
    const where = squash(source.relativePath);
    if (!needles.some((needle) => source.lower.includes(needle) || where.includes(squash(needle)))) continue;
    const previews = findPreviews(source.text);
    if (previews.length === 0) continue;
    const gradleModule = gradleModuleOf(source.relativePath);
    if (!gradleModule) continue;
    screens.push({
      file: path.join(path.resolve(androidPath), source.relativePath),
      packageName: /^package\s+([\w.]+)/m.exec(source.text)?.[1] ?? "",
      gradleModule,
      gradlePath: `:${gradleModule.replace(/\//g, ":")}`,
      previews,
    });
  }
  // A screen that only links to the module (a home tile, a wallet row)
  // mentions it too. When some files are named for the module, use only those.
  const squashed = keywords.map(squash).filter((keyword) => keyword.length >= 4);
  const named = screens.filter((screen) =>
    squashed.some((keyword) => squash(path.relative(androidPath, screen.file)).includes(keyword)),
  );
  return dropOrphans(androidPath, named.length > 0 ? named : screens).sort(
    (left, right) => right.previews.length - left.previews.length,
  );
}

/**
 * A repo can hold a live screen and an orphan copy with the same name — same
 * class names, even the same Figma id. The live one is the package something
 * else imports; the orphan is imported by nothing outside itself. Rendering
 * both would also collide on frame filenames.
 */
function dropOrphans(androidPath: string, screens: ScreenFile[]): ScreenFile[] {
  const byName = new Map<string, ScreenFile[]>();
  for (const screen of screens) {
    const name = path.basename(screen.file);
    byName.set(name, [...(byName.get(name) ?? []), screen]);
  }
  const kept: ScreenFile[] = [];
  for (const group of byName.values()) {
    if (group.length === 1) {
      kept.push(group[0]);
      continue;
    }
    const live = group.filter((screen) => isImportedElsewhere(androidPath, screen));
    kept.push(...(live.length > 0 ? live : [group[0]]));
  }
  return kept;
}

function isImportedElsewhere(androidPath: string, screen: ScreenFile): boolean {
  const needle = `import ${screen.packageName}.`;
  for (const source of readSources(androidPath)) {
    if (source.relativePath.startsWith(screen.packageName.replace(/\./g, "/"))) continue;
    if (!source.text.includes(needle)) continue;
    const owner = /^package\s+([\w.]+)/m.exec(source.text)?.[1] ?? "";
    if (owner !== screen.packageName) return true;
  }
  return false;
}

/** `@Preview(... name = "X") @Composable private fun YPreview()` */
function findPreviews(text: string): PreviewFn[] {
  const previews: PreviewFn[] = [];
  // The argument list may hold a quoted name with its own parentheses.
  const pattern = /@Preview\(((?:"[^"]*"|[^)"])*)\)\s*(?:@[\w.]+(?:\([^)]*\))?\s*)*@Composable\s*(?:@[\w.]+(?:\([^)]*\))?\s*)*(?:private|internal)?\s*fun\s+(\w+)\s*\(\s*\)/g;
  for (const match of text.matchAll(pattern)) {
    // Fall back to the function name, minus the Preview suffix that every one
    // of them carries, so the frame is called `top_up_enter_amount` not
    // `top_up_enter_amount_screen_preview`.
    const label = /name\s*=\s*"([^"]+)"/.exec(match[1])?.[1] ?? match[2].replace(/(Screen)?Preview$/, "");
    previews.push({ name: match[2], label });
  }
  return previews;
}

function openPreviews(text: string, previews: PreviewFn[]): string {
  let out = text;
  for (const preview of previews) {
    // `internal` is visible to the module's test source sets; `private` is not.
    out = out.replace(new RegExp(`private(\\s+fun\\s+${preview.name}\\s*\\()`), "internal$1");
  }
  return out;
}

function harnessPath(androidPath: string, screen: ScreenFile): string {
  return path.join(
    path.resolve(androidPath),
    screen.gradleModule,
    "src/screenshotTest/kotlin",
    screen.packageName.replace(/\./g, "/"),
    `${path.basename(screen.file, ".kt")}Frames.kt`,
  );
}

function harnessSource(screen: ScreenFile): string {
  const className = `${path.basename(screen.file, ".kt")}Frames`;
  const methods = screen.previews
    .map(
      (preview, index) => `
    @PreviewTest
    @Preview(showBackground = true, name = ${JSON.stringify(slug(preview.label))})
    @Composable
    fun frame${index}() {
        ${preview.name}()
    }`,
    )
    .join("\n");
  return `package ${screen.packageName}

import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import com.android.tools.screenshot.PreviewTest

/** Generated by Mirror AI. Calls this screen's own previews so the frames use
 *  the fixtures the app already wrote. Deleted after each render. */
class ${className} {${methods}
}
`;
}

function enableScreenshots(build: string): string {
  let out = build;
  if (!out.includes("com.android.compose.screenshot")) {
    out = out.replace(/plugins\s*\{\n/, `plugins {\n    id("com.android.compose.screenshot") version "${PLUGIN_VERSION}"\n`);
  }
  if (!out.includes("enableScreenshotTest")) {
    // AGP 9 wants this on the module, not only in gradle.properties.
    out = out.replace(/android\s*\{\n/, 'android {\n    experimentalProperties["android.experimental.enableScreenshotTest"] = true\n');
  }
  if (!out.includes("screenshot-validation-api")) {
    out = `${out.trimEnd().replace(/\}$/, "").trimEnd()}\n    screenshotTestImplementation("androidx.compose.ui:ui-tooling")\n    screenshotTestImplementation("com.android.tools.screenshot:screenshot-validation-api:${PLUGIN_VERSION}")\n}\n`;
  }
  return out;
}

function collect(request: RenderRequest, gradleModules: string[]): string[] {
  const out = screenshotDir(request.projectRoot, request.moduleKey, "android");
  mkdirSync(out, { recursive: true });
  const frames: string[] = [];
  for (const gradleModule of gradleModules) {
    const results = path.join(
      request.androidPath,
      gradleModule.replace(/^:/, "").replace(/:/g, "/"),
      "build/outputs/screenshotTest-results",
    );
    for (const png of findPngs(results)) {
      // <method>_<preview name>_<hash>_0.png — keep the preview name.
      const base = path.basename(png, ".png").replace(/^[A-Za-z]+\d*_/, "").replace(/_[0-9a-f]{8}_\d+$/, "");
      const target = path.join(out, `${base || path.basename(png, ".png")}.png`);
      writeFileSync(target, readFileSync(png));
      frames.push(path.basename(target));
    }
  }
  return frames.sort();
}

function findPngs(dir: string): string[] {
  const found: string[] = [];
  const walk = (current: string) => {
    for (const entry of safeReaddir(current)) {
      const full = path.join(current, entry);
      if (existsSync(full) && readdirSafe(full)) walk(full);
      else if (/\.png$/i.test(entry)) found.push(full);
    }
  };
  walk(dir);
  return found;
}

function readdirSafe(dir: string): boolean {
  try {
    readdirSync(dir);
    return true;
  } catch {
    return false;
  }
}

function safeReaddir(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function gradleModuleOf(relativePath: string): string | null {
  const at = relativePath.indexOf("/src/main/");
  return at > 0 ? relativePath.slice(0, at) : null;
}

/** `AUTO_PAY`, `AutoPay` and `auto-pay` all read as `autopay`. */
function squash(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "frame";
}

function gradleError(output: string): string {
  const compile = output.split("\n").find((line) => line.startsWith("e: "));
  if (compile) return compile.replace(/^e: file:\/\/\S*?([^/]+\.kt)/, "$1").slice(0, 300);
  const what = output.indexOf("* What went wrong:");
  if (what >= 0) return output.slice(what + 19, what + 319).split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 3).join(" ");
  return "The Gradle build failed; see the log.";
}

function gradle(cwd: string, tasks: string[]): Promise<{ code: number; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("./gradlew", [...tasks, "--console=plain"], {
      cwd,
      env: {
        ...process.env,
        ANDROID_HOME: process.env.ANDROID_HOME || `${process.env.HOME}/Library/Android/sdk`,
      },
    });
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`The render ran past ${Math.round(TIMEOUT_MS / 60000)} minutes and was stopped.`));
    }, TIMEOUT_MS);
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, output: Buffer.concat(chunks).toString("utf8") });
    });
  });
}
