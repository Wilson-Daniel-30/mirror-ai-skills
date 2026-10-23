import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runWorkflowCompare } from "./run-compare.ts";
import { loadProjectEnv } from "./load-env.ts";
import type { Scope } from "./types.ts";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
loadProjectEnv(projectRoot);

export function main(argv: string[]): number {
  const android = flag(argv, "--android");
  const ios = flag(argv, "--ios");
  const out = flag(argv, "--out");
  const modules = flags(argv, "--module");
  const full = argv.includes("--full");
  if (!android || !ios) {
    console.log(usage());
    return 1;
  }
  const scope: Scope = !full && modules.length > 0 ? { kind: "modules", names: modules } : { kind: "full" };
  const { markdown, result } = runWorkflowCompare({
    androidPath: android,
    iosPath: ios,
    scope,
    projectRoot,
  });
  if (out) {
    mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    writeFileSync(out, markdown);
  } else {
    console.log(markdown);
  }
  if (argv.includes("--debug")) {
    for (const module of result.compared) {
      console.error(`# ${module.name}`);
      console.error(`android ${module.android?.files.join(", ") || "(none)"}`);
      console.error(`ios ${module.ios?.files.join(", ") || "(none)"}`);
      console.error(module.mappingBasis.join(" | "));
    }
  }
  const confirmed = result.findings.filter((finding) => finding.status === "confirmed mismatch").length;
  const verify = result.findings.filter((finding) => finding.status === "needs runtime verification").length;
  console.error(
    `${result.compared.length} modules, ${result.findings.length} findings (${confirmed} confirmed mismatch, ${verify} needs runtime verification)`,
  );
  if (out) console.error(`report ${path.resolve(out)}`);
  return 0;
}

function flag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  return argv[index + 1];
}

function flags(argv: string[], name: string): string[] {
  const values: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === name && argv[i + 1]) values.push(argv[i + 1]);
  }
  return values;
}

function usage(): string {
  return [
    "Usage: node --experimental-strip-types src/cli.ts --android <path> --ios <path> [--full | --module <name>] [--out report.md]",
    "",
    "  --full            Compare every discovered module (default)",
    "  --module <name>   Compare one discovered module. Repeat for more than one.",
    "  --out <file>      Write the markdown report",
    "  --debug           Print module files and mapping basis to stderr",
  ].join("\n");
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === entry) {
  process.exit(main(process.argv.slice(2)));
}
