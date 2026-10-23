import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { REPORTS_DIR } from "./report-store.ts";

/** Rendered frames live beside the reports they illustrate. */
export const SCREENSHOTS_DIR = path.join(REPORTS_DIR, "screenshots");

export type Platform = "android" | "ios";

export interface Shot {
  platform: Platform;
  /** File name without the extension, used as the caption. */
  name: string;
  file: string;
  bytes: number;
}

const IMAGE = /\.(png|jpe?g|webp)$/i;

export function screenshotDir(projectRoot: string, moduleKey: string, platform: Platform): string {
  return path.join(projectRoot, SCREENSHOTS_DIR, safe(moduleKey), platform);
}

/** Every frame on disk for a module, Android first, each side sorted by name. */
export function listScreenshots(projectRoot: string, moduleKey: string): Shot[] {
  const shots: Shot[] = [];
  for (const platform of ["android", "ios"] as Platform[]) {
    const dir = screenshotDir(projectRoot, moduleKey, platform);
    let entries: string[];
    try {
      entries = readdirSync(dir).filter((file) => IMAGE.test(file)).sort();
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      let bytes = 0;
      try {
        bytes = readFileSync(full).length;
      } catch {
        continue;
      }
      shots.push({
        platform,
        name: entry.replace(IMAGE, "").replace(/[_-]+/g, " "),
        file: entry,
        bytes,
      });
    }
  }
  return shots;
}

export interface ShotBytes {
  body: Buffer;
  contentType: string;
}

/** Reads one frame, refusing any name that tries to leave its own folder. */
export function readScreenshot(
  projectRoot: string,
  moduleKey: string,
  platform: Platform,
  file: string,
): ShotBytes | null {
  if (!IMAGE.test(file) || file.includes("/") || file.includes("\\") || file.includes("..")) return null;
  const dir = screenshotDir(projectRoot, moduleKey, platform);
  const full = path.join(dir, file);
  if (!full.startsWith(dir + path.sep) || !existsSync(full)) return null;
  return { body: readFileSync(full), contentType: contentTypeOf(file) };
}

function contentTypeOf(file: string): string {
  if (/\.png$/i.test(file)) return "image/png";
  if (/\.webp$/i.test(file)) return "image/webp";
  return "image/jpeg";
}

function safe(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "module";
}
