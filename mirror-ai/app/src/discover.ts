import { MODULE_HINTS } from "./hints.ts";
import type { PlatformModule, Signal, SourceUnit } from "./types.ts";
import { isTestPath, normalize } from "./text.ts";

const SCREEN_SUFFIX = /(Screen|View|Page|Activity|Browser|Fragment)$/;

interface Cluster {
  files: string[];
  testFiles: string[];
  navigationFiles: string[];
  signals: Signal[];
}

export function discoverModules(units: SourceUnit[]): PlatformModule[] {
  const tests = units.filter((unit) => unit.role === "test");
  const nonTests = units.filter((unit) => unit.role !== "test");
  const definedAt = indexSymbols(nonTests);
  const hubs = new Set(
    nonTests.filter((unit) => isNavHub(unit, definedAt)).map((unit) => unit.path),
  );
  const production = nonTests.filter((unit) => !hubs.has(unit.path));
  const productionSymbols = indexSymbols(production);
  const parent = new Map<string, string>();
  const find = (file: string): string => {
    const current = parent.get(file) ?? file;
    if (current === file) return file;
    const root = find(current);
    parent.set(file, root);
    return root;
  };
  const union = (left: string, right: string) => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent.set(b, a);
  };
  for (const unit of production) parent.set(unit.path, unit.path);

  const byKey = new Map<string, string[]>();
  for (const unit of production) {
    for (const signal of unit.signals) {
      if (signal.kind !== "screen-title" && signal.kind !== "endpoint") continue;
      const key = `${signal.kind}:${signal.key}`;
      const bucket = byKey.get(key) ?? [];
      bucket.push(unit.path);
      byKey.set(key, bucket);
    }
  }
  for (const files of byKey.values()) {
    for (let i = 1; i < files.length; i++) union(files[0], files[i]);
  }
  for (const unit of production) {
    for (const signal of unit.signals) {
      if (signal.kind !== "reference") continue;
      const owner = productionSymbols.get(signal.key);
      if (!owner || owner === unit.path) continue;
      union(unit.path, owner);
    }
  }

  const groups = new Map<string, Cluster>();
  const clusterFor = (file: string): Cluster => {
    const root = find(file);
    const existing = groups.get(root);
    if (existing) return existing;
    const created: Cluster = { files: [], testFiles: [], navigationFiles: [], signals: [] };
    groups.set(root, created);
    return created;
  };
  for (const unit of production) {
    const cluster = clusterFor(unit.path);
    cluster.files.push(unit.path);
    cluster.signals.push(...unit.signals);
  }
  for (const unit of tests) {
    const targets = new Set<string>();
    for (const signal of unit.signals) {
      if (signal.kind !== "reference") continue;
      const owner = productionSymbols.get(signal.key);
      if (owner && parent.has(owner)) targets.add(find(owner));
    }
    for (const target of targets) {
      const cluster = groups.get(target);
      if (!cluster) continue;
      if (!cluster.testFiles.includes(unit.path)) cluster.testFiles.push(unit.path);
      cluster.signals.push(...unit.signals);
    }
  }
  for (const unit of nonTests) {
    if (!hubs.has(unit.path)) continue;
    const targets = new Set<string>();
    for (const signal of unit.signals) {
      if (signal.kind !== "reference" || !SCREEN_SUFFIX.test(signal.key)) continue;
      const owner = productionSymbols.get(signal.key);
      if (owner && parent.has(owner)) targets.add(find(owner));
    }
    for (const target of targets) {
      const cluster = groups.get(target);
      if (!cluster) continue;
      if (!cluster.navigationFiles.includes(unit.path)) cluster.navigationFiles.push(unit.path);
    }
  }

  return [...groups.values()]
    .map(toModule)
    .filter((module) => module.screenTitles.length > 0 || module.endpoints.length > 0)
    .sort((a, b) => a.label.localeCompare(b.label) || a.files[0].localeCompare(b.files[0]));
}

function indexSymbols(units: SourceUnit[]): Map<string, string> {
  const definedAt = new Map<string, string>();
  for (const unit of units) {
    for (const signal of unit.signals) {
      if (signal.kind !== "symbol") continue;
      if (!definedAt.has(signal.key)) definedAt.set(signal.key, unit.path);
    }
  }
  return definedAt;
}

function isNavHub(unit: SourceUnit, definedAt: Map<string, string>): boolean {
  const screens = new Set<string>();
  for (const signal of unit.signals) {
    if (signal.kind !== "reference" || !SCREEN_SUFFIX.test(signal.key)) continue;
    const owner = definedAt.get(signal.key);
    if (owner && owner !== unit.path) screens.add(signal.key);
  }
  return screens.size >= 2;
}

function toModule(cluster: Cluster): PlatformModule {
  const signals = cluster.signals;
  const production = signals.filter((signal) => !isTestPath(signal.file));
  const labeled = labelCluster(production);
  const definedHere = new Map<string, string>();
  for (const signal of production) {
    if (signal.kind === "symbol" && !definedHere.has(signal.key)) {
      definedHere.set(signal.key, signal.file);
    }
  }
  const callEdges = new Set<string>();
  for (const signal of production) {
    if (signal.kind !== "reference") continue;
    const ownerFile = definedHere.get(signal.key);
    if (!ownerFile || ownerFile === signal.file) continue;
    const from = signal.meta.owner || signal.file;
    callEdges.add(`${from} → ${signal.key}`);
  }
  return {
    label: labeled.name,
    labelBasis: labeled.basis,
    files: unique(cluster.files).sort(),
    testFiles: unique(cluster.testFiles).sort(),
    navigationFiles: unique(cluster.navigationFiles).sort(),
    signals,
    screenTitles: unique(production.filter((signal) => signal.kind === "screen-title").map((signal) => signal.display)),
    endpoints: unique(production.filter((signal) => signal.kind === "endpoint").map((signal) => signal.display)).sort(),
    modelFields: unique(production.filter((signal) => signal.kind === "model-field").map((signal) => signal.display)).sort(),
    routes: unique(production.filter((signal) => signal.kind === "route").map((signal) => signal.display)).sort(),
    callEdges: [...callEdges].sort(),
  };
}

function labelCluster(signals: Signal[]): { name: string; basis: string } {
  for (const title of signals) {
    if (title.kind !== "screen-title") continue;
    const norm = normalize(title.display);
    const hinted = MODULE_HINTS.find(
      (hint) => normalize(hint.name) === norm || hint.keywords.some((keyword) => normalize(keyword) === norm),
    );
    if (hinted) return { name: hinted.name, basis: `screen title "${title.display}"` };
    return { name: title.display, basis: `screen title "${title.display}"` };
  }
  const blob = normalize(
    signals
      .filter((signal) => signal.kind === "endpoint" || signal.kind === "model-field" || signal.kind === "route")
      .map((signal) => signal.display)
      .join(" "),
  );
  let best: { name: string; score: number } | null = null;
  for (const hint of MODULE_HINTS) {
    let score = 0;
    for (const keyword of hint.keywords) {
      if (blob.includes(normalize(keyword))) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { name: hint.name, score };
  }
  if (best) return { name: best.name, basis: "endpoint, route, and model fields matched a module hint" };
  const endpoint = signals.find((signal) => signal.kind === "endpoint");
  if (endpoint) return { name: endpoint.display, basis: "endpoint" };
  return { name: "Unnamed module", basis: "unlabeled cluster" };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
