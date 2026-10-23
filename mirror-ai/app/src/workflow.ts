import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Scope, WorkflowNote } from "./types.ts";

const KNOWN_OWNERS = new Set(["vercel-labs", "anthropics", "microsoft"]);
const STOP_WORDS = new Set(["for", "you", "the", "and", "with", "from", "that", "this", "into", "your"]);
const USER_SKILLS = "/cursor/stores/user/skills";

export interface ComparisonRequest {
  task: string;
  keywords: string;
  phrases: string[];
  storeKey: string;
}

export interface LocalSkill {
  name: string;
  description: string;
  dir: string;
}

export interface RemoteSkill {
  ownerRepo: string;
  name: string;
  installs: number;
  owner: string;
}

interface CommandResult {
  status: number;
  stdout: string;
  stderr: string;
}

export function comparisonRequest(scope: Scope): ComparisonRequest {
  if (scope.kind === "enum-modules" && scope.defs.length > 0) {
    const labels = scope.defs.map((def) => def.label);
    const keywords = labels.join(" ");
    return {
      task: `Compare Android and iOS modules: ${labels.join(", ")}`,
      keywords,
      phrases: labels,
      storeKey: `compare-modules-${slug(keywords)}`,
    };
  }
  if (scope.kind === "modules" && scope.names.length > 0) {
    const keywords = scope.names.join(" ");
    return {
      task: `Compare Android and iOS modules: ${scope.names.join(", ")}`,
      keywords,
      phrases: scope.names,
      storeKey: `compare-${slug(keywords)}`,
    };
  }
  return {
    task: "Compare Android and iOS",
    keywords: "Android/iOS comparison",
    phrases: ["Android/iOS comparison"],
    storeKey: "compare-android-ios",
  };
}

export function prepareWorkflow(request: ComparisonRequest, projectRoot: string): WorkflowNote {
  const local = bestLocalSkill(readLocalSkills(), request.keywords, request.phrases);
  let skill = "none";
  if (local) {
    skill = `\`${local.name}\` (\`${local.dir}\`)`;
  } else {
    const found = runCommand("npx", ["--yes", "skills", "find", request.keywords], "/tmp", {
      DISABLE_TELEMETRY: "1",
    });
    const chosen = chooseRemoteSkill(parseSkillsFind(found.stdout));
    if (chosen) {
      const added = installRemoteSkill(chosen);
      skill = added ?? "none";
    }
  }
  runCommand("npx", ["--yes", "ruflo", "memory", "search", "-q", request.task], projectRoot);
  const routed = runCommand("npx", ["--yes", "ruflo", "route", request.task], projectRoot);
  return { skill, route: parseRoute(routed) };
}

export function storeWorkflow(request: ComparisonRequest, summary: string, projectRoot: string): void {
  const stored = runCommand(
    "npx",
    ["--yes", "ruflo", "memory", "store", "-k", request.storeKey, "-v", summary],
    projectRoot,
  );
  if (stored.status !== 0) {
    const detail = commandDetail(stored.stderr, stored.stdout);
    console.error(`ruflo memory store: ${detail}`);
  }
}

export function bestLocalSkill(skills: LocalSkill[], keywords: string, phrases: string[]): LocalSkill | null {
  let best: { skill: LocalSkill; score: number } | null = null;
  for (const skill of skills) {
    const score = scoreLocalSkill(skill, keywords, phrases);
    if (score < 3) continue;
    if (!best || score > best.score) best = { skill, score };
  }
  return best?.skill ?? null;
}

export function parseSkillsFind(output: string): RemoteSkill[] {
  const skills: RemoteSkill[] = [];
  const pattern =
    /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)@([A-Za-z0-9_.-]+)\s+([0-9]+(?:\.[0-9]+)?)([KkMm])?\s+installs\b/;
  for (const rawLine of stripAnsi(output).split("\n")) {
    const match = rawLine.trim().match(pattern);
    if (!match) continue;
    const owner = match[1];
    skills.push({
      owner,
      ownerRepo: `${owner}/${match[2]}`,
      name: match[3],
      installs: scaleInstalls(Number(match[4]), match[5]),
    });
  }
  return skills;
}

export function chooseRemoteSkill(skills: RemoteSkill[]): RemoteSkill | null {
  const qualified = skills.filter((skill) => {
    if (skill.installs < 100) return false;
    if (skill.installs >= 1000) return true;
    return KNOWN_OWNERS.has(skill.owner);
  });
  qualified.sort((left, right) => skillRank(right) - skillRank(left) || right.installs - left.installs);
  return qualified[0] ?? null;
}

export function parseRoute(result: CommandResult | string): string {
  const text = stripAnsi(typeof result === "string" ? result : `${result.stdout}\n${result.stderr}`);
  const routed = text.match(/Routed to\s+([A-Za-z0-9_ -]+)/);
  if (routed) return routed[1].trim();
  const agent = text.match(/Agent:\s+([^(\n]+)/);
  if (agent) return agent[1].trim();
  if (typeof result !== "string" && result.status !== 0) {
    return `unavailable (${firstLine(result.stderr) || firstLine(result.stdout) || "route failed"})`;
  }
  return "unknown";
}

export function readLocalSkills(): LocalSkill[] {
  const dirs = [USER_SKILLS, path.join(os.homedir(), ".agents/skills")];
  const byName = new Map<string, LocalSkill>();
  for (const root of dirs) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(root, entry.name);
      const skillFile = path.join(dir, "SKILL.md");
      if (!existsSync(skillFile)) continue;
      const parsed = parseSkillFile(readFileSync(skillFile, "utf8"));
      const name = parsed.name || entry.name;
      if (!byName.has(name)) {
        byName.set(name, { name, description: parsed.description, dir });
      }
    }
  }
  return [...byName.values()];
}

function skillRank(skill: RemoteSkill): number {
  const known = KNOWN_OWNERS.has(skill.owner);
  if (known && skill.installs >= 1000) return 3;
  if (skill.installs >= 1000) return 2;
  if (known) return 1;
  return 0;
}

function installRemoteSkill(skill: RemoteSkill): string | null {
  const added = runCommand(
    "npx",
    ["--yes", "skills", "add", skill.ownerRepo, "--skill", skill.name, "-g", "-a", "cursor", "-y", "--copy"],
    "/tmp",
    { DISABLE_TELEMETRY: "1" },
  );
  if (added.status !== 0) return null;
  const source = path.join(os.homedir(), ".agents/skills", skill.name);
  const dest = path.join(USER_SKILLS, skill.name);
  if (!existsSync(source)) return null;
  mkdirSync(dest, { recursive: true });
  cpSync(source, dest, { recursive: true });
  const skillFile = path.join(dest, "SKILL.md");
  if (!existsSync(skillFile)) return null;
  return `\`${skill.name}\` (\`${dest}\`)`;
}

function scoreLocalSkill(skill: LocalSkill, keywords: string, phrases: string[]): number {
  const haystack = `${skill.name} ${skill.description}`;
  const compactHaystack = compact(haystack);
  let score = 0;
  for (const phrase of phrases) {
    if (compact(phrase).length >= 4 && compactHaystack.includes(compact(phrase))) score += 5;
  }
  for (const token of tokens(keywords)) {
    if (new RegExp(`\\b${escapeRegExp(token)}\\b`, "i").test(haystack)) {
      score += token.length >= 6 ? 2 : 1;
    }
    if (compact(skill.name) === compact(token)) score += 5;
  }
  return score;
}

function parseSkillFile(text: string): { name: string; description: string } {
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const body = frontmatter?.[1] ?? "";
  const name = body.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? "";
  const lines = body.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const match = lines[index]?.match(/^description:\s*(.*)$/);
    if (!match) continue;
    const first = match[1].trim();
    if (first === ">-" || first === ">" || first === "|" || first === "|-") {
      const parts: string[] = [];
      for (let next = index + 1; next < lines.length; next++) {
        const line = lines[next] ?? "";
        if (!/^\s+/.test(line)) break;
        parts.push(line.trim());
      }
      return { name, description: parts.join(" ") };
    }
    return { name, description: first.replace(/^["']|["']$/g, "") };
  }
  return { name, description: "" };
}

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  extraEnv: Record<string, string> = {},
): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: 180000,
    env: { ...process.env, ...extraEnv },
  });
  if (result.error) {
    return { status: 1, stdout: result.stdout ?? "", stderr: result.error.message };
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function tokens(keywords: string): string[] {
  return keywords
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function compact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function scaleInstalls(value: number, suffix: string | undefined): number {
  const unit = suffix?.toUpperCase();
  if (unit === "K") return Math.round(value * 1_000);
  if (unit === "M") return Math.round(value * 1_000_000);
  return value;
}

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

function firstLine(value: string): string {
  return value.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
}

function commandDetail(stderr: string, stdout: string): string {
  const lines = `${stderr}\n${stdout}`.split(/\r?\n/).map((line) => line.trim());
  const error = lines.find((line) => /\[ERROR\]/.test(line) || /^error:/i.test(line));
  if (error) return error.replace(/^\[ERROR\]\s*/, "");
  return firstLine(stderr) || firstLine(stdout) || "memory store failed";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
