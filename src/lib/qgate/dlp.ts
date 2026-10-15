// DEMO POLICY DETECTION — lightweight pattern matching, not full enterprise DLP.
export type DlpAction = "ALLOW" | "REDACT" | "BLOCK" | "REQUIRE APPROVAL";
export interface DlpPolicy {
  id: string;
  name: string;
  action: string;
  enabled: boolean;
  condition: { detector?: string; keywords?: string[] } | null;
}
export interface DlpFinding {
  policyId: string;
  name: string;
  detector: string;
  action: DlpAction;
  matches: string[];
}

const DETECTORS: Record<string, RegExp> = {
  email: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  phone: /\+?\d{1,3}[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}\b/g,
  card: /\b(?:\d[ -]?){13,16}\b/g,
  govid: /\b\d{3}-\d{2}-\d{4}\b/g,
  customer: /\bCUST-\d{6}\b/gi,
  privatekey: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  connstring: /\b(?:postgres(?:ql)?|mongodb(?:\+srv)?|mysql|redis):\/\/\S+|Server=[^;]+;[^\n]*Password=[^;\s]+/gi,
  password: /password\s*[=:]\s*\S+/gi,
  apikey: /\b(?:sk-[A-Za-z0-9_-]{12,}|qzg_(?:live|test)_[A-Za-z0-9]{8,}|AKIA[0-9A-Z]{16})\b/g,
};

export function scanText(text: string, policies: DlpPolicy[]): DlpFinding[] {
  const out: DlpFinding[] = [];
  for (const p of policies) {
    if (!p.enabled || !p.condition?.detector) continue;
    const d = p.condition.detector;
    let matches: string[] = [];
    if (d === "keywords") {
      const lower = text.toLowerCase();
      matches = (p.condition.keywords ?? []).filter((k) => lower.includes(k.toLowerCase()));
    } else if (DETECTORS[d]) {
      matches = text.match(new RegExp(DETECTORS[d].source, DETECTORS[d].flags)) ?? [];
    }
    if (matches.length) out.push({ policyId: p.id, name: p.name, detector: d, action: p.action as DlpAction, matches });
  }
  return out;
}

export function redact(text: string, findings: DlpFinding[]): string {
  let t = text;
  for (const f of findings) {
    if (f.action !== "REDACT") continue;
    for (const m of f.matches) t = t.split(m).join(`[REDACTED:${f.detector.toUpperCase()}]`);
  }
  return t;
}

export function decide(findings: DlpFinding[]): DlpAction {
  if (findings.some((f) => f.action === "BLOCK")) return "BLOCK";
  if (findings.some((f) => f.action === "REQUIRE APPROVAL")) return "REQUIRE APPROVAL";
  if (findings.some((f) => f.action === "REDACT")) return "REDACT";
  return "ALLOW";
}
