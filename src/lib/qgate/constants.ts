export const ALIASES = ["qz-fast", "qz-balanced", "qz-reasoning", "qz-code", "qz-vision", "qz-embedding"] as const;
export const ENVIRONMENTS = ["Sandbox", "Development", "Test", "Production"] as const;
export const CLASSES = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"] as const;
export const TEAMS = ["Engineering", "Finance", "Analytics", "Commercial", "Supply Chain", "Research", "HR"] as const;
export const BUSINESS_UNITS = ["Technology", "Analytics", "Finance", "Commercial", "Supply Chain", "Research", "HR"] as const;
export const LOGGING_MODES = ["METADATA ONLY", "REDACTED CONTENT", "FULL CONTENT", "NO CONTENT RETENTION"] as const;
export const MATRIX_STATES = ["ALLOWED", "APPROVAL REQUIRED", "DENIED"] as const;
export const SCOPES = ["responses:write", "chat:write", "messages:write", "embeddings:write", "models:read", "usage:read"] as const;
export const STRATEGIES = [
  "Fixed",
  "Primary + Fallback",
  "Weighted",
  "Lowest Configured Cost",
  "Lowest Observed Latency",
  "Capability-Based",
  "Region-Aware",
  "Policy-Driven",
] as const;

export const ROLES = {
  org_admin: "Organization Admin",
  platform_admin: "AI Platform Admin",
  security_admin: "Security Admin",
  finops_admin: "FinOps Admin",
  team_admin: "Team Admin",
  developer: "Developer",
  app_owner: "Application Owner",
  auditor: "Auditor",
  viewer: "Viewer",
} as const;
export type Role = keyof typeof ROLES;

export type Permission =
  | "build"
  | "approve"
  | "manage_models"
  | "manage_policies"
  | "manage_finops"
  | "manage_users"
  | "view_audit"
  | "view_content";

const PERMS: Record<Role, Permission[]> = {
  org_admin: ["build", "approve", "manage_models", "manage_policies", "manage_finops", "manage_users", "view_audit", "view_content"],
  platform_admin: ["build", "approve", "manage_models", "view_audit"],
  security_admin: ["approve", "manage_policies", "view_audit", "view_content"],
  finops_admin: ["approve", "manage_finops", "view_audit"],
  team_admin: ["build", "approve"],
  developer: ["build"],
  app_owner: ["build"],
  auditor: ["view_audit"],
  viewer: [],
};

export function permissionsFor(roles: string[]): Permission[] {
  const s = new Set<Permission>();
  for (const r of roles) for (const p of PERMS[r as Role] ?? []) s.add(p);
  return [...s];
}

export function classRank(c: string): number {
  return Math.max(0, CLASSES.indexOf(c.toUpperCase() as (typeof CLASSES)[number]));
}

export const ENDPOINT_SCOPE: Record<string, string> = {
  responses: "responses:write",
  "chat/completions": "chat:write",
  messages: "messages:write",
  embeddings: "embeddings:write",
  models: "models:read",
};

export function fmtUsd(n: number, digits = 2) {
  return "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
export function fmtNum(n: number) {
  const v = Number(n || 0);
  if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return String(v);
}
