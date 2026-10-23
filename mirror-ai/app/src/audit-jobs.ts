import { randomUUID } from "node:crypto";
import { readApiDriftReference, readApiDriftReferenceData } from "./api-drift-reference.ts";
import {
  auditPasses,
  CONCURRENCY,
  moduleHeading,
  runPass,
  savedPass,
  type AuditPass,
  type AuditRequest,
  type PassResult,
} from "./audit.ts";
import type { ModuleDef } from "./types.ts";

export type PassState = "queued" | "running" | "done" | "failed";

export interface PassJob {
  id: string;
  title: string;
  state: PassState;
  /** Set once the pass has finished, failed or not. */
  markdown?: string;
  cached?: boolean;
  at?: string;
  startedAt?: number;
  finishedAt?: number;
}

export interface AuditJob {
  id: string;
  startedAt: number;
  done: boolean;
  modules: { key: string; label: string; heading: string; passes: PassJob[] }[];
  /** The full-market drift snapshot that closes the report. */
  reference: string;
  /** The same snapshot as data, so the page can draw it as the workflow's canvas. */
  referenceData: unknown;
}

type PassRunner = (request: AuditRequest, def: ModuleDef, pass: AuditPass) => Promise<PassResult>;
type SavedLookup = (request: AuditRequest, def: ModuleDef, pass: AuditPass) => PassResult | null;

/** A finished job is kept this long so a slow poll still finds it. */
const KEEP_MS = 6 * 60 * 60 * 1000;

/**
 * Starts every section of every ticked module in the background and answers
 * polls with whatever has finished, so the page shows each section as it lands.
 * The queue runs every module's business logic first: that is what a reader
 * starts with, and the skills' sections follow it on the page.
 */
export class AuditJobs {
  private jobs = new Map<string, AuditJob>();
  private run: PassRunner;
  private limit: number;
  private saved: SavedLookup;

  constructor(run: PassRunner = runPass, limit = CONCURRENCY, saved: SavedLookup = savedPass) {
    this.run = run;
    this.limit = limit;
    this.saved = saved;
  }

  start(request: AuditRequest): AuditJob {
    this.prune();
    const passes = auditPasses(request.projectRoot);
    const job: AuditJob = {
      id: randomUUID(),
      startedAt: Date.now(),
      done: false,
      modules: request.defs.map((def) => ({
        key: def.id,
        label: def.label,
        heading: moduleHeading(def, request.mode),
        passes: passes.map((pass) => ({ id: pass.id, title: pass.title, state: "queued" as PassState })),
      })),
      reference: readApiDriftReference(request.projectRoot),
      referenceData: readApiDriftReferenceData(request.projectRoot),
    };
    this.jobs.set(job.id, job);
    // Saved sections are filled in before this returns, so a repeat of a
    // finished audit shows in full on the page's first response.
    const queue = passes
      .flatMap((pass, passIndex) =>
        request.defs.map((def, moduleIndex) => ({ def, pass, slot: job.modules[moduleIndex].passes[passIndex] })),
      )
      .filter(({ def, pass, slot }) => {
        const saved = this.saved(request, def, pass);
        if (!saved) return true;
        Object.assign(slot, { state: "done", markdown: saved.markdown, cached: true, at: saved.at, finishedAt: Date.now() });
        return false;
      });
    if (queue.length === 0) job.done = true;
    void this.drain(request, queue).then(() => {
      job.done = true;
    });
    return job;
  }

  status(id: string): AuditJob | null {
    return this.jobs.get(id) ?? null;
  }

  private async drain(
    request: AuditRequest,
    queue: { def: ModuleDef; pass: AuditPass; slot: PassJob }[],
  ): Promise<void> {
    let next = 0;
    const worker = async () => {
      while (next < queue.length) {
        const { def, pass, slot } = queue[next++];
        slot.state = "running";
        slot.startedAt = Date.now();
        try {
          const result = await this.run(request, def, pass);
          Object.assign(slot, {
            state: result.failed ? "failed" : "done",
            markdown: result.markdown,
            cached: result.cached,
            at: result.at,
          });
        } catch (error) {
          slot.state = "failed";
          slot.markdown = `${pass.firstHeading}\n\n**This section could not be produced.** ${error instanceof Error ? error.message : "The run failed."}`;
        }
        slot.finishedAt = Date.now();
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.limit, queue.length) }, worker));
  }

  private prune(): void {
    const cutoff = Date.now() - KEEP_MS;
    for (const [id, job] of this.jobs) {
      if (job.done && job.startedAt < cutoff) this.jobs.delete(id);
    }
  }
}
