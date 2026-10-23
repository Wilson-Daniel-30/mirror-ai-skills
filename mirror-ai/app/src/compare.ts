import type { Finding, Location, MappedModule, PlatformModule, Signal } from "./types.ts";
import { isTestPath, paramNamesRelated } from "./text.ts";

export function compareModule(module: MappedModule): Finding[] {
  if (!module.android || !module.ios) return [missingModuleFinding(module)];
  return [
    ...compareRules(module),
    ...compareApi(module),
    ...compareCopy(module),
    ...compareWidgets(module),
    ...compareTests(module),
  ];
}

/** Cerillion / Liberate / sourceSystem guards often differ on button handlers. */
export function compareSourceSystemGuards(module: MappedModule): Finding[] {
  const android = module.android;
  const ios = module.ios;
  if (!android || !ios) return [];
  const androidGuards = sourceSystemGuards(android.signals);
  const iosGuards = sourceSystemGuards(ios.signals);
  const onlyAndroid = [...androidGuards.keys()].filter((key) => !iosGuards.has(key));
  const onlyIos = [...iosGuards.keys()].filter((key) => !androidGuards.has(key));
  if (onlyAndroid.length === 0 && onlyIos.length === 0) return [];
  const findings: Finding[] = [];
  if (onlyAndroid.length > 0) {
    const signal = androidGuards.get(onlyAndroid[0])!;
    findings.push({
      severity: "high",
      status: "confirmed mismatch",
      category: "Business logic and user flows",
      module: module.name,
      title: `${module.name} checks ${onlyAndroid.join(", ")} only on Android`,
      android: location(signal),
      ios: citeImplementation(ios),
      difference: `Android applies ${onlyAndroid.join(" and ")} account/source checks. iOS does not use the same guard in this module slice.`,
      evidence: onlyAndroid.map((key) => pointed(androidGuards.get(key)!)).join(" "),
      suggestedFix: `Align billing/source-system guards (e.g. Cerillion vs Liberate) in the tap handler on both platforms.`,
    });
  }
  if (onlyIos.length > 0) {
    const signal = iosGuards.get(onlyIos[0])!;
    findings.push({
      severity: "high",
      status: "confirmed mismatch",
      category: "Business logic and user flows",
      module: module.name,
      title: `${module.name} checks ${onlyIos.join(", ")} only on iOS`,
      android: citeImplementation(android),
      ios: location(signal),
      difference: `iOS applies ${onlyIos.join(" and ")} account/source checks. Android does not use the same guard in this module slice.`,
      evidence: onlyIos.map((key) => pointed(iosGuards.get(key)!)).join(" "),
      suggestedFix: `Mirror the iOS source-system branch on Android, or document the platform-specific rule.`,
    });
  }
  return findings;
}

function sourceSystemGuards(signals: Signal[]): Map<string, Signal> {
  const map = new Map<string, Signal>();
  for (const signal of signals) {
    if (signal.kind !== "business-rule" || signal.meta.effect !== "source-system") continue;
    const system = signal.meta.system ?? signal.key;
    if (!map.has(system)) map.set(system, signal);
  }
  return map;
}

function missingModuleFinding(module: MappedModule): Finding {
  const present = module.android ?? module.ios;
  const location = firstLocation(present);
  const android = module.android ? location : { file: "(no counterpart)", line: 0 };
  const ios = module.ios ? location : { file: "(no counterpart)", line: 0 };
  const missing = module.android ? "iOS" : "Android";
  const presentName = module.android ? "Android" : "iOS";
  return {
    severity: "high",
    status: "confirmed mismatch",
    category: "Business logic and user flows",
    module: module.name,
    title: `${module.name} is implemented only on ${presentName}`,
    android,
    ios,
    difference: `${presentName} has ${module.name}. ${missing} has no mapped module.`,
    evidence: module.mappingBasis.join(" "),
    suggestedFix: `Add the missing ${missing} implementation for ${module.name}, or mark the feature platform-specific if that is intentional.`,
  };
}

function compareRules(module: MappedModule): Finding[] {
  const android = module.android;
  const ios = module.ios;
  if (!android || !ios) return [];
  const fields = new Set([...android.modelFields, ...ios.modelFields]);
  const androidRules = relevantRules(android.signals, fields);
  const iosRules = relevantRules(ios.signals, fields);
  const onlyAndroid = [...androidRules.values()].filter((rule) => !iosRules.has(rule.key));
  const onlyIos = [...iosRules.values()].filter((rule) => !androidRules.has(rule.key));
  if (onlyAndroid.length === 0 && onlyIos.length === 0) return [];
  onlyAndroid.sort((a, b) => a.line - b.line);
  onlyIos.sort((a, b) => a.line - b.line);
  const androidLocation = onlyAndroid[0] ? location(onlyAndroid[0]) : citeImplementation(android);
  const iosLocation = onlyIos[0] ? location(onlyIos[0]) : citeImplementation(ios);
  const androidText = onlyAndroid.length
    ? `Android applies ${onlyAndroid.map((rule) => rule.display).join(" and ")}`
    : "Android adds no extra filter or cap";
  const iosText = onlyIos.length
    ? `iOS applies ${onlyIos.map((rule) => rule.display).join(" and ")}`
    : "iOS returns the fetched items with no matching filter or cap";
  const missingSide = onlyAndroid.length === 0 ? android : onlyIos.length === 0 ? ios : null;
  const evidence = [
    ...onlyAndroid.map(pointed),
    ...onlyIos.map(pointed),
    ...constantEvidence(android.signals, onlyAndroid),
    ...constantEvidence(ios.signals, onlyIos),
    ...(missingSide ? passthroughEvidence(missingSide) : []),
  ].join(" ");
  const rules = [...onlyAndroid, ...onlyIos].map((rule) => rule.display).join(" and ");
  return [
    {
      severity: "high",
      status: "confirmed mismatch",
      category: "Business logic and user flows",
      module: module.name,
      title: `${module.name} shapes results differently`,
      android: androidLocation,
      ios: iosLocation,
      difference: `${androidText}. ${iosText}.`,
      evidence,
      suggestedFix: `Use the same result shaping on both platforms (${rules}). Put that rule in the loader that currently returns the fetched list unchanged, and test it on the platform that lacks coverage.`,
    },
  ];
}

function compareApi(module: MappedModule): Finding[] {
  const android = module.android;
  const ios = module.ios;
  if (!android || !ios) return [];
  const findings: Finding[] = [];
  const androidEndpoints = endpointMap(android.signals);
  const iosEndpoints = endpointMap(ios.signals);
  for (const [path, signal] of androidEndpoints) {
    if (iosEndpoints.has(path)) {
      const other = iosEndpoints.get(path);
      if (other && signal.meta.method !== other.meta.method) {
        findings.push({
          severity: "high",
          status: "confirmed mismatch",
          category: "API and data parity",
          module: module.name,
          title: `${module.name} uses different HTTP methods for ${path}`,
          android: location(signal),
          ios: location(other),
          difference: `Android calls ${signal.display}. iOS calls ${other.display}.`,
          evidence: `${pointed(signal)} ${pointed(other)}`,
          suggestedFix: `Call ${path} with the same HTTP method from both clients.`,
        });
      }
      continue;
    }
    const iosAt = citeImplementation(ios);
    findings.push({
      severity: "high",
      status: "confirmed mismatch",
      category: "API and data parity",
      module: module.name,
      title: `${module.name} calls ${path} only on Android`,
      android: location(signal),
      ios: iosAt,
      difference: `Android calls ${signal.display}. iOS has no matching endpoint in this module.`,
      evidence: pointed(signal),
      suggestedFix: `Add ${signal.display} to the iOS client, or remove it from Android if the feature should not use that API.`,
    });
  }
  for (const [path, signal] of iosEndpoints) {
    if (androidEndpoints.has(path)) continue;
    findings.push({
      severity: "high",
      status: "confirmed mismatch",
      category: "API and data parity",
      module: module.name,
      title: `${module.name} calls ${path} only on iOS`,
      android: citeImplementation(android),
      ios: location(signal),
      difference: `iOS calls ${signal.display}. Android has no matching endpoint in this module.`,
      evidence: pointed(signal),
      suggestedFix: `Add ${signal.display} to the Android client, or remove it from iOS if the feature should not use that API.`,
    });
  }

  if (androidEndpoints.size === 0 || iosEndpoints.size === 0) return findings;
  const sharedPath = [...androidEndpoints.keys()].find((path) => iosEndpoints.has(path)) ?? "";
  const androidParams = paramMap(android.signals);
  const iosParams = paramMap(ios.signals);
  const pairedIos = new Set<string>();
  const androidOnly = [...androidParams.keys()].filter((name) => !iosParams.has(name)).sort();
  const iosOnly = [...iosParams.keys()].filter((name) => !androidParams.has(name)).sort();
  for (const name of androidOnly) {
    const match = iosOnly.find((candidate) => !pairedIos.has(candidate) && paramNamesRelated(name, candidate));
    if (!match) continue;
    pairedIos.add(match);
    const left = androidParams.get(name)!;
    const right = iosParams.get(match)!;
    findings.push({
      severity: "high",
      status: "confirmed mismatch",
      category: "API and data parity",
      module: module.name,
      title: `${module.name} query parameter name differs for ${left.name}`,
      android: left.line,
      ios: right.line,
      difference: `Android sends ${left.name} on ${sharedPath}. iOS sends ${right.name} for the same request.`,
      evidence: `${left.evidence} ${right.evidence}`,
      suggestedFix: `Use one query name on both clients. Android declares ${left.name}; rename the iOS item or the Android parameter so the contract matches.`,
    });
  }
  for (const name of androidOnly) {
    if ([...pairedIos].some((iosName) => paramNamesRelated(name, iosName))) continue;
    const left = androidParams.get(name)!;
    const rightSignal = iosEndpoints.get(sharedPath)!;
    const value = left.values.size ? `=${[...left.values].join(",")}` : "";
    findings.push({
      severity: "high",
      status: "confirmed mismatch",
      category: "API and data parity",
      module: module.name,
      title: `${module.name} sends ${left.name} only on Android`,
      android: left.line,
      ios: location(rightSignal),
      difference: `Android sends ${left.name}${value} on ${sharedPath}. The iOS request does not include ${left.name}.`,
      evidence: `${left.evidence} ${pointed(rightSignal)}`,
      suggestedFix: `Add ${left.name}${value} to the iOS query, or stop sending it from Android if the API should not receive it.`,
    });
  }
  for (const name of iosOnly) {
    if (pairedIos.has(name)) continue;
    const right = iosParams.get(name)!;
    const leftSignal = androidEndpoints.get(sharedPath)!;
    const value = right.values.size ? `=${[...right.values].join(",")}` : "";
    findings.push({
      severity: "high",
      status: "confirmed mismatch",
      category: "API and data parity",
      module: module.name,
      title: `${module.name} sends ${right.name} only on iOS`,
      android: location(leftSignal),
      ios: right.line,
      difference: `iOS sends ${right.name}${value} on ${sharedPath}. The Android request does not include ${right.name}.`,
      evidence: `${pointed(leftSignal)} ${right.evidence}`,
      suggestedFix: `Add ${right.name}${value} to the Android query, or stop sending it from iOS if the API should not receive it.`,
    });
  }
  for (const name of [...androidParams.keys()].filter((key) => iosParams.has(key)).sort()) {
    const left = androidParams.get(name)!;
    const right = iosParams.get(name)!;
    if (left.values.size === 0 || right.values.size === 0) {
      if (left.values.size !== right.values.size) {
        findings.push({
          severity: "low",
          status: "needs runtime verification",
          category: "API and data parity",
          module: module.name,
          title: `${module.name} ${left.name} value is not a literal on both sides`,
          android: left.line,
          ios: right.line,
          difference: `Both clients send ${left.name}, but only one side has a literal value in source (${literalText(left.values)} vs ${literalText(right.values)}).`,
          evidence: `${left.evidence} ${right.evidence}`,
          suggestedFix: `Confirm at runtime that both clients send the same ${left.name} value for the same user action.`,
        });
      }
      continue;
    }
    const overlap = [...left.values].some((value) => right.values.has(value));
    if (overlap) continue;
    findings.push({
      severity: "high",
      status: "confirmed mismatch",
      category: "API and data parity",
      module: module.name,
      title: `${module.name} ${left.name} query value differs`,
      android: left.line,
      ios: right.line,
      difference: `Android sends ${left.name}=${[...left.values].join(", ")}. iOS sends ${right.name}=${[...right.values].join(", ")}.`,
      evidence: `${left.evidence} ${right.evidence}`,
      suggestedFix: `Send the same ${left.name} value from both clients. Pick the value the API contract expects and update the other call site.`,
    });
  }
  return findings;
}

function compareCopy(module: MappedModule): Finding[] {
  const android = module.android;
  const ios = module.ios;
  if (!android || !ios) return [];
  const findings: Finding[] = [];
  for (const state of ["empty", "error", "loading"]) {
    const left = copies(android.signals, state);
    const right = copies(ios.signals, state);
    if (left.length === 0 || right.length === 0) continue;
    const leftText = unique(left.map((signal) => signal.meta.text.trim()));
    const rightText = unique(right.map((signal) => signal.meta.text.trim()));
    const overlap = leftText.some((text) => rightText.some((other) => other.toLowerCase() === text.toLowerCase()));
    if (overlap) continue;
    findings.push({
      severity: "medium",
      status: "confirmed mismatch",
      category: "UI and design parity",
      module: module.name,
      title: `${module.name} ${state}-state copy differs`,
      android: location(left[0]),
      ios: location(right[0]),
      difference: `Android ${state} copy is "${leftText[0]}". iOS ${state} copy is "${rightText[0]}".`,
      evidence: `${pointed(left[0])} ${pointed(right[0])}`,
      suggestedFix: `Use one ${state}-state string on both screens. "${leftText[0]}" and "${rightText[0]}" should be the same sentence.`,
    });
  }
  return findings;
}

function compareWidgets(module: MappedModule): Finding[] {
  const android = module.android;
  const ios = module.ios;
  if (!android || !ios) return [];
  const left = widgets(android.signals);
  const right = widgets(ios.signals);
  if (left.length === 0 || right.length === 0) return [];
  const leftFamilies = new Set(left.map((signal) => signal.meta.family));
  const rightFamilies = new Set(right.map((signal) => signal.meta.family));
  const overlap = [...leftFamilies].some((family) => rightFamilies.has(family));
  if (overlap) return [];
  return [
    {
      severity: "low",
      status: "needs runtime verification",
      category: "UI and design parity",
      module: module.name,
      title: `${module.name} loading treatment differs`,
      android: location(left[0]),
      ios: location(right[0]),
      difference: `Android loading UI uses ${left[0].meta.family} (${left[0].meta.token}). iOS loading UI uses ${right[0].meta.family} (${right[0].meta.token}). Both implement a loading state; source alone does not show whether the designs are supposed to match.`,
      evidence: `${pointed(left[0])} ${pointed(right[0])}`,
      suggestedFix: `Compare the loading state on both clients against the design. Align on a skeleton or a spinner if the feature is supposed to look the same.`,
    },
  ];
}

function compareTests(module: MappedModule): Finding[] {
  const android = module.android;
  const ios = module.ios;
  if (!android || !ios) return [];
  const left = scenarioMap(android.signals);
  const right = scenarioMap(ios.signals);
  const findings: Finding[] = [];
  const tags = unique([...left.keys(), ...right.keys()]).sort();
  for (const tag of tags) {
    const androidTest = left.get(tag);
    const iosTest = right.get(tag);
    if (androidTest && iosTest) continue;
    if (!androidTest && !iosTest) continue;
    const present = androidTest ?? iosTest;
    if (!present) continue;
    const missingSide = androidTest ? ios : android;
    const coveredSide = androidTest ? android : ios;
    const missingTest = missingSide.signals.find((signal) => signal.kind === "test");
    const missingLocation = missingTest ? location(missingTest) : citeImplementation(missingSide);
    const coveredName = coveredSide === android ? "Android" : "iOS";
    const missingName = coveredSide === android ? "iOS" : "Android";
    findings.push({
      severity: "medium",
      status: "confirmed mismatch",
      category: "Test coverage and quality",
      module: module.name,
      title: `${module.name} ${tag} test is missing on ${missingName}`,
      android: androidTest ? location(androidTest) : missingLocation,
      ios: iosTest ? location(iosTest) : missingLocation,
      difference: `${coveredName} covers the ${tag} scenario in ${present.display}. ${missingName} ${
        missingTest
          ? `has ${missingTest.display} and no ${tag} test in this module`
          : `has no ${tag} test in this module`
      }.`,
      evidence: `${pointed(present)} ${missingTest ? pointed(missingTest) : `No ${missingName} test in this module.`}`,
      suggestedFix: `Add an ${missingName} test for the ${tag} scenario, parallel to ${present.display}.`,
    });
  }
  return findings;
}

interface ParamUse {
  name: string;
  values: Set<string>;
  line: Location;
  evidence: string;
}

function paramMap(signals: Signal[]): Map<string, ParamUse> {
  const declared = new Map<string, ParamUse>();
  for (const signal of prod(signals)) {
    if (signal.kind !== "query-param" || signal.meta.declared !== "true") continue;
    const key = signal.meta.name.toLowerCase();
    if (declared.has(key)) continue;
    declared.set(key, {
      name: signal.meta.name,
      values: new Set<string>(),
      line: location(signal),
      evidence: pointed(signal),
    });
  }
  for (const signal of prod(signals)) {
    if (signal.kind !== "query-param" || !signal.meta.value) continue;
    const key = signal.meta.name.toLowerCase();
    const slot = declared.get(key);
    if (!slot) continue;
    slot.values.add(signal.meta.value);
    slot.line = location(signal);
    slot.evidence = pointed(signal);
  }
  return declared;
}

function endpointMap(signals: Signal[]): Map<string, Signal> {
  const map = new Map<string, Signal>();
  for (const signal of prod(signals)) {
    if (signal.kind !== "endpoint") continue;
    if (!map.has(signal.key)) map.set(signal.key, signal);
  }
  return map;
}

function relevantRules(signals: Signal[], fields: Set<string>): Map<string, Signal> {
  const rules = new Map<string, Signal>();
  for (const signal of prod(signals)) {
    if (signal.kind !== "business-rule" || signal.meta.effect === "passthrough") continue;
    if (signal.meta.effect === "filter" && fields.size > 0 && !fields.has(signal.meta.field)) continue;
    if (!rules.has(signal.key)) rules.set(signal.key, signal);
  }
  return rules;
}

function copies(signals: Signal[], state: string): Signal[] {
  return prod(signals).filter((signal) => signal.kind === "ui-copy" && signal.meta.state === state);
}

function widgets(signals: Signal[]): Signal[] {
  return prod(signals).filter((signal) => signal.kind === "ui-widget" && signal.meta.role === "loading");
}

function scenarioMap(signals: Signal[]): Map<string, Signal> {
  const map = new Map<string, Signal>();
  for (const signal of signals) {
    if (signal.kind !== "test") continue;
    for (const tag of signal.meta.scenarios.split(",").filter(Boolean)) {
      if (!map.has(tag)) map.set(tag, signal);
    }
  }
  return map;
}

function bestPassthrough(signals: Signal[]): Signal | null {
  const passes = prod(signals).filter(
    (signal) => signal.kind === "business-rule" && signal.meta.effect === "passthrough",
  );
  if (passes.length === 0) return null;
  return [...passes].sort((a, b) => passthroughRank(a) - passthroughRank(b) || a.line - b.line)[0];
}

function passthroughRank(signal: Signal): number {
  const preferred = /^(load|reload|apply)$/.test(signal.meta.fn) ? 0 : 1;
  const returns = signal.meta.returns === "return" ? 0 : 1;
  return preferred * 2 + returns;
}

function constantEvidence(signals: Signal[], rules: Signal[]): string[] {
  const notes: string[] = [];
  for (const rule of rules) {
    if (rule.meta.effect !== "limit" || !rule.meta.raw || rule.meta.raw === rule.meta.value) continue;
    const constant = prod(signals).find(
      (signal) => signal.kind === "constant" && signal.meta.name === rule.meta.raw,
    );
    if (constant) notes.push(pointed(constant));
  }
  return notes;
}

function passthroughEvidence(side: PlatformModule): string[] {
  const pass = bestPassthrough(side.signals);
  return pass ? [pointed(pass)] : [];
}

function citeImplementation(side: PlatformModule): Location {
  return locationOf(bestPassthrough(side.signals)) ?? locationOf(prod(side.signals).find((signal) => signal.kind === "screen-title")) ?? firstLocation(side);
}

function firstLocation(side: PlatformModule | null): Location {
  if (!side) return { file: "(no counterpart)", line: 0 };
  const signal = side.signals.find((item) => !isTestPath(item.file)) ?? side.signals[0];
  if (!signal) return { file: side.files[0] ?? "(no counterpart)", line: 1 };
  return location(signal);
}

function locationOf(signal: Signal | null | undefined): Location | null {
  return signal ? location(signal) : null;
}

function location(signal: Signal): Location {
  return { file: signal.file, line: signal.line };
}

function pointed(signal: Signal): string {
  return `\`${signal.file}:${signal.line}\` \`${signal.excerpt}\``;
}

function literalText(values: Set<string>): string {
  if (values.size === 0) return "a runtime value";
  return [...values].join(", ");
}

function prod(signals: Signal[]): Signal[] {
  return signals.filter((signal) => !isTestPath(signal.file));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
