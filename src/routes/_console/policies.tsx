/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getGovernance, savePolicy, testContent } from "@/lib/qgate/api.functions";
import { Badge, errMsg, Field, inputCls, PageHeader, Panel, Select, Table, useCan } from "@/components/qg/ui";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_console/policies")({
  head: () => ({
    meta: [
      { title: "Policies & Guardrails — Q-GATE AI" },
      { name: "description", content: "Layered policies, demo DLP detection, secret leak protection, tool governance and a low-code policy builder." },
      { property: "og:title", content: "Policies & Guardrails — Q-GATE AI" },
      { property: "og:description", content: "Every request re-checks every policy layer." },
    ],
  }),
  component: Policies,
});

const LAYERS = ["Identity", "Entitlement", "Environment", "Data Classification", "Model", "Content", "Budget", "Rate Limit", "Region", "Logging", "Tool Access"];
const FIELDS = ["classification", "provider.type", "budget.pct", "environment", "alias", "team", "request.tokens", "region"];
const ACTIONS = ["ALLOW", "REDACT", "BLOCK", "REQUIRE APPROVAL", "REQUIRE FINOPS APPROVAL"];
const SAMPLES = [
  "Summarize the ticket from jane.doe@nova-enterprise.com, phone +1 415-555-0134, customer CUST-004512.",
  "Debug this: const client = new OpenAI({ apiKey: 'sk-proj-a8F2kLmN0pQ9rS7tUv' })",
  "Connect with postgres://admin:hunter2@db.internal:5432/prod and password=Winter2026!",
  "Card on file 4111 1111 1111 1111, SSN 123-45-6789.",
];

function evalRule(rule: any, ctx: any) {
  const v = (f: string) => ctx[f];
  const test = (c: any) => {
    const lhs = v(c.field);
    const rhs = isNaN(Number(c.value)) ? c.value : Number(c.value);
    switch (c.op) {
      case "=": return String(lhs).toUpperCase() === String(rhs).toUpperCase();
      case "!=": return String(lhs).toUpperCase() !== String(rhs).toUpperCase();
      case ">=": return Number(lhs) >= Number(rhs);
      case "<=": return Number(lhs) <= Number(rhs);
      case ">": return Number(lhs) > Number(rhs);
    }
    return false;
  };
  return (rule.all ?? []).every(test);
}

function Policies() {
  const fg = useServerFn(getGovernance);
  const sp = useServerFn(savePolicy);
  const tc = useServerFn(testContent);
  const qc = useQueryClient();
  const can = useCan("manage_policies");
  const { data } = useQuery({ queryKey: ["gov"], queryFn: () => fg() });
  const [layer, setLayer] = useState("All");
  const [text, setText] = useState(SAMPLES[0]);
  const [dlp, setDlp] = useState<any>(null);
  const [rule, setRule] = useState<any>({ name: "Restricted data never leaves approved endpoints", layer: "Data Classification", all: [{ field: "classification", op: "=", value: "RESTRICTED" }, { field: "provider.type", op: "=", value: "External" }], action: "BLOCK" });
  const [ctxT, setCtxT] = useState<any>({ classification: "RESTRICTED", "provider.type": "External", "budget.pct": 92, environment: "Production", alias: "qz-reasoning", team: "Finance", "request.tokens": 1200, region: "us-east" });
  const [ruleRes, setRuleRes] = useState<boolean | null>(null);
  const pols = (data?.policies ?? []).filter((p: any) => layer === "All" || p.layer === layer);

  const save = async (p: any) => {
    try {
      await sp({ data: p });
      toast.success(`Policy ${p.id ?? "created"} saved — effective on next request`);
      qc.invalidateQueries({ queryKey: ["gov"] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader index="07 · Guardrails" title="Policies & Guardrails" subtitle="Organization → Business Unit → Team → Project. Most restrictive applicable policy wins unless an authorized exception exists." />

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Content guardrail tester</h2>
            <Badge tone="ember">DEMO POLICY DETECTION</Badge>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">Lightweight pattern detection for demonstration — not a full enterprise DLP product.</p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {SAMPLES.map((s, i) => <button key={i} onClick={() => setText(s)} className="rounded-md border px-2 py-1 text-[11px] hover:bg-muted">Sample {i + 1}</button>)}
          </div>
          <textarea className={inputCls + " h-24 py-2 font-mono text-xs"} value={text} onChange={(e) => setText(e.target.value)} />
          <Button className="mt-3" onClick={async () => setDlp(await tc({ data: { text } }))}>Test content</Button>
          {dlp && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2"><span className="text-sm font-semibold">Decision</span><Badge>{dlp.decision === "BLOCK" ? "REQUEST BLOCKED" : dlp.decision}</Badge></div>
              {dlp.findings.map((f: any) => (
                <div key={f.policyId} className="flex items-center gap-2 text-xs"><Badge tone="muted">{f.policyId}</Badge><span className="font-semibold">{f.name}</span><Badge>{f.action}</Badge><span className="truncate font-mono text-muted-foreground">{f.matches.join(", ")}</span></div>
              ))}
              {dlp.decision === "REDACT" && <div><div className="eyebrow mb-1">Sanitized provider request</div><div className="code-panel p-3 text-xs">{dlp.sanitized}</div></div>}
              {dlp.decision === "BLOCK" && <div className="rounded-lg bg-danger-soft p-3 text-xs text-danger">POLICY_BLOCKED · {dlp.findings.find((f: any) => f.action === "BLOCK")?.policyId === "SEC-014" ? "Potential secret detected. Policy: SEC-014." : "Sensitive pattern detected."} Resolution: remove the value or request a policy exception.</div>}
            </div>
          )}
        </Panel>

        <Panel className="p-5">
          <h2 className="mb-3 font-semibold">Policy builder</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name"><input className={inputCls} value={rule.name} onChange={(e) => setRule({ ...rule, name: e.target.value })} /></Field>
            <Field label="Layer"><Select value={rule.layer} onChange={(v) => setRule({ ...rule, layer: v })} options={LAYERS} /></Field>
          </div>
          <div className="mt-3 space-y-2">
            {rule.all.map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-10 text-xs font-bold text-muted-foreground">{i === 0 ? "IF" : "AND"}</span>
                <Select className="flex-1" value={c.field} onChange={(v) => setRule({ ...rule, all: rule.all.map((x: any, j: number) => (j === i ? { ...x, field: v } : x)) })} options={FIELDS} />
                <Select className="w-20" value={c.op} onChange={(v) => setRule({ ...rule, all: rule.all.map((x: any, j: number) => (j === i ? { ...x, op: v } : x)) })} options={["=", "!=", ">=", "<=", ">"]} />
                <input className={inputCls + " flex-1"} value={c.value} onChange={(e) => setRule({ ...rule, all: rule.all.map((x: any, j: number) => (j === i ? { ...x, value: e.target.value } : x)) })} />
                <button className="text-xs text-muted-foreground" onClick={() => setRule({ ...rule, all: rule.all.filter((_: any, j: number) => j !== i) })}>✕</button>
              </div>
            ))}
            <button className="text-xs font-semibold text-primary" onClick={() => setRule({ ...rule, all: [...rule.all, { field: "budget.pct", op: ">=", value: "90" }] })}>+ AND condition</button>
            <div className="flex items-center gap-2"><span className="w-10 text-xs font-bold text-muted-foreground">THEN</span><Select value={rule.action} onChange={(v) => setRule({ ...rule, action: v })} options={ACTIONS} /></div>
          </div>
          <div className="mt-4 rounded-xl border p-3">
            <div className="eyebrow mb-2">Test against request context</div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {FIELDS.map((f) => <label key={f} className="text-[11px] text-muted-foreground">{f}<input className={inputCls + " h-8 text-xs"} value={ctxT[f]} onChange={(e) => setCtxT({ ...ctxT, [f]: e.target.value })} /></label>)}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setRuleRes(evalRule(rule, ctxT))}>Test policy</Button>
              {ruleRes !== null && <Badge>{ruleRes ? `MATCH → ${rule.action}` : "NO MATCH → continue"}</Badge>}
            </div>
          </div>
          <Button className="mt-4" disabled={!can} onClick={() => save({ name: rule.name, layer: rule.layer, description: rule.all.map((c: any) => `${c.field} ${c.op} ${c.value}`).join(" AND "), condition: { all: rule.all }, action: rule.action, origin: "Organization" })}>Create policy</Button>
          {!can && <span className="ml-2 text-xs text-muted-foreground">Requires Security Admin</span>}
        </Panel>
      </div>

      <Panel className="p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto font-semibold">Policy register · {data?.policies?.length ?? 0}</h2>
          <Select className="w-52" value={layer} onChange={setLayer} options={["All", ...LAYERS]} />
        </div>
        <Table
          head={["ID", "Name", "Layer", "Rule", "Action", "Origin", "Enabled"]}
          rows={pols.map((p: any) => [
            <span key="i" className="font-mono text-xs">{p.id}</span>, <b key="n">{p.name}</b>, p.layer, <span key="d" className="text-xs text-muted-foreground">{p.description}</span>,
            can ? <select key="a" className="h-7 rounded-md border bg-card px-1 text-xs" value={p.action} onChange={(e) => save({ ...p, action: e.target.value })}>{ACTIONS.map((a) => <option key={a}>{a}</option>)}</select> : <Badge key="a">{p.action}</Badge>,
            <Badge key="o" tone="muted">{p.origin}</Badge>,
            <Switch key="e" disabled={!can} checked={p.enabled} onCheckedChange={(b) => save({ ...p, enabled: b })} />,
          ])}
        />
      </Panel>

      <Panel className="p-5">
        <h2 className="mb-3 font-semibold">Effective policy · inheritance</h2>
        <div className="grid gap-3 md:grid-cols-4">
          {[
            ["Organization", "Restricted → approved endpoints only · secret leak BLOCK · deprecated models not routable"],
            ["Business Unit · Finance", "Custom keywords require approval · EU residency for EU projects"],
            ["Team · Finance", "Logging NO CONTENT RETENTION · ≥90% budget requires FinOps approval"],
            ["Project · Finance Copilot", "Max Confidential · Production only · 120 RPM"],
          ].map(([l, d], i) => (
            <div key={l} className="rounded-xl border p-3">
              <div className="eyebrow">Level {i + 1}</div>
              <div className="mt-1 font-semibold">{l}</div>
              <div className="mt-1 text-xs text-muted-foreground">{d}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">EFFECTIVE POLICY = intersection of all levels; the most restrictive value wins. Approved exceptions (e.g. temporary entitlements) are recorded in the Approval Center and Audit Trail.</p>
      </Panel>
    </div>
  );
}
