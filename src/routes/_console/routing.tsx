/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, RotateCcw, XCircle, AlertTriangle } from "lucide-react";
import { getCatalog, listProjects, rollbackAlias, setModelOutage, simulateRoute, updateAliasRoute } from "@/lib/qgate/api.functions";
import { ALIASES, CLASSES, ENVIRONMENTS, STRATEGIES, TEAMS } from "@/lib/qgate/constants";
import { Badge, errMsg, Field, inputCls, PageHeader, Panel, Select, Table, useCan } from "@/components/qg/ui";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_console/routing")({
  head: () => ({
    meta: [
      { title: "Routing Studio — Q-GATE AI" },
      { name: "description", content: "Configure alias routes, versions, fallback and failover; simulate any request against live policy." },
      { property: "og:title", content: "Routing Studio — Q-GATE AI" },
      { property: "og:description", content: "Change providers centrally — application code stays unchanged." },
    ],
  }),
  component: Routing,
});

function Routing() {
  const fc = useServerFn(getCatalog);
  const up = useServerFn(updateAliasRoute);
  const rb = useServerFn(rollbackAlias);
  const mo = useServerFn(setModelOutage);
  const sim = useServerFn(simulateRoute);
  const fp = useServerFn(listProjects);
  const qc = useQueryClient();
  const can = useCan("manage_models");
  const { data } = useQuery({ queryKey: ["catalog"], queryFn: () => fc() });
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fp() });
  const [alias, setAlias] = useState("qz-code");
  const a = data?.aliases?.find((x: any) => x.alias === alias);
  const [draft, setDraft] = useState<any>(null);
  useEffect(() => {
    if (a) setDraft({ primary_model: a.primary_model, fallback_model: a.fallback_model ?? "", strategy: a.strategy, latency_ms: a.latency_ms, retries: a.retries, note: "" });
  }, [a?.alias, a?.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const models = (data?.models ?? []).filter((m: any) => !["Deprecated", "Disabled"].includes(m.status));
  const mOpt = models.map((m: any) => ({ v: m.id, l: `${data?.providers?.find((p: any) => p.id === m.provider_id)?.name} · ${m.provider_model}` }));
  const model = (id: string) => data?.models?.find((m: any) => m.id === id);
  const prov = (m: any) => data?.providers?.find((p: any) => p.id === m?.provider_id);
  const versions = (data?.versions ?? []).filter((v: any) => v.alias === alias);
  const [s, setS] = useState<any>({ team: "Engineering", project_id: "", environment: "Development", data_class: "INTERNAL", alias: "qz-code", tokens: 2000 });
  const [simRes, setSimRes] = useState<any>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["catalog"] });
  const pm = model(a?.primary_model);
  const fm = model(a?.fallback_model);

  return (
    <div className="space-y-6">
      <PageHeader index="06 · Hero capability" title="Routing Studio" subtitle="Developers call an alias. You decide which approved provider route serves it — and can change it at any time without a key, endpoint or code change." />

      <Panel className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {ALIASES.map((x) => (
            <button key={x} onClick={() => setAlias(x)} className={`rounded-lg px-3 py-1.5 font-mono text-sm font-semibold ${alias === x ? "bg-navy text-navy-foreground" : "bg-muted"}`}>{x}</button>
          ))}
        </div>
        {a && (
          <div className="flex flex-wrap items-center gap-2 overflow-x-auto py-2 text-sm">
            {["Request", "Policy", `Alias ${a.alias} v${a.version}`, `Rule · ${a.strategy}`].map((n, i) => (
              <motion.div key={n} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="flex items-center gap-2">
                <span className="rounded-lg border bg-card px-3 py-2 font-semibold">{n}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </motion.div>
            ))}
            <div className="flex flex-col gap-2">
              <RouteNode label="PRIMARY" m={pm} p={prov(pm)} onOutage={can ? async (on: boolean) => { await mo({ data: { id: pm.id, on } }); toast.success(on ? "Primary marked unhealthy (simulation)" : "Primary restored"); refresh(); } : undefined} />
              {fm && <RouteNode label="FALLBACK" m={fm} p={prov(fm)} />}
            </div>
          </div>
        )}
        {pm?.simulated_outage && (
          <div className="mt-3 rounded-xl bg-warning-soft p-3 text-sm text-warning">
            Primary provider unhealthy → circuit breaker opens → fallback policy & data policy re-checked → fallback selected with the same request ID. <b>NO DEVELOPER CONFIGURATION CHANGE.</b>
          </div>
        )}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel className="p-5">
          <h2 className="mb-3 font-semibold">Change route · {alias}</h2>
          {draft && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Primary route"><Select value={draft.primary_model} onChange={(v) => setDraft({ ...draft, primary_model: v })} options={mOpt} /></Field>
              <Field label="Fallback route"><Select value={draft.fallback_model} onChange={(v) => setDraft({ ...draft, fallback_model: v })} options={[{ v: "", l: "None" }, ...mOpt]} /></Field>
              <Field label="Strategy (admin-configured)"><Select value={draft.strategy} onChange={(v) => setDraft({ ...draft, strategy: v })} options={STRATEGIES} /></Field>
              <Field label="Latency threshold (ms)"><input type="number" className={inputCls} value={draft.latency_ms} onChange={(e) => setDraft({ ...draft, latency_ms: Number(e.target.value) })} /></Field>
              <Field label="Retries before fallback"><input type="number" className={inputCls} value={draft.retries} onChange={(e) => setDraft({ ...draft, retries: Number(e.target.value) })} /></Field>
              <Field label="Change note"><input className={inputCls} value={draft.note} placeholder="Evaluation EV-12 passed" onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></Field>
              <div className="sm:col-span-2">
                <Button
                  disabled={!can}
                  onClick={async () => {
                    try {
                      const r = await up({ data: { alias, ...draft, fallback_model: draft.fallback_model || null, note: draft.note || "Route updated" } });
                      toast.success(`${alias} → v${r.version} approved. Same key, same endpoint, same alias.`);
                      refresh();
                    } catch (e) {
                      toast.error(errMsg(e));
                    }
                  }}
                >
                  Approve route version
                </Button>
                {!can && <span className="ml-2 text-xs text-muted-foreground">Requires AI Platform Admin</span>}
              </div>
            </div>
          )}
        </Panel>
        <Panel className="p-5">
          <h2 className="mb-3 font-semibold">Version history</h2>
          <Table
            head={["Version", "Primary", "Fallback", "Strategy", "Note", "By", "When", ""]}
            rows={versions.map((v: any) => [
              <Badge key="v" tone={v.status === "active" ? "success" : "muted"}>v{v.version}</Badge>,
              <span key="p" className="font-mono text-xs">{model(v.primary_model)?.provider_model}</span>,
              <span key="f" className="font-mono text-xs">{model(v.fallback_model)?.provider_model ?? "—"}</span>,
              v.strategy, v.note, v.created_by, new Date(v.created_at).toLocaleString(),
              v.version !== a?.version && can ? <Button key="r" size="sm" variant="outline" onClick={async () => { await rb({ data: { alias, version: v.version } }); toast.success(`Rolled back to v${v.version}`); refresh(); }}><RotateCcw /> Rollback</Button> : null,
            ])}
          />
        </Panel>
      </div>

      <Panel className="p-5">
        <h2 className="mb-1 font-semibold">Route simulator</h2>
        <p className="mb-4 text-sm text-muted-foreground">Evaluates the live policy stack without calling a provider.</p>
        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
          <Field label="Team"><Select value={s.team} onChange={(v) => setS({ ...s, team: v })} options={TEAMS} /></Field>
          <Field label="Project"><Select value={s.project_id} onChange={(v) => setS({ ...s, project_id: v })} options={[{ v: "", l: "(team-level)" }, ...(projects.data?.all ?? []).map((p: any) => ({ v: p.id, l: p.name }))]} /></Field>
          <Field label="Environment"><Select value={s.environment} onChange={(v) => setS({ ...s, environment: v })} options={ENVIRONMENTS} /></Field>
          <Field label="Classification"><Select value={s.data_class} onChange={(v) => setS({ ...s, data_class: v })} options={CLASSES} /></Field>
          <Field label="Alias"><Select value={s.alias} onChange={(v) => setS({ ...s, alias: v })} options={ALIASES} /></Field>
          <Field label="Est. tokens"><input type="number" className={inputCls} value={s.tokens} onChange={(e) => setS({ ...s, tokens: Number(e.target.value) })} /></Field>
          <div className="flex items-end"><Button className="w-full" onClick={async () => { try { setSimRes(await sim({ data: { ...s, project_id: s.project_id || undefined } })); } catch (e) { toast.error(errMsg(e)); } }}>Test route</Button></div>
        </div>
        {simRes && (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="divide-y rounded-xl border">
              {simRes.checks.map((c: any) => (
                <div key={c.n} className="flex items-center gap-3 px-3 py-2 text-sm">
                  {c.r === "PASS" ? <CheckCircle2 className="h-4 w-4 text-success" /> : c.r === "FAIL" ? <XCircle className="h-4 w-4 text-danger" /> : <AlertTriangle className="h-4 w-4 text-warning" />}
                  <span className="w-28 font-semibold">{c.n}</span>
                  <span className="flex-1 text-xs text-muted-foreground">{c.d}</span>
                  <Badge>{c.r}</Badge>
                </div>
              ))}
            </div>
            <div className="space-y-2 rounded-xl border p-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Result</span><Badge>{simRes.allowed ? "ALLOWED" : "BLOCKED"}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Selected alias</span><span className="font-mono">{simRes.alias} v{simRes.version}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Primary provider</span><span>{simRes.primary?.provider} · {simRes.primary?.model} {simRes.primary && !simRes.primary.healthy && <Badge>OUTAGE</Badge>}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Fallback</span><span>{simRes.fallback ? `${simRes.fallback.provider} · ${simRes.fallback.model}` : "none"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Selected route</span><Badge tone="info">{simRes.selected.toUpperCase()}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Logging</span><span>{simRes.logging}</span></div>
              <div className="rounded-lg bg-muted p-3 text-xs leading-relaxed"><b>Why: </b>{simRes.why}</div>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

function RouteNode({ label, m, p, onOutage }: { label: string; m: any; p: any; onOutage?: (on: boolean) => void }) {
  if (!m) return null;
  const down = m.simulated_outage || p?.simulated_outage || p?.status !== "enabled";
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${down ? "border-danger bg-danger-soft" : "bg-card"}`}>
      <Badge tone={label === "PRIMARY" ? "info" : "muted"}>{label}</Badge>
      <div>
        <div className="text-xs font-semibold">{p?.name}</div>
        <div className="font-mono text-[11px] text-muted-foreground">{m.provider_model}</div>
      </div>
      <span className={`ml-2 h-2 w-2 rounded-full ${down ? "bg-danger" : "bg-success"}`} />
      {onOutage && (
        <button onClick={() => onOutage(!m.simulated_outage)} className="ml-2 rounded-md border px-2 py-1 text-[11px] font-semibold hover:bg-muted">
          {m.simulated_outage ? "Restore health" : "Simulate outage"}
        </button>
      )}
    </div>
  );
}
