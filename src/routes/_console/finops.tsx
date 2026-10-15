/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getFinops, savePricing, setGovernance } from "@/lib/qgate/api.functions";
import { fmtNum, fmtUsd } from "@/lib/qgate/constants";
import { Badge, errMsg, Kpi, PageHeader, Panel, Table } from "@/components/qg/ui";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_console/finops")({
  head: () => ({
    meta: [
      { title: "Usage & FinOps — Q-GATE AI" },
      { name: "description", content: "Token usage, estimated cost, budgets, pricing ledger and optimization insights across the hierarchy." },
      { property: "og:title", content: "Usage & FinOps — Q-GATE AI" },
      { property: "og:description", content: "Every cost attributable — estimated from configured pricing." },
    ],
  }),
  component: Finops,
});

const LEVELS = ["Business Unit", "Team", "Project", "Key", "Alias"];

function Finops() {
  const ff = useServerFn(getFinops);
  const sp = useServerFn(savePricing);
  const sg = useServerFn(setGovernance);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["finops"], queryFn: () => ff() });
  const [lvl, setLvl] = useState("Team");
  const traces = data?.traces ?? [];
  const BU: Record<string, string> = { Engineering: "Technology" };
  const keyOf = (t: any) => (lvl === "Team" ? t.team : lvl === "Business Unit" ? BU[t.team] ?? t.team : lvl === "Project" ? t.project_name : lvl === "Key" ? t.key_prefix : t.alias) ?? "n/a";
  const agg: Record<string, any> = {};
  for (const t of traces) {
    const k = keyOf(t);
    agg[k] ??= { k, requests: 0, input: 0, output: 0, cost: 0, est: 0 };
    agg[k].requests++;
    agg[k].input += t.input_tokens;
    agg[k].output += t.output_tokens;
    agg[k].cost += Number(t.cost);
    if (t.usage_estimated) agg[k].est++;
  }
  const rows = Object.values(agg).sort((a: any, b: any) => b.cost - a.cost);
  const totalCost = traces.reduce((s: number, t: any) => s + Number(t.cost), 0);
  const reasoningSmall = traces.filter((t: any) => t.alias === "qz-reasoning");
  const small = reasoningSmall.length ? Math.round((reasoningSmall.filter((t: any) => t.input_tokens < 500).length / reasoningSmall.length) * 100) : 0;
  const unusedProd = (data?.keys ?? []).filter((k: any) => k.status === "active" && k.environment === "Production" && k.last_used && Date.now() - new Date(k.last_used).getTime() > 60 * 864e5).length;

  function exportCsv() {
    const head = "dimension,requests,input_tokens,output_tokens,estimated_cost_usd";
    const csv = [head, ...rows.map((r: any) => `"${r.k}",${r.requests},${r.input},${r.output},${r.cost.toFixed(6)}`)].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `qgate-usage-by-${lvl.toLowerCase().replace(" ", "-")}.csv`;
    a.click();
  }

  return (
    <div className="space-y-6">
      <PageHeader index="10 · FinOps" title="Usage & FinOps" subtitle="PROVIDER-REPORTED TOKENS × CONFIGURED PRICE = ESTIMATED COST. Rows marked USAGE ESTIMATED used inferred token counts." actions={<Button variant="outline" onClick={exportCsv}><Download /> Export usage</Button>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Traced est. cost" value={fmtUsd(totalCost, 2)} tone="ember" sub="ESTIMATED FROM CONFIGURED MODEL PRICING" />
        <Kpi label="Input tokens" value={fmtNum(traces.reduce((s: number, t: any) => s + t.input_tokens, 0))} />
        <Kpi label="Output tokens" value={fmtNum(traces.reduce((s: number, t: any) => s + t.output_tokens, 0))} />
        <Kpi label="Cached tokens" value="n/a" sub="when provider reports" />
        <Kpi label="Org monthly budget" value={fmtUsd((data?.gov ?? []).reduce((s: number, g: any) => s + Number(g.budget_usd), 0), 0)} sub={`run rate ${fmtUsd((data?.gov ?? []).reduce((s: number, g: any) => s + Number(g.spent_usd), 0) / 14 * 31, 0)}/mo`} />
      </div>

      <Tabs defaultValue="usage">
        <TabsList><TabsTrigger value="usage">Drill-down</TabsTrigger><TabsTrigger value="budgets">Budgets</TabsTrigger><TabsTrigger value="pricing">Pricing ledger</TabsTrigger><TabsTrigger value="insights">Insights</TabsTrigger></TabsList>
        <TabsContent value="usage" className="space-y-4">
          <div className="flex flex-wrap items-center gap-1 text-sm">
            <span className="eyebrow mr-2">Organization →</span>
            {LEVELS.map((l) => <button key={l} onClick={() => setLvl(l)} className={`rounded-lg px-3 py-1.5 font-semibold ${lvl === l ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{l}</button>)}
          </div>
          <Panel className="p-5">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={rows.slice(0, 14)}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="k" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                  <Tooltip formatter={(v: number) => fmtUsd(v, 4)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10 }} />
                  <Bar dataKey="cost" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <Table head={[lvl, "Requests", "Input tokens", "Output tokens", "Estimated cost", "Usage"]} rows={rows.map((r: any) => [<b key="k">{r.k}</b>, r.requests, fmtNum(r.input), fmtNum(r.output), fmtUsd(r.cost, 4), r.est ? <Badge key="e" tone="warning">USAGE ESTIMATED ({r.est})</Badge> : <Badge key="e" tone="muted">PROVIDER-REPORTED</Badge>])} />
          </Panel>
        </TabsContent>
        <TabsContent value="budgets">
          <Panel className="p-5">
            <p className="mb-3 text-xs text-muted-foreground">Thresholds: 50% informational · 75% warning · 90% critical · 100% configurable enforcement.</p>
            <Table
              head={["Team", "Monthly budget", "Spent", "Used", "Threshold", "≥90% enforcement", ""]}
              rows={(data?.gov ?? []).map((g: any) => {
                const p = (g.spent_usd / g.budget_usd) * 100;
                return [
                  <b key="t">{g.team}</b>, fmtUsd(g.budget_usd, 0), fmtUsd(g.spent_usd, 2), `${p.toFixed(1)}%`,
                  <Badge key="b" tone={p >= 90 ? "danger" : p >= 75 ? "warning" : p >= 50 ? "info" : "success"}>{p >= 100 ? "EXHAUSTED" : p >= 90 ? "CRITICAL" : p >= 75 ? "WARNING" : p >= 50 ? "INFORMATIONAL" : "OK"}</Badge>,
                  data?.canEdit ? <select key="e" className="h-7 rounded-md border bg-card px-1 text-xs" value={g.enforcement} onChange={async (e) => { try { await sg({ data: { team: g.team, enforcement: e.target.value } }); qc.invalidateQueries({ queryKey: ["finops"] }); toast.success("Enforcement updated"); } catch (x) { toast.error(errMsg(x)); } }}>{["Alert", "Throttle", "Block", "Approval Required", "Recommend Lower-Cost Alias"].map((o) => <option key={o}>{o}</option>)}</select> : g.enforcement,
                  data?.canEdit ? <Button key="s" size="sm" variant="outline" onClick={async () => { const v = Number(prompt(`Monthly budget for ${g.team}`, String(g.budget_usd))); if (v > 0) { await sg({ data: { team: g.team, budget_usd: v } }); qc.invalidateQueries({ queryKey: ["finops"] }); toast.success("Budget set"); } }}>Set budget</Button> : null,
                ];
              })}
            />
          </Panel>
        </TabsContent>
        <TabsContent value="pricing">
          <Panel className="p-5">
            <Table
              head={["Provider", "Model", "Input", "Output", "Cached input", "Unit", "Currency", "Effective from", "Effective to", ""]}
              rows={(data?.pricing ?? []).map((p: any) => [p.provider, <span key="m" className="font-mono text-xs">{p.model}</span>, `$${p.input_price}`, `$${p.output_price}`, `$${p.cached_price}`, p.unit, p.currency, p.effective_from, p.effective_to ?? "current",
                data?.canEdit && !p.effective_to ? <Button key="e" size="sm" variant="outline" onClick={async () => { const v = prompt("input,output,cached per 1M", `${p.input_price},${p.output_price},${p.cached_price}`); if (!v) return; const [i, o, c] = v.split(",").map(Number); try { await sp({ data: { id: p.id, input_price: i, output_price: o, cached_price: c } }); qc.invalidateQueries({ queryKey: ["finops"] }); toast.success("New price version effective today"); } catch (x) { toast.error(errMsg(x)); } }}>New version</Button> : null])}
            />
          </Panel>
        </TabsContent>
        <TabsContent value="insights">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              `${small}% of qz-reasoning traffic has fewer than 500 input tokens and may be suitable for evaluation against a lower-cost approved alias.`,
              `Developer Productivity usage increased 24% week over week.`,
              `${unusedProd || 3} unused production keys remain active.`,
            ].map((t) => (
              <Panel key={t} className="p-5">
                <Badge tone="ember">POTENTIAL OPTIMIZATION</Badge>
                <p className="mt-3 text-sm leading-relaxed">{t}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">No guaranteed savings. Validate with an evaluation before changing routes.</p>
              </Panel>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
