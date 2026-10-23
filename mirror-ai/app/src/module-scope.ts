import path from "node:path";
import { compareModule, compareSourceSystemGuards } from "./compare.ts";
import { extractSource } from "./extract.ts";
import { readSources } from "./scan.ts";
import type { ComparisonResult, MappedModule, ModuleDef, PlatformModule, SourceUnit } from "./types.ts";

const MAX_FILES_PER_SIDE = 24;

/** Compares the modules the user ticked, each one found by the words its enum constant spells. */
export function compareModuleScope(
  androidPath: string,
  iosPath: string,
  defs: ModuleDef[],
): ComparisonResult {
  const resolvedAndroid = path.resolve(androidPath);
  const resolvedIos = path.resolve(iosPath);
  const compared = defs.map((def) => mapModule(resolvedAndroid, resolvedIos, def));
  const findings = compared
    .flatMap((module) => [...compareModule(module), ...compareSourceSystemGuards(module)])
    .sort((left, right) => left.module.localeCompare(right.module) || left.title.localeCompare(right.title));
  return {
    androidPath: resolvedAndroid,
    iosPath: resolvedIos,
    scopeLabel: `selected modules: ${defs.map((def) => def.label).join(", ")}`,
    compared,
    discoveredNames: defs.map((def) => def.label),
    omittedNames: [],
    missingRequests: [],
    findings,
  };
}

function mapModule(androidPath: string, iosPath: string, def: ModuleDef): MappedModule {
  const needles = def.keywords.map((keyword) => keyword.toLowerCase());
  const androidFiles = filesFor(androidPath, needles);
  const iosFiles = filesFor(iosPath, needles);
  const android = platformFromUnits(unitsForFiles(androidPath, androidFiles), def.label, `module ${def.id}`);
  const ios = platformFromUnits(unitsForFiles(iosPath, iosFiles), def.label, `module ${def.id}`);
  return {
    name: def.label,
    android,
    ios,
    mappingBasis: [
      `Enum module ${def.id} (${def.keywords.join(", ")})`,
      android ? `${android.files.length} Android file(s)` : "no Android hits",
      ios ? `${ios.files.length} iOS file(s)` : "no iOS hits",
    ],
  };
}

function filesFor(root: string, needles: string[]): string[] {
  const hits: string[] = [];
  for (const source of readSources(root)) {
    if (needles.some((needle) => source.lower.includes(needle))) hits.push(source.relativePath);
  }
  return hits.sort().slice(0, MAX_FILES_PER_SIDE);
}

function unitsForFiles(root: string, files: string[]): SourceUnit[] {
  const wanted = new Set(files);
  return readSources(root)
    .filter((source) => wanted.has(source.relativePath))
    .map((source) => extractSource(source.relativePath, source.text));
}

function platformFromUnits(units: SourceUnit[], label: string, basis: string): PlatformModule | null {
  if (units.length === 0) return null;
  const signals = units.flatMap((unit) => unit.signals);
  const production = signals.filter((signal) => signal.kind !== "test");
  return {
    label,
    labelBasis: basis,
    files: [...new Set(units.map((unit) => unit.path))].sort(),
    testFiles: units.filter((unit) => unit.role === "test").map((unit) => unit.path),
    navigationFiles: [],
    signals,
    screenTitles: unique(production.filter((signal) => signal.kind === "screen-title").map((signal) => signal.display)),
    endpoints: unique(production.filter((signal) => signal.kind === "endpoint").map((signal) => signal.display)).sort(),
    modelFields: unique(production.filter((signal) => signal.kind === "model-field").map((signal) => signal.display)).sort(),
    routes: unique(production.filter((signal) => signal.kind === "route").map((signal) => signal.display)).sort(),
    callEdges: [],
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
