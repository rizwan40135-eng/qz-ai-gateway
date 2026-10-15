/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, Loader2, Play, XCircle } from "lucide-react";
import {
  createKey, createProject, decideRequest, demoAnalyticsBudget, demoFinanceKey, demoTempAccess, getCatalog, getMyAccess, getTrace, setGovernance,
  setMatrix, setModelOutage, submitAccessRequest, updateAliasRoute,
} from "@/lib/qgate/api.functions";
import { Badge, errMsg, gatewayBase, keyStore, PageHeader, Panel, useMe } from "@/components/qg/ui";
import { callGateway } from "@/components/qg/gatewayClient";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_console/demo")({
  head: () => ({
    meta: [
      { title: "Live Demo — Q-GATE AI" },
      { name: "description", content: "Seven guided live demos of access, keys, governance, routing, failover, data security and budget control." },
      { property: "og:title", content: "Live Demo — Q-GATE AI" },
      { property: "og:description", content: "The defining Q-GATE experience, end to end, with real gateway calls." },
    ],
  }),
  component: Demo,
});

type Line = { t: string; ok?: boolean; tag?: string; id?: string | null; mono?: string };
const DEMOS = [
  { n: 1, t: "User requests access", d: "Project → Request qz-code → policy preflight → AUTO APPROVED → entitlement ACTIVE." },
  { n: 2, t: "Issue key & call the API", d: "Create qzg_ key (shown once) → OPENAI_* env → real streaming request → trace." },
  { n: 3, t: "Admin governance", d: "Finance qz-reasoning Production → APPROVAL REQUIRED → 403 → temporary approval → success." },
  { n: 4, t: "Model routing", d: "Same key, endpoint, alias — admin remaps qz-code to Provider Model B." },
  { n: 5, t: "Failover", d: "Primary route outage → circuit open → permitted fallback → same request ID." },
  { n: 6, t: "Data security", d: "PII is redacted before the provider; a leaked secret is blocked (SEC-014)." },
  { n: 7, t: "Budget control", d: "Analytics at 90%+ → BUDGET WARNING → Continue / Use qz-balanced / Block." },
];

function Demo() {
  const me = useMe();
  const qc = useQueryClient();
  const S = {
    cp: useServerFn(createProject), sar: useServerFn(submitAccessRequest), ma: useServerFn(getMyAccess), ck: useServerFn(createKey), gt: useServerFn(getTrace),
    fk: useServerFn(demoFinanceKey), sm: useServerFn(setMatrix), ta: useServerFn(demoTempAccess), dr: useServerFn(decideRequest), cat: useServerFn(getCatalog),
    ua: useServerFn(updateAliasRoute), mo: useServerFn(setModelOutage), ab: useServerFn(demoAnalyticsBudget), sg: useServerFn(setGovernance),
  };
  const [logs, setLogs] = useState<Record<number, Line[]>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [state, setState] = useState<any>({});
  const [budgetKey, setBudgetKey] = useState<string | null>(null);
  const log = (n: number, l: Line) => setLogs((o) => ({ ...o, [n]: [...(o[n] ?? []), l] }));

  async function devKey(): Promise<string> {
    if (state.devKey) return state.devKey;
    throw new Error("Run Demo 2 first to issue a Q-GATE key.");
  }

  async function run(n: number) {
    setBusy(n);
    setLogs((o) => ({ ...o, [n]: [] }));
    try {
      if (n === 1) {
        log(n, { t: `Developer signed in as ${me.user?.name} (Lovable workspace identity)`, ok: true });
        let acc = await S.ma();
        let p = acc.projects?.find((x: any) => x.name === "Developer Productivity");
        if (!p) p = await S.cp({ data: { name: "Developer Productivity", team: "Engineering", business_unit: "Technology", environment: "Development", use_case: "Coding Assistant", data_class: "INTERNAL", app_name: "Developer Agent", cost_center: "CC-4120", expected_requests: 50000, expected_tokens: 20000000, description: "Coding assistant" } });
        log(n, { t: `Project: ${p.name} · Development · Internal · Coding Assistant`, ok: true });
        log(n, { t: "REQUEST MODEL ACCESS → qz-code" });
        const r = await S.sar({ data: { project_id: p.id, alias: "qz-code", use_case: "Coding Assistant", environment: "Development", data_class: "INTERNAL", expected_tokens: 5000000, expected_spend: 120, duration_days: 90, justification: "Live demo" } });
        for (const c of r.preflight.checks) log(n, { t: `${c.name}: ${c.detail}`, ok: c.result === "PASS" });
        log(n, { t: `Result: ${r.preflight.outcome === "AUTO APPROVABLE" ? "AUTO APPROVED" : r.preflight.outcome}`, ok: !!r.entitlement, tag: r.entitlement ? "ENTITLEMENT ACTIVE" : undefined });
        acc = await S.ma();
        const e = acc.entitlements.find((x: any) => x.alias === "qz-code" && x.project_id === p.id && x.status === "active");
        if (e) log(n, { t: `MY AI ACCESS · qz-code ACTIVE · ${e.environment} · budget $${e.monthly_budget} · ${e.rpm} RPM · expires ${new Date(e.expires_at).toLocaleDateString()} · ${e.logging}`, ok: true, mono: gatewayBase() });
        setState((s: any) => ({ ...s, project: p, ent: e }));
      }
      if (n === 2) {
        let ent = state.ent;
        if (!ent) {
          const acc = await S.ma();
          ent = acc.entitlements.find((x: any) => x.alias === "qz-code" && x.status === "active");
          if (!ent) throw new Error("Run Demo 1 first.");
        }
        log(n, { t: "CREATE API KEY", ok: true });
        const k = await S.ck({ data: { project_id: ent.project_id, name: "developer-agent-demo", environment: ent.environment, aliases: ["qz-code"], scopes: ["responses:write", "chat:write", "messages:write", "models:read"], budget: 500, rpm: 100, expiry_days: 90, live: true } });
        keyStore.set({ key: k.plaintext, alias: "qz-code", env: ent.environment });
        log(n, { t: "Copy this key now. It will not be shown again.", tag: "SHOWN ONCE", mono: k.plaintext });
        log(n, { t: "Integration", mono: `OPENAI_API_KEY=${k.plaintext}\nOPENAI_BASE_URL=${gatewayBase()}\nMODEL=qz-code` });
        log(n, { t: "TEST CONNECTION → POST /v1/responses (stream)" });
        const r = await callGateway({ key: k.plaintext, path: "/responses", body: { model: "qz-code", input: "In one sentence, what does an enterprise AI gateway do?", stream: true } });
        log(n, { t: r.text, ok: r.status === 200, tag: r.headers["x-qgate-simulated"] ? "SIMULATED PROVIDER RESPONSE" : `HTTP ${r.status}`, id: r.requestId });
        const t = r.requestId ? await S.gt({ data: { id: r.requestId } }) : null;
        if (t) log(n, { t: `Trace: ${t.user_name} · ${t.project_name} · ${t.key_prefix} · ${t.alias} → ${t.provider} / ${t.model} · ${t.input_tokens} in / ${t.output_tokens} out · $${Number(t.cost).toFixed(6)} · ${t.latency_ms}ms · ${t.policy_result}`, ok: true, id: t.id });
        setState((s: any) => ({ ...s, devKey: k.plaintext }));
      }
      if (n === 3) {
        const f = await S.fk();
        log(n, { t: "Finance service key issued (qz-fast, qz-reasoning · Production · Confidential)", ok: true });
        const a = await callGateway({ key: f.key, path: "/chat/completions", body: { model: "qz-reasoning", messages: [{ role: "user", content: "One-line variance insight." }] } });
        log(n, { t: `Baseline qz-reasoning → HTTP ${a.status}`, ok: a.status === 200, id: a.requestId });
        await S.sm({ data: { team: "Finance", alias: "qz-reasoning", environment: "Production", state: "APPROVAL REQUIRED" } });
        log(n, { t: "Admin: Finance · qz-reasoning · Production → APPROVAL REQUIRED", tag: "MATRIX CHANGED" });
        const b = await callGateway({ key: f.key, path: "/chat/completions", body: { model: "qz-reasoning", messages: [{ role: "user", content: "One-line variance insight." }] } });
        log(n, { t: `${b.status} · ${b.json?.error?.message}`, ok: b.status === 403, id: b.requestId });
        const c = await callGateway({ key: f.key, path: "/chat/completions", body: { model: "qz-fast", messages: [{ role: "user", content: "Say OK." }] } });
        log(n, { t: `Same key, qz-fast → HTTP ${c.status} (key remains valid for other models)`, ok: c.status === 200, id: c.requestId });
        const req = await S.ta({ data: { project_id: f.project_id } });
        log(n, { t: "Temporary-access request submitted" });
        await S.dr({ data: { id: req.id, action: "approve_conditions", conditions: { alias: "qz-reasoning", environment: "Production", max_class: "CONFIDENTIAL", monthly_budget: 100, expiry_days: 7, logging: "NO CONTENT RETENTION", rpm: 60, tpm: 50000 } } });
        log(n, { t: "Admin approved: 7 days · $100 · Production · Confidential max", ok: true });
        const d = await callGateway({ key: f.key, path: "/chat/completions", body: { model: "qz-reasoning", messages: [{ role: "user", content: "One-line variance insight." }] } });
        log(n, { t: `Retry qz-reasoning → HTTP ${d.status}`, ok: d.status === 200, id: d.requestId });
      }
      if (n === 4) {
        const key = await devKey();
        const body = { model: "qz-code", input: "Name one common Python bug." };
        const a = await callGateway({ key, path: "/responses", body });
        const ta = a.requestId ? await S.gt({ data: { id: a.requestId } }) : null;
        log(n, { t: `Request 1 · model="qz-code" → ${ta?.model}`, ok: a.status === 200, id: a.requestId, tag: "PROVIDER MODEL A" });
        const cat = await S.cat();
        const cur = cat.aliases.find((x: any) => x.alias === "qz-code");
        const target = cur.primary_model === "m-gpt-terra" ? "m-gemini-flash" : "m-gpt-terra";
        const v = await S.ua({ data: { alias: "qz-code", primary_model: target, fallback_model: cur.primary_model, strategy: "Primary + Fallback", note: "Live demo: evaluation passed, route approved" } });
        log(n, { t: `Admin approved qz-code v${v.version} → ${cat.models.find((m: any) => m.id === target)?.provider_model}`, tag: "ROUTE VERSION APPROVED" });
        const b = await callGateway({ key, path: "/responses", body });
        const tb = b.requestId ? await S.gt({ data: { id: b.requestId } }) : null;
        log(n, { t: `Request 2 · identical request → ${tb?.model}`, ok: b.status === 200, id: b.requestId, tag: "PROVIDER MODEL B" });
        log(n, { t: "Same API key · same endpoint · same alias", ok: true, tag: "NO DEVELOPER CODE CHANGE" });
      }
      if (n === 5) {
        const key = await devKey();
        const cat = await S.cat();
        const cur = cat.aliases.find((x: any) => x.alias === "qz-code");
        await S.mo({ data: { id: cur.primary_model, on: true } });
        log(n, { t: `Primary route ${cat.models.find((m: any) => m.id === cur.primary_model)?.provider_model} marked unhealthy`, tag: "OUTAGE SIMULATED" });
        const r = await callGateway({ key, path: "/responses", body: { model: "qz-code", input: "Give me one refactoring tip." } });
        const t = r.requestId ? await S.gt({ data: { id: r.requestId } }) : null;
        for (const s of (t?.steps ?? []).filter((x: any) => ["Route Selected", "Provider Called", "Circuit Breaker", "Fallback Checked"].includes(x.n))) log(n, { t: `${s.n}: ${s.detail}`, ok: s.result !== "FAIL" });
        log(n, { t: `Response returned via fallback ${t?.model} · request ${r.requestId}`, ok: r.status === 200 && !!t?.fallback, id: r.requestId, tag: "NO DEVELOPER CONFIGURATION CHANGE" });
        await S.mo({ data: { id: cur.primary_model, on: false } });
        log(n, { t: "Primary health restored" });
      }
      if (n === 6) {
        const key = await devKey();
        const a = await callGateway({ key, path: "/responses", body: { model: "qz-code", input: "Write a reply to jane.doe@nova-enterprise.com, phone +1 415-555-0134, about CUST-004512." } });
        const ta = a.requestId ? await S.gt({ data: { id: a.requestId } }) : null;
        log(n, { t: `Scenario A · REDACT → HTTP ${a.status} · redacted by ${a.headers["x-qgate-redacted"] ?? "—"}`, ok: a.status === 200, id: a.requestId, tag: "DEMO POLICY DETECTION" });
        const step = ta?.steps?.find((s: any) => s.n === "Content Guardrail");
        if (step) log(n, { t: step.detail, mono: "Sanitized provider request: Write a reply to [REDACTED:EMAIL], phone [REDACTED:PHONE], about [REDACTED:CUSTOMER]." });
        const b = await callGateway({ key, path: "/responses", body: { model: "qz-code", input: "Why does this fail? const c = new OpenAI({ apiKey: 'sk-proj-a8F2kLmN0pQ9rS7tUv' })" } });
        log(n, { t: `Scenario B · ${b.status} ${b.json?.error?.code?.toUpperCase()} · ${b.json?.error?.message}`, ok: b.status === 403, id: b.requestId, tag: `Policy ${b.json?.error?.policy_id}` });
        log(n, { t: `Resolution: ${b.json?.error?.resolution}` });
      }
      if (n === 7) {
        const r = await S.ab({ data: { enforcement: "Recommend Lower-Cost Alias" } });
        setBudgetKey(r.key);
        log(n, { t: "Analytics Team set to 91% of $12,000 monthly budget · enforcement: Recommend Lower-Cost Alias", tag: "BUDGET 91%" });
        const a = await callGateway({ key: r.key, path: "/responses", body: { model: "qz-reasoning", input: "Segment churn drivers in one line." } });
        log(n, { t: `${a.status} · ${a.json?.error?.message}`, ok: a.status === 402, id: a.requestId, tag: "BUDGET WARNING" });
        log(n, { t: `Options per configured policy: ${(a.json?.error?.options ?? []).join(" · ")} · Block` });
      }
      qc.invalidateQueries();
    } catch (e) {
      log(n, { t: errMsg(e), ok: false });
    }
    setBusy(null);
  }

  async function budgetOption(opt: "continue" | "use-lower-cost" | "block") {
    if (!budgetKey) return;
    setBusy(7);
    try {
      if (opt === "block") {
        await S.sg({ data: { team: "Analytics", enforcement: "Block" } });
        log(7, { t: "Admin switched Analytics ≥90% enforcement to Block" });
      }
      const r = await callGateway({ key: budgetKey, path: "/responses", body: { model: "qz-reasoning", input: "Segment churn drivers in one line." }, headers: opt === "block" ? {} : { "x-qgate-budget-action": opt } });
      const t = r.requestId ? await S.gt({ data: { id: r.requestId } }) : null;
      log(7, { t: `${opt === "continue" ? "Continue" : opt === "block" ? "Block" : "Use qz-balanced"} → HTTP ${r.status}${t?.alias ? ` · served by ${t.alias}` : ""}${r.json?.error ? ` · ${r.json.error.message}` : ""}`, ok: opt === "block" ? r.status === 402 : r.status === 200, id: r.requestId });
      if (opt === "block") await S.sg({ data: { team: "Analytics", enforcement: "Recommend Lower-Cost Alias" } });
    } catch (e) {
      log(7, { t: errMsg(e), ok: false });
    }
    setBusy(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader index="Run live demo" title="The defining Q-GATE experience" subtitle="Each step calls the real gateway and writes real traces, entitlements and audit events. Run 1 → 2 first; the rest build on the issued key." />
      <div className="grid gap-4 xl:grid-cols-2">
        {DEMOS.map((d) => (
          <Panel key={d.n} className="flex flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="eyebrow text-ember">Live demo {d.n}</div>
                <div className="font-display text-lg font-semibold">{d.t}</div>
                <p className="mt-1 text-sm text-muted-foreground">{d.d}</p>
              </div>
              <Button onClick={() => run(d.n)} disabled={busy !== null}>{busy === d.n ? <Loader2 className="animate-spin" /> : <Play />} Run</Button>
            </div>
            {!!logs[d.n]?.length && (
              <ol className="mt-4 space-y-2 border-t pt-3 text-sm">
                {logs[d.n].map((l, i) => (
                  <li key={i} className="flex gap-2">
                    {l.ok === undefined ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" /> : l.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{l.t}</span>
                        {l.tag && <Badge>{l.tag}</Badge>}
                        {l.id && <Link to="/trace/$id" params={{ id: l.id }} className="font-mono text-[11px] text-primary">view trace →</Link>}
                      </div>
                      {l.mono && <pre className="code-panel mt-1 overflow-x-auto whitespace-pre-wrap break-all p-2 text-[11px]">{l.mono}</pre>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {d.n === 7 && budgetKey && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => budgetOption("continue")}>Continue</Button>
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => budgetOption("use-lower-cost")}>Use qz-balanced</Button>
                <Button size="sm" variant="outline" asChild><Link to="/approvals">Request budget</Link></Button>
                <Button size="sm" variant="destructive" disabled={busy !== null} onClick={() => budgetOption("block")}>Block</Button>
              </div>
            )}
          </Panel>
        ))}
      </div>
    </div>
  );
}
