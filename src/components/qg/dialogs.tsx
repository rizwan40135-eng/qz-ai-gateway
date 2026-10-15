/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createKey, createProject, previewAccess, submitAccessRequest } from "@/lib/qgate/api.functions";
import { ALIASES, BUSINESS_UNITS, CLASSES, ENVIRONMENTS, SCOPES, TEAMS } from "@/lib/qgate/constants";
import { Badge, CopyButton, errMsg, Field, gatewayBase, inputCls, keyStore, Select, useMe } from "./ui";

export function CreateProjectDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (b: boolean) => void; onCreated?: (p: any) => void }) {
  const me = useMe();
  const fn = useServerFn(createProject);
  const qc = useQueryClient();
  const [f, setF] = useState<any>({});
  useEffect(() => {
    if (open)
      setF({ name: "Developer Productivity", team: "Engineering", business_unit: "Technology", owner: me.user?.name, environment: "Development", use_case: "Coding Assistant", data_class: "INTERNAL", expected_requests: 50000, expected_tokens: 20000000, cost_center: "CC-4120", app_name: "Developer Agent", description: "AI pair-programming and code review for the platform team." });
  }, [open, me.user?.name]);
  const s = (k: string) => (v: any) => setF((o: any) => ({ ...o, [k]: v }));
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Project Name"><input className={inputCls} value={f.name ?? ""} onChange={(e) => s("name")(e.target.value)} /></Field>
          <Field label="Application Name"><input className={inputCls} value={f.app_name ?? ""} onChange={(e) => s("app_name")(e.target.value)} /></Field>
          <Field label="Team"><Select value={f.team ?? ""} onChange={s("team")} options={TEAMS} /></Field>
          <Field label="Business Unit"><Select value={f.business_unit ?? ""} onChange={s("business_unit")} options={BUSINESS_UNITS} /></Field>
          <Field label="Owner"><input className={inputCls} value={f.owner ?? ""} onChange={(e) => s("owner")(e.target.value)} /></Field>
          <Field label="Environment"><Select value={f.environment ?? ""} onChange={s("environment")} options={ENVIRONMENTS} /></Field>
          <Field label="Use Case"><input className={inputCls} value={f.use_case ?? ""} onChange={(e) => s("use_case")(e.target.value)} /></Field>
          <Field label="Data Classification"><Select value={f.data_class ?? ""} onChange={s("data_class")} options={CLASSES} /></Field>
          <Field label="Expected Monthly Requests"><input type="number" className={inputCls} value={f.expected_requests ?? 0} onChange={(e) => s("expected_requests")(e.target.value)} /></Field>
          <Field label="Expected Tokens"><input type="number" className={inputCls} value={f.expected_tokens ?? 0} onChange={(e) => s("expected_tokens")(e.target.value)} /></Field>
          <Field label="Cost Center"><input className={inputCls} value={f.cost_center ?? ""} onChange={(e) => s("cost_center")(e.target.value)} /></Field>
          <div className="sm:col-span-2"><Field label="Description"><textarea className={inputCls + " h-16 py-2"} value={f.description ?? ""} onChange={(e) => s("description")(e.target.value)} /></Field></div>
        </div>
        <DialogFooter>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const p = await fn({ data: f });
                toast.success(`Project ${p.name} created`);
                qc.invalidateQueries();
                onOpenChange(false);
                onCreated?.(p);
              } catch (e) {
                toast.error(errMsg(e));
              }
              setBusy(false);
            }}
          >
            Create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ICON = { PASS: CheckCircle2, REVIEW: AlertTriangle, FAIL: XCircle } as const;
export function Checks({ checks }: { checks: { name: string; result: string; detail: string }[] }) {
  return (
    <div className="divide-y rounded-xl border">
      {checks.map((c) => {
        const I = ICON[c.result as keyof typeof ICON] ?? CircleDashed;
        return (
          <div key={c.name} className="flex items-center gap-3 px-3 py-2 text-sm">
            <I className={`h-4 w-4 ${c.result === "PASS" ? "text-success" : c.result === "FAIL" ? "text-danger" : "text-warning"}`} />
            <span className="w-44 font-semibold">{c.name}</span>
            <span className="flex-1 text-xs text-muted-foreground">{c.detail}</span>
            <Badge>{c.result}</Badge>
          </div>
        );
      })}
    </div>
  );
}

export function RequestAccessDialog({ open, onOpenChange, projects, defaultProject, defaultAlias, kind }: { open: boolean; onOpenChange: (b: boolean) => void; projects: any[]; defaultProject?: string; defaultAlias?: string; kind?: string }) {
  const submit = useServerFn(submitAccessRequest);
  const preview = useServerFn(previewAccess);
  const qc = useQueryClient();
  const [f, setF] = useState<any>({});
  const [pf, setPf] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const p = projects.find((x) => x.id === defaultProject) ?? projects[0];
    setResult(null);
    setF({ project_id: p?.id, alias: defaultAlias ?? "qz-code", use_case: p?.use_case ?? "", environment: p?.environment ?? "Development", data_class: p?.data_class ?? "INTERNAL", expected_tokens: 5000000, expected_spend: 120, duration_days: 90, justification: "Enable AI-assisted code review and refactoring for the platform team.", kind });
  }, [open, defaultProject, defaultAlias, projects, kind]);
  useEffect(() => {
    if (!open || !f.project_id) return;
    const t = setTimeout(() => preview({ data: { project_id: f.project_id, alias: f.alias, environment: f.environment, data_class: f.data_class, expected_spend: Number(f.expected_spend) } }).then(setPf).catch(() => setPf(null)), 250);
    return () => clearTimeout(t);
  }, [open, f.project_id, f.alias, f.environment, f.data_class, f.expected_spend, preview]);
  const s = (k: string) => (v: any) => setF((o: any) => ({ ...o, [k]: v }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request model access</DialogTitle>
        </DialogHeader>
        {result ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-muted p-4">
              <div className="eyebrow">Preflight result</div>
              <div className="mt-1 flex items-center gap-2 font-display text-xl font-semibold">
                {result.preflight.outcome === "AUTO APPROVABLE" ? "AUTO APPROVED" : result.preflight.outcome}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.entitlement ? `Entitlement for ${result.entitlement.alias} is ACTIVE in ${result.entitlement.environment}. Open My AI Access to create a key.` : result.preflight.outcome === "DENIED" ? "The request violates policy and cannot be approved." : "Routed to the Approval Center for admin decision."}
              </p>
            </div>
            <Checks checks={result.preflight.checks} />
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>{result.entitlement ? "Go to My AI Access" : "Close"}</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Project"><Select value={f.project_id ?? ""} onChange={s("project_id")} options={projects.map((p) => ({ v: p.id, l: p.name }))} /></Field>
              <Field label="Requested Alias"><Select value={f.alias ?? ""} onChange={s("alias")} options={ALIASES} /></Field>
              <Field label="Use Case"><input className={inputCls} value={f.use_case ?? ""} onChange={(e) => s("use_case")(e.target.value)} /></Field>
              <Field label="Environment"><Select value={f.environment ?? ""} onChange={s("environment")} options={ENVIRONMENTS} /></Field>
              <Field label="Data Classification"><Select value={f.data_class ?? ""} onChange={s("data_class")} options={CLASSES} /></Field>
              <Field label="Duration (days)"><input type="number" className={inputCls} value={f.duration_days ?? 90} onChange={(e) => s("duration_days")(e.target.value)} /></Field>
              <Field label="Expected Monthly Tokens"><input type="number" className={inputCls} value={f.expected_tokens ?? 0} onChange={(e) => s("expected_tokens")(e.target.value)} /></Field>
              <Field label="Expected Spend (USD)"><input type="number" className={inputCls} value={f.expected_spend ?? 0} onChange={(e) => s("expected_spend")(e.target.value)} /></Field>
              <div className="sm:col-span-2"><Field label="Business Justification"><textarea className={inputCls + " h-16 py-2"} value={f.justification ?? ""} onChange={(e) => s("justification")(e.target.value)} /></Field></div>
            </div>
            {pf && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="eyebrow">Automatic access preflight</span>
                  <Badge>{pf.outcome}</Badge>
                </div>
                <Checks checks={pf.checks} />
              </div>
            )}
            <DialogFooter>
              <Button
                disabled={busy || !f.project_id}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await submit({ data: f });
                    setResult(r);
                    qc.invalidateQueries();
                  } catch (e) {
                    toast.error(errMsg(e));
                  }
                  setBusy(false);
                }}
              >
                Submit request
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CreateKeyDialog({ open, onOpenChange, ent, project }: { open: boolean; onOpenChange: (b: boolean) => void; ent: any; project: any }) {
  const fn = useServerFn(createKey);
  const qc = useQueryClient();
  const [f, setF] = useState<any>({});
  const [created, setCreated] = useState<any>(null);
  useEffect(() => {
    if (open && ent) {
      setCreated(null);
      setF({ name: `${project?.app_name ?? "app"}-${ent.alias}`.toLowerCase().replace(/\s+/g, "-"), scopes: ["responses:write", "chat:write", "messages:write", "embeddings:write", "models:read"], budget: ent.monthly_budget, rpm: ent.rpm, expiry_days: 90, kind: "human", live: true });
    }
  }, [open, ent, project]);
  if (!ent) return null;
  const base = gatewayBase();
  return (
    <Dialog open={open} onOpenChange={(b) => { if (!b) setCreated(null); onOpenChange(b); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{created ? "Your Q-GATE API key" : `Create API key · ${ent.alias}`}</DialogTitle>
        </DialogHeader>
        {created ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-xl bg-peach p-3 text-sm text-ember">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <b>Copy this key now. It will not be shown again.</b>
            </div>
            <div className="code-panel flex items-center justify-between gap-3 p-3 text-sm">
              <span className="break-all">{created.plaintext}</span>
              <CopyButton text={created.plaintext} />
            </div>
            <div className="code-panel p-3 text-[12.5px] leading-6">
              <div className="mb-1 flex justify-end"><CopyButton text={`OPENAI_API_KEY=${created.plaintext}\nOPENAI_BASE_URL=${base}\nMODEL=${ent.alias}`} /></div>
              OPENAI_API_KEY={created.plaintext}
              <br />OPENAI_BASE_URL={base}
              <br />MODEL={ent.alias}
            </div>
            <p className="text-xs text-muted-foreground">Q-GATE stores only a SHA-256 hash. After closing you will see {created.prefix}••••••••{created.last4}. Lost it? Rotate or create a new key.</p>
            <DialogFooter><Button onClick={() => onOpenChange(false)}>I have copied the key</Button></DialogFooter>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Key name"><input className={inputCls} value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
              <Field label="Credential type"><Select value={f.kind ?? "human"} onChange={(v) => setF({ ...f, kind: v })} options={[{ v: "human", l: "Human (developer)" }, { v: "service", l: "Service account (app/agent)" }]} /></Field>
              <Field label="Key prefix"><Select value={f.live ? "live" : "test"} onChange={(v) => setF({ ...f, live: v === "live" })} options={[{ v: "live", l: "qzg_live_" }, { v: "test", l: "qzg_test_" }]} /></Field>
              <Field label="Expiry (days)"><input type="number" className={inputCls} value={f.expiry_days ?? 90} onChange={(e) => setF({ ...f, expiry_days: Number(e.target.value) })} /></Field>
              <Field label="Key budget (USD)"><input type="number" className={inputCls} value={f.budget ?? 0} onChange={(e) => setF({ ...f, budget: Number(e.target.value) })} /></Field>
              <Field label="RPM"><input type="number" className={inputCls} value={f.rpm ?? 0} onChange={(e) => setF({ ...f, rpm: Number(e.target.value) })} /></Field>
            </div>
            <Field label="Scopes (no admin scopes are issuable)">
              <div className="flex flex-wrap gap-2">
                {SCOPES.map((sc) => (
                  <label key={sc} className="flex items-center gap-1.5 rounded-lg border px-2 py-1 font-mono text-xs">
                    <input type="checkbox" checked={f.scopes?.includes(sc)} onChange={(e) => setF({ ...f, scopes: e.target.checked ? [...f.scopes, sc] : f.scopes.filter((x: string) => x !== sc) })} />
                    {sc}
                  </label>
                ))}
              </div>
            </Field>
            <div className="text-xs text-muted-foreground">Bound to project <b>{project?.name}</b> · {ent.environment} · alias {ent.alias}</div>
            <DialogFooter>
              <Button
                onClick={async () => {
                  try {
                    const r = await fn({ data: { ...f, project_id: ent.project_id, environment: ent.environment, aliases: [ent.alias] } });
                    setCreated(r);
                    keyStore.set({ key: r.plaintext, alias: ent.alias, env: ent.environment });
                    qc.invalidateQueries();
                  } catch (e) {
                    toast.error(errMsg(e));
                  }
                }}
              >
                Create API key
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
