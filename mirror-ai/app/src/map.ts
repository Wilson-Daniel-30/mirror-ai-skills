import { MODULE_HINTS } from "./hints.ts";
import type { MappedModule, PlatformModule } from "./types.ts";
import { normalize } from "./text.ts";

const MIN_SCORE = 8;

export function pairModules(android: PlatformModule[], ios: PlatformModule[]): MappedModule[] {
  const scored: { androidIndex: number; iosIndex: number; score: number; basis: string[] }[] = [];
  for (let androidIndex = 0; androidIndex < android.length; androidIndex++) {
    for (let iosIndex = 0; iosIndex < ios.length; iosIndex++) {
      const result = scorePair(android[androidIndex], ios[iosIndex]);
      if (result.score >= MIN_SCORE) {
        scored.push({ androidIndex, iosIndex, score: result.score, basis: result.basis });
      }
    }
  }
  scored.sort((a, b) => b.score - a.score || a.androidIndex - b.androidIndex || a.iosIndex - b.iosIndex);
  const usedAndroid = new Set<number>();
  const usedIos = new Set<number>();
  const paired: MappedModule[] = [];
  for (const match of scored) {
    if (usedAndroid.has(match.androidIndex) || usedIos.has(match.iosIndex)) continue;
    usedAndroid.add(match.androidIndex);
    usedIos.add(match.iosIndex);
    const left = android[match.androidIndex];
    const right = ios[match.iosIndex];
    paired.push({
      name: pairedName(left, right),
      android: left,
      ios: right,
      mappingBasis: match.basis,
    });
  }
  for (let index = 0; index < android.length; index++) {
    if (usedAndroid.has(index)) continue;
    paired.push({
      name: android[index].label,
      android: android[index],
      ios: null,
      mappingBasis: ["No iOS module shared a screen title, endpoint, or model fields with this Android module."],
    });
  }
  for (let index = 0; index < ios.length; index++) {
    if (usedIos.has(index)) continue;
    paired.push({
      name: ios[index].label,
      android: null,
      ios: ios[index],
      mappingBasis: ["No Android module shared a screen title, endpoint, or model fields with this iOS module."],
    });
  }
  return paired.sort((a, b) => a.name.localeCompare(b.name));
}

function scorePair(android: PlatformModule, ios: PlatformModule): { score: number; basis: string[] } {
  let score = 0;
  const basis: string[] = [];
  const sharedTitles = android.screenTitles.filter((title) =>
    ios.screenTitles.some((other) => normalize(other) === normalize(title)),
  );
  if (sharedTitles.length > 0) {
    score += 10;
    basis.push(`screen title "${sharedTitles[0]}" on both platforms`);
  }
  const androidPaths = new Set(android.endpoints.map(endpointPath));
  const sharedEndpoints = ios.endpoints.filter((endpoint) => androidPaths.has(endpointPath(endpoint)));
  if (sharedEndpoints.length > 0) {
    score += sharedEndpoints.length * 8;
    basis.push(`shared endpoint ${sharedEndpoints.join(", ")}`);
  }
  const sharedFields = android.modelFields.filter((field) => ios.modelFields.includes(field));
  const union = new Set([...android.modelFields, ...ios.modelFields]).size;
  const jaccard = union === 0 ? 0 : sharedFields.length / union;
  if (sharedFields.length >= 2 && jaccard >= 0.5) {
    score += Math.round(jaccard * 6);
    basis.push(`shared model fields ${sharedFields.join(", ")}`);
  }
  const sharedRoutes = android.routes.filter((route) => ios.routes.includes(route));
  if (sharedRoutes.length > 0) {
    score += sharedRoutes.length * 4;
    basis.push(`shared route ${sharedRoutes.join(", ")}`);
  }
  if (android.label === ios.label && android.label !== "Unnamed module") {
    score += 3;
    if (sharedTitles.length === 0) {
      basis.push(`both sides labeled ${android.label} from ${android.labelBasis}`);
    }
  }
  if (score > 0 && android.callEdges.length > 0 && ios.callEdges.length > 0) {
    score += 2;
    basis.push(
      `call relationships: Android ${android.callEdges.slice(0, 3).join(", ")}; iOS ${ios.callEdges.slice(0, 3).join(", ")}`,
    );
  }
  return { score, basis };
}

function endpointPath(display: string): string {
  return display.replace(/^(GET|POST|PUT|DELETE|PATCH)\s+/, "");
}

function pairedName(android: PlatformModule, ios: PlatformModule): string {
  if (android.label === ios.label) return android.label;
  const hintNames = new Set(MODULE_HINTS.map((hint) => hint.name));
  if (hintNames.has(android.label)) return android.label;
  if (hintNames.has(ios.label)) return ios.label;
  return `${android.label} / ${ios.label}`;
}
