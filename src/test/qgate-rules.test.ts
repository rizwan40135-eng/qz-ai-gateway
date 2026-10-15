import { describe, expect, it } from "vitest";
import { evaluatePreflight } from "@/lib/qgate/preflight";
import { decide, redact, scanText } from "@/lib/qgate/dlp";
import { permissionsFor } from "@/lib/qgate/constants";

const base = {
  userRoles: ["developer"],
  matrixState: "ALLOWED",
  projectStatus: "active",
  environment: "Development",
  aliasEnvironments: ["Sandbox", "Development", "Test", "Production"],
  dataClass: "INTERNAL",
  aliasMaxClass: "INTERNAL",
  expectedSpend: 100,
  teamBudget: 20000,
  teamSpent: 12400,
};

describe("access preflight", () => {
  it("auto-approves qz-code in Development with Internal data", () => {
    expect(evaluatePreflight(base).outcome).toBe("AUTO APPROVABLE");
  });
  it("requires admin approval for Production", () => {
    expect(evaluatePreflight({ ...base, environment: "Production" }).outcome).toBe("ADMIN APPROVAL REQUIRED");
  });
  it("requires security review for Restricted data", () => {
    expect(evaluatePreflight({ ...base, dataClass: "RESTRICTED", aliasMaxClass: "RESTRICTED" }).outcome).toBe("SECURITY REVIEW REQUIRED");
  });
  it("denies when matrix says DENIED", () => {
    expect(evaluatePreflight({ ...base, matrixState: "DENIED" }).outcome).toBe("DENIED");
  });
});

const policies = [
  { id: "SEC-014", name: "secret", action: "BLOCK", enabled: true, condition: { detector: "apikey" } },
  { id: "DLP-005", name: "email", action: "REDACT", enabled: true, condition: { detector: "email" } },
];

describe("demo DLP", () => {
  it("blocks a leaked sk- key under SEC-014", () => {
    const f = scanText("use sk-abcdefghijklmnop123 please", policies);
    expect(decide(f)).toBe("BLOCK");
    expect(f[0].policyId).toBe("SEC-014");
  });
  it("redacts emails", () => {
    const f = scanText("mail jane@nova.com now", policies);
    expect(decide(f)).toBe("REDACT");
    expect(redact("mail jane@nova.com now", f)).toBe("mail [REDACTED:EMAIL] now");
  });
});

describe("RBAC", () => {
  it("FinOps can manage budgets but not models", () => {
    const p = permissionsFor(["finops_admin"]);
    expect(p).toContain("manage_finops");
    expect(p).not.toContain("manage_models");
  });
  it("Auditor is read-only", () => {
    expect(permissionsFor(["auditor"])).toEqual(["view_audit"]);
  });
});
