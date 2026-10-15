import { classRank } from "./constants";

export type PreflightOutcome = "AUTO APPROVABLE" | "ADMIN APPROVAL REQUIRED" | "SECURITY REVIEW REQUIRED" | "DENIED";
export interface PreflightCheck {
  name: string;
  result: "PASS" | "REVIEW" | "FAIL";
  detail: string;
}
export interface PreflightInput {
  userRoles: string[];
  matrixState: string; // ALLOWED | APPROVAL REQUIRED | DENIED
  projectStatus: string;
  environment: string;
  aliasEnvironments: string[];
  dataClass: string;
  aliasMaxClass: string;
  expectedSpend: number;
  teamBudget: number;
  teamSpent: number;
}

export function evaluatePreflight(i: PreflightInput): { outcome: PreflightOutcome; checks: PreflightCheck[] } {
  const checks: PreflightCheck[] = [];
  const eligible = i.userRoles.some((r) => ["developer", "team_admin", "app_owner", "org_admin", "platform_admin"].includes(r));
  checks.push({ name: "User Eligibility", result: eligible ? "PASS" : "FAIL", detail: eligible ? "Requester holds a builder role" : "Requester role cannot hold entitlements" });
  checks.push({
    name: "Team Policy",
    result: i.matrixState === "ALLOWED" ? "PASS" : i.matrixState === "DENIED" ? "FAIL" : "REVIEW",
    detail: `Entitlement matrix: ${i.matrixState}`,
  });
  checks.push({ name: "Project Status", result: i.projectStatus === "active" ? "PASS" : "FAIL", detail: `Project is ${i.projectStatus}` });
  const envOk = i.aliasEnvironments.includes(i.environment);
  const prod = i.environment === "Production";
  checks.push({ name: "Environment Policy", result: !envOk ? "FAIL" : prod ? "REVIEW" : "PASS", detail: !envOk ? `${i.environment} not approved for alias` : prod ? "Production access requires admin approval" : `${i.environment} permitted` });
  const classOk = classRank(i.dataClass) <= classRank(i.aliasMaxClass);
  const restricted = i.dataClass.toUpperCase() === "RESTRICTED";
  checks.push({ name: "Data Classification", result: restricted ? "REVIEW" : classOk ? "PASS" : "FAIL", detail: restricted ? "Restricted data requires security review" : classOk ? `${i.dataClass} ≤ alias max ${i.aliasMaxClass}` : `${i.dataClass} exceeds alias max ${i.aliasMaxClass}` });
  checks.push({ name: "Model Alias Policy", result: i.matrixState === "DENIED" ? "FAIL" : "PASS", detail: "Alias is approved in catalog" });
  const remaining = i.teamBudget - i.teamSpent;
  const budgetOk = i.expectedSpend <= remaining;
  checks.push({ name: "Budget Availability", result: budgetOk ? "PASS" : "REVIEW", detail: `Expected $${i.expectedSpend} vs $${Math.round(remaining)} remaining team budget` });
  checks.push({ name: "Security Requirements", result: restricted ? "REVIEW" : "PASS", detail: restricted ? "Security sign-off needed" : "Standard controls apply" });

  let outcome: PreflightOutcome = "AUTO APPROVABLE";
  if (checks.some((c) => c.result === "FAIL")) outcome = "DENIED";
  else if (restricted) outcome = "SECURITY REVIEW REQUIRED";
  else if (checks.some((c) => c.result === "REVIEW")) outcome = "ADMIN APPROVAL REQUIRED";
  return { outcome, checks };
}
