import { compareRepos, renderReport } from "./index.ts";
import type { ComparisonResult, Scope } from "./types.ts";
import { comparisonRequest, prepareWorkflow, storeWorkflow } from "./workflow.ts";

export function runWorkflowCompare(input: {
  androidPath: string;
  iosPath: string;
  scope: Scope;
  projectRoot: string;
}): { markdown: string; result: ComparisonResult } {
  const request = comparisonRequest(input.scope);
  const workflow = prepareWorkflow(request, input.projectRoot);
  const result = compareRepos({
    androidPath: input.androidPath,
    iosPath: input.iosPath,
    scope: input.scope,
  });
  result.workflow = { skill: workflow.skill, route: workflow.route };
  const markdown = renderReport(result);
  const summary = `${result.findings.length} findings. Skill: ${workflow.skill}. Ruflo route: ${workflow.route}.`;
  storeWorkflow(request, summary, input.projectRoot);
  return { markdown, result };
}
