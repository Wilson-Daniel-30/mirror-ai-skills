import { renderAndroidScreens, type RenderResult } from "./screenshot-render.ts";
import { renderIosScreens } from "./screenshot-render-ios.ts";
import { listScreenshots, type Platform } from "./screenshots.ts";

export type JobState = "queued" | "running" | "done" | "failed" | "skipped";

export interface PlatformJob {
  state: JobState;
  frames: number;
  error?: string;
}

export interface ModuleJob {
  module: string;
  android: PlatformJob;
  ios: PlatformJob;
}

export interface RenderTarget {
  projectRoot: string;
  androidPath: string;
  iosPath: string;
  moduleKey: string;
  keywords: string[];
}

type Renderers = Record<Platform, (target: RenderTarget) => Promise<RenderResult>>;

const defaultRenderers: Renderers = {
  android: (target) => renderAndroidScreens({ ...target }),
  ios: (target) => renderIosScreens({ ...target }),
};

/**
 * Renders run one at a time: Gradle and xcodebuild each want the whole machine,
 * and two Gradle daemons editing the same checkout would trip over each other.
 * A module that already has frames on a platform is left alone unless forced.
 */
export class RenderQueue {
  private jobs = new Map<string, ModuleJob>();
  private tail: Promise<void> = Promise.resolve();
  private renderers: Renderers;

  constructor(renderers: Renderers = defaultRenderers) {
    this.renderers = renderers;
  }

  enqueue(target: RenderTarget, force = false): ModuleJob {
    const current = this.jobs.get(target.moduleKey);
    if (current && isActive(current)) return current;
    const existing = listScreenshots(target.projectRoot, target.moduleKey);
    const job: ModuleJob = {
      module: target.moduleKey,
      android: initial(existing, "android", force),
      ios: initial(existing, "ios", force),
    };
    this.jobs.set(target.moduleKey, job);
    for (const platform of ["android", "ios"] as Platform[]) {
      if (job[platform].state !== "queued") continue;
      this.tail = this.tail.then(() => this.run(job, platform, target));
    }
    return job;
  }

  status(moduleKey: string): ModuleJob | null {
    return this.jobs.get(moduleKey) ?? null;
  }

  /** Resolves once everything queued so far has finished. */
  idle(): Promise<void> {
    return this.tail;
  }

  private async run(job: ModuleJob, platform: Platform, target: RenderTarget): Promise<void> {
    job[platform] = { state: "running", frames: 0 };
    try {
      const result = await this.renderers[platform](target);
      job[platform] =
        result.frames.length > 0
          ? { state: "done", frames: result.frames.length }
          : { state: "failed", frames: 0, error: result.error ?? "No frames were produced." };
    } catch (error) {
      job[platform] = { state: "failed", frames: 0, error: error instanceof Error ? error.message : "The render failed." };
    }
    if (job[platform].error) console.error(`render ${job.module} ${platform}: ${job[platform].error}`);
  }
}

function initial(existing: { platform: Platform }[], platform: Platform, force: boolean): PlatformJob {
  const frames = existing.filter((shot) => shot.platform === platform).length;
  if (frames > 0 && !force) return { state: "skipped", frames };
  return { state: "queued", frames: 0 };
}

function isActive(job: ModuleJob): boolean {
  return [job.android.state, job.ios.state].some((state) => state === "queued" || state === "running");
}
