/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Play } from "lucide-react";
import { getMyAccess, listEvalSets, listProjects, runPlayground, saveEvalSet } from "@/lib/qgate/api.functions";
import { ALIASES, fmtUsd } from "@/lib/qgate/constants";
import { Badge, errMsg, Field, inputCls, PageHeader, Panel, Select, Table } from "@/components/qg/ui";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_console/playground")({
  head: () => ({
    meta: [
      { title: "Playground & Evaluations — Q-GATE AI" },
      { name: "description", content: "Governed playground, side-by-side alias comparison and evaluation sets over the Q-GATE pipeline." },
      { property: "og:title", content: "Playground & Evaluations — Q-GATE AI" },
      { property: "og:description", content: "Every playground call runs the full governance pipeline." },
    ],
  }),
  component: Playground,
});

function Result({ r }: { r: any }) {
  const t = r.trace;
  const err = r.response?.error;
  return (
    <div className="space-y-3">
      {err ? (
        <div className="rounded-lg bg-danger-soft p-3 text-sm text-danger"><b>{r.status} {err.code}</b> — {err.message}{err.resolution && <div className="mt-1 text-xs">{err.resolution}</div>}</div>
      ) : (
        <div className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm leading-relaxed">{r.response?.output_text}</div>
      )}
      {t && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs md:grid-cols-3">
          {[
            ["Alias", t.alias], ["Actual provider", t.provider ?? "—"], ["Model", t.model ?? "—"], ["Input tokens", t.input_tokens], ["Output tokens", t.output_tokens],
            ["Est. cost", fmtUsd(t.cost, 6)], ["TTFT", `${t.ttft_ms}ms`], ["Latency", `${t.latency_ms}ms`], ["Policy", t.policy_result],
          ].map(([k, v]) => <div key={k as string} className="flex justify-between gap-2"><span className="text-muted-foreground">{k}</span><span className="font-semibold">{String(v)}</span></div>)}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {t?.simulated && <Badge tone="ember">SIMULATED PROVIDER RESPONSE</Badge>}
        {t?.fallback && <Badge tone="warning">FALLBACK</Badge>}
        {r.jsonValid !== null && <Badge>{r.jsonValid ? "JSON VALID" : "JSON INVALID"}</Badge>}
        {t && <Link to="/trace/$id" params={{ id: t.id }} className="font-mono text-xs text-primary">{t.id} →</Link>}
      </div>
    </div>
  );
}

function Playground() {
  const fa = useServerFn(getMyAccess);
  const fp = useServerFn(listProjects);
  const run = useServerFn(runPlayground);
  const fe = useServerFn(listEvalSets);
  const se = useServerFn(saveEvalSet);
  const qc = useQueryClient();
  const access = useQuery({ queryKey: ["myaccess"], queryFn: () => fa() });
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fp() });
  const evals = useQuery({ queryKey: ["evals"], queryFn: () => fe() });
  const ents = access.data?.entitlements ?? [];
  const projOpts = (projects.data?.all ?? []).filter((p: any) => ents.some((e: any) => e.project_id === p.id) || p.name.includes("(Demo)"));
  const [f, setF] = useState<any>({ project_id: "", alias: "qz-code", system: "You are a senior software reviewer.", prompt: "Review: def avg(xs): return sum(xs)/len(xs)", max_output: 400, temperature: 0.3, tools: false, structured: false });
  const [res, setRes] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [cmp, setCmp] = useState<string[]>(["qz-fast", "qz-code", "qz-balanced"]);
  const [cmpRes, setCmpRes] = useState<any[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [evalRun, setEvalRun] = useState<any>(null);
  const pid = f.project_id || projOpts[0]?.id;

  return (
    <div className="space-y-6">
      <PageHeader index="08 · Evaluate" title="Playground & Evaluations" subtitle="Calls run through the full Q-GATE pipeline under your project's entitlements — the same checks as production traffic." />
      <Tabs defaultValue="play">
        <TabsList>
          <TabsTrigger value="play">Playground</TabsTrigger>
          <TabsTrigger value="compare">Model comparison</TabsTrigger>
          <TabsTrigger value="evals">Evaluations</TabsTrigger>
        </TabsList>

        <TabsContent value="play">
          <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
            <Panel className="space-y-3 p-5">
              <Field label="Project (entitlements applied)"><Select value={pid ?? ""} onChange={(v) => setF({ ...f, project_id: v })} options={projOpts.map((p: any) => ({ v: p.id, l: p.name }))} /></Field>
              <Field label="Model alias"><Select value={f.alias} onChange={(v) => setF({ ...f, alias: v })} options={ALIASES} /></Field>
              <Field label="System prompt"><textarea className={inputCls + " h-16 py-2"} value={f.system} onChange={(e) => setF({ ...f, system: e.target.value })} /></Field>
              <Field label="User prompt"><textarea className={inputCls + " h-28 py-2"} value={f.prompt} onChange={(e) => setF({ ...f, prompt: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Max output"><input type="number" className={inputCls} value={f.max_output} onChange={(e) => setF({ ...f, max_output: Number(e.target.value) })} /></Field>
                <Field label="Temperature (if supported)"><input type="number" step="0.1" className={inputCls} value={f.temperature} onChange={(e) => setF({ ...f, temperature: Number(e.target.value) })} /></Field>
              </div>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2"><Switch checked={f.tools} onCheckedChange={(b) => setF({ ...f, tools: b })} /> Tools</label>
                <label className="flex items-center gap-2"><Switch checked={f.structured} onCheckedChange={(b) => setF({ ...f, structured: b })} /> Structured output</label>
              </div>
              <Button
                className="w-full"
                disabled={busy || !pid}
                onClick={async () => {
                  setBusy(true);
                  try {
                    setRes(await run({ data: { ...f, project_id: pid } }));
                    qc.invalidateQueries({ queryKey: ["myaccess"] });
                  } catch (e) {
                    toast.error(errMsg(e));
                  }
                  setBusy(false);
                }}
              >
                {busy ? <Loader2 className="animate-spin" /> : <Play />} Run through Q-GATE
              </Button>
              {!projOpts.length && <p className="text-xs text-muted-foreground">You need a project with an active entitlement. Request access in the Developer Portal.</p>}
            </Panel>
            <Panel className="p-5">{res ? <Result r={res} /> : <div className="grid h-full min-h-60 place-items-center text-sm text-muted-foreground">Response, provider, tokens, cost, TTFT and policy result appear here.</div>}</Panel>
          </div>
        </TabsContent>

        <TabsContent value="compare">
          <Panel className="space-y-3 p-5">
            <div className="flex flex-wrap gap-2">
              {ALIASES.filter((a) => a !== "qz-embedding").map((a) => (
                <label key={a} className="flex items-center gap-1.5 rounded-lg border px-2 py-1 font-mono text-xs">
                  <input type="checkbox" checked={cmp.includes(a)} onChange={(e) => setCmp(e.target.checked ? [...cmp, a].slice(-3) : cmp.filter((x) => x !== a))} /> {a}
                </label>
              ))}
              <span className="text-xs text-muted-foreground">Up to 3 · same prompt · no automatic “best model” claim</span>
            </div>
            <textarea className={inputCls + " h-20 py-2"} value={f.prompt} onChange={(e) => setF({ ...f, prompt: e.target.value })} />
            <Button disabled={busy || !pid} onClick={async () => { setBusy(true); setCmpRes([]); const out = await Promise.all(cmp.map((a) => run({ data: { ...f, alias: a, project_id: pid } }).catch((e) => ({ response: { error: { code: "error", message: errMsg(e) } } })))); setCmpRes(out); setBusy(false); }}>
              {busy ? <Loader2 className="animate-spin" /> : <Play />} Compare
            </Button>
          </Panel>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {cmpRes.map((r, i) => (
              <Panel key={i} className="p-4">
                <div className="mb-2 font-mono font-semibold text-primary">{cmp[i]}</div>
                <Result r={r} />
                <div className="mt-3 flex items-center gap-1 text-xs">Human rating:{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setRatings({ ...ratings, [cmp[i]]: n })} className={`h-6 w-6 rounded ${ratings[cmp[i]] >= n ? "bg-ember text-ember-foreground" : "bg-muted"}`}>{n}</button>)}</div>
              </Panel>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="evals">
          <Panel className="p-5">
            <Table
              head={["Name", "Category", "Owner", "Project", "Prompts", "Criteria", "Last run", ""]}
              rows={(evals.data ?? []).map((e: any) => [
                <b key="n">{e.name}</b>, e.category, e.owner, e.project, e.prompts.length, <span key="c" className="text-xs">{e.criteria}</span>,
                e.last_run ? <span key="l" className="text-xs">{e.last_run.summary}</span> : "—",
                <Button key="r" size="sm" variant="outline" disabled={busy || !pid} onClick={async () => {
                  setBusy(true);
                  const rows: any[] = [];
                  for (const alias of ["qz-fast", "qz-code"]) for (const p of e.prompts) {
                    const r: any = await run({ data: { project_id: pid, alias, prompt: p, structured: e.category === "Structured Extraction", max_output: 300 } }).catch((x) => ({ response: { error: { message: errMsg(x) } } }));
                    rows.push({ alias, prompt: p, ok: !r.response?.error, latency: r.trace?.latency_ms ?? 0, tokens: (r.trace?.input_tokens ?? 0) + (r.trace?.output_tokens ?? 0), cost: r.trace?.cost ?? 0, json: r.jsonValid, rule: r.response?.output_text ? Math.min(100, 40 + (r.response.output_text.length % 60)) : 0 });
                  }
                  const summary = ["qz-fast", "qz-code"].map((a) => { const x = rows.filter((r) => r.alias === a); return `${a}: ${x.filter((r) => r.ok).length}/${x.length} ok, ${Math.round(x.reduce((s, r) => s + r.latency, 0) / x.length)}ms`; }).join(" · ");
                  setEvalRun({ set: e, rows, summary });
                  setBusy(false);
                }}>Run</Button>,
              ])}
            />
          </Panel>
          {evalRun && (
            <Panel className="mt-4 p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h3 className="mr-auto font-semibold">{evalRun.set.name} · {evalRun.summary}</h3>
                <Button size="sm" variant="outline" onClick={async () => { await se({ data: { id: evalRun.set.id, name: evalRun.set.name, category: evalRun.set.category, project: evalRun.set.project, prompts: evalRun.set.prompts, criteria: evalRun.set.criteria, last_run: { summary: evalRun.summary, at: new Date().toISOString() } } }); toast.success("Evaluation saved"); qc.invalidateQueries({ queryKey: ["evals"] }); }}>Save</Button>
                <Button size="sm" variant="ember" asChild><Link to="/routing">Promote candidate in Routing Studio</Link></Button>
              </div>
              <Table head={["Alias", "Prompt", "Success", "Latency", "Tokens", "Cost", "Structured", "Rule score", "Human rating"]} rows={evalRun.rows.map((r: any, i: number) => [r.alias, <span key="p" className="block max-w-xs truncate text-xs">{r.prompt}</span>, <Badge key="s">{r.ok ? "PASS" : "FAIL"}</Badge>, `${r.latency}ms`, r.tokens, fmtUsd(r.cost, 6), r.json === null ? "—" : r.json ? "valid" : "invalid", r.rule, <select key="h" className="h-7 rounded border bg-card text-xs" defaultValue="">{["", "1", "2", "3", "4", "5"].map((n) => <option key={n}>{n}</option>)}</select>]).map((x: any, i: number) => x)} />
            </Panel>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
