import { existsSync } from "node:fs";
import path from "node:path";

/** Loads project-root `.env` when present (Node 20.12+). No-op in older runtimes. */
export function loadProjectEnv(projectRoot: string): void {
  const envPath = path.join(projectRoot, ".env");
  if (!existsSync(envPath)) return;
  const load = (process as NodeJS.Process & { loadEnvFile?: (path: string) => void }).loadEnvFile;
  if (typeof load === "function") load(envPath);
}
