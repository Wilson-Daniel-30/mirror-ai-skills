import path from "node:path";
import { compareModule } from "./compare.ts";
import { discoverModules } from "./discover.ts";
import { compareModuleScope } from "./module-scope.ts";
import { extractSource } from "./extract.ts";
import { pairModules } from "./map.ts";
import { readSources } from "./scan.ts";
import type { ComparisonResult, Finding, Scope } from "./types.ts";
import { normalize } from "./text.ts";

export interface CompareInput {
  androidPath: string;
  iosPath: string;
  scope: Scope;
}

const SEVERITY_RANK: Record<Finding["severity"], number> = { high: 0, medium: 1, low: 2 };

function loadPairing(androidPath: string, iosPath: string) {
  const resolvedAndroid = path.resolve(androidPath);
  const resolvedIos = path.resolve(iosPath);
  const androidModules = discoverModules(
    readSources(resolvedAndroid).map((source) => extractSource(source.relativePath, source.text)),
  );
  const iosModules = discoverModules(
    readSources(resolvedIos).map((source) => extractSource(source.relativePath, source.text)),
  );
  const mapped = pairModules(androidModules, iosModules);
  const discoveredNames = [...new Set(mapped.map((module) => module.name))].sort();
  return { androidPath: resolvedAndroid, iosPath: resolvedIos, mapped, discoveredNames };
}

export function listComparableModules(androidPath: string, iosPath: string): string[] {
  return loadPairing(androidPath, iosPath).discoveredNames;
}

export function compareRepos(input: CompareInput): ComparisonResult {
  if (input.scope.kind === "enum-modules") {
    return compareModuleScope(input.androidPath, input.iosPath, input.scope.defs);
  }
  const { androidPath, iosPath, mapped, discoveredNames } = loadPairing(input.androidPath, input.iosPath);
  let compared = mapped;
  let omittedNames: string[] = [];
  let missingRequests: string[] = [];
  let scopeLabel = "full comparison";
  if (input.scope.kind === "modules") {
    const requested = input.scope.names;
    scopeLabel = `modules: ${requested.join(", ")}`;
    compared = mapped.filter((module) =>
      requested.some((name) => normalize(name) === normalize(module.name)),
    );
    missingRequests = requested.filter(
      (name) => !discoveredNames.some((found) => normalize(found) === normalize(name)),
    );
    omittedNames = discoveredNames.filter(
      (name) => !requested.some((item) => normalize(item) === normalize(name)),
    );
  }
  const findings = compared
    .flatMap((module) => compareModule(module))
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        a.module.localeCompare(b.module) ||
        a.title.localeCompare(b.title),
    );
  return {
    androidPath,
    iosPath,
    scopeLabel,
    compared,
    discoveredNames,
    omittedNames,
    missingRequests,
    findings,
  };
}

export { renderReport } from "./report.ts";
export { buildModuleCatalog, moduleDefs } from "./enums.ts";
export type { ComparisonResult, Finding, ModuleDef, Scope } from "./types.ts";
