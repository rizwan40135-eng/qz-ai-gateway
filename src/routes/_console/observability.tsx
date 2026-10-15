/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { listTraces } from "@/lib/qgate/api.functions";
import { ALIASES, fmtUsd } from "@/lib/qgate/constants";
import { Badge, inputCls, Kpi, PageHeader, Panel, Select, Table } from "@/components/qg/ui";
import { applyFilters, useFilters } from "@/components/qg/filters";

export const Route = createFileRoute("/_console/observability")({
  validateSearch: (s: Record<string, unknown>): { q?: string } => ({ q: typeof s.q === "string" ? s.q : undefined }),
  head: () => ({
    meta: [
      { title: "Observability — Q-GATE AI" },
      { name: "description", content: "Request trace explorer, latency, provider errors, policy blocks and fallback analytics." },
      { property: "og:title", content: "Observability — Q-GATE AI" },
      { property: "og:description", content: "Every request traceable end to end." },
    ],
  }),
  component: Obs,
});

const CAT: Record<string, string> = { invalid_key: "Authentication", key_expired: "Authentication", scope_missing: "Authentication", model_not_allowed: "Entitlement", model_access_approval_required: "Entitlement", environment_not_allowed: "Entitlement", budget_exceeded: "Budget", budget_warning: "Budget", rate_limit_exceeded: "Rate Limit", policy_blocked: "Policy", approval_required: "Policy", data_class_not_allowed: "Policy", provider_unavailable: "Provider 5xx", streaming_error: "Streaming Error" };

function Obs() {
  const search = Route.useSearch();
  const [q, setQ] = useState(search.q ?? "");
  const [status, setStatus] = useState("all");
  const [alias, setAlias] = useState("");
  const [dim, setDim] = useState("alias");
  useEffect(() => setQ(search.q ?? ""), [search.q]);
  const fl = useServerFn(listTraces);
  const { f } = useFilters();
  const { data } = useQuery({ queryKey: ["traces", q, status, alias], queryFn: () => fl({ data: { q, status, alias: alias || undefined } }) });
  const rows = applyFilters(data ?? [], f);
  const ok = rows.filter((r: any) => r.status === 200);
  const lat = rows.map((r: any) => r.latency_ms).sort((a: number, b: number) => a - b);
  const pct = (p: number) => (lat.length ? lat[Math.floor(lat.length * p)] : 0);
  const ttft = ok.length ? Math.round(ok.reduce((s: number, r: any) => s + r.ttft_ms, 0) / ok.length) : 0;
  const errs = rows.filter((r: any) => r.status !== 200);
  const byCat: Record<string, number> = {};
  for (const e of errs) byCat[CAT[e.error_code] ?? "Gateway Error"] = (byCat[CAT[e.error_code] ?? "Gateway Error"] ?? 0) + 1;
  const byDim: Record<string, any> = {};
  for (const e of errs) {
    const k = e[dim === "provider" ? "provider" : dim === "team" ? "team" : dim === "project" ? "project_name" : dim === "environment" ? "environment" : "alias"] ?? "n/a";
    byDim[k] ??= { k, errors: 0 };
    byDim[k].errors++;
  }

  return (
    <div className="space-y-6">
      <PageHeader index="09 · Observe" title="Observability" subtitle="Request Trace Explorer — every hop from key validation to audit." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Kpi label="Requests" value={rows.length} />
        <Kpi label="Success rate" value={`${rows.length ? ((ok.length / rows.length) * 100).toFixed(1) : 0}%`} />
        <Kpi label="P50" value={`${pct(0.5)}ms`} />
        <Kpi label="P95" value={`${pct(0.95)}ms`} />
        <Kpi label="Avg TTFT" value={`${ttft}ms`} />
        <Kpi label="Provider errors" value={errs.filter((e: any) => e.error_code === "provider_unavailable").length} />
        <Kpi label="Policy blocks" value={rows.filter((r: any) => r.policy_result === "BLOCKED").length} tone="ember" />
        <Kpi label="Fallback rate" value={`${rows.length ? ((rows.filter((r: any) => r.fallback).length / rows.length) * 100).toFixed(1) : 0}%`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-5">
          <div className="eyebrow mb-3">Errors by category</div>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={Object.entries(byCat).map(([k, v]) => ({ k, v }))}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="k" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10 }} />
                <Bar dataKey="v" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="eyebrow">Errors by</div>
            <Select className="w-40" value={dim} onChange={setDim} options={["alias", "provider", "team", "project", "environment"]} />
          </div>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={Object.values(byDim)}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="k" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10 }} />
                <Bar dataKey="errors" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
      <Panel className="p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <input className={inputCls + " max-w-sm"} placeholder="Search request ID, user, project" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select className="w-36" value={status} onChange={setStatus} options={[{ v: "all", l: "All statuses" }, { v: "ok", l: "Success" }, { v: "error", l: "Errors" }]} />
          <Select className="w-40" value={alias} onChange={setAlias} options={[{ v: "", l: "All aliases" }, ...ALIASES.map((a) => ({ v: a, l: a }))]} />
        </div>
        <Table
          head={["Timestamp", "Request ID", "User", "Project", "Key", "Alias", "Provider", "Model", "In", "Out", "Est. cost", "Latency", "Status", "Policy", "Fallback"]}
          rows={rows.slice(0, 200).map((r: any) => [
            new Date(r.created_at).toLocaleString(),
            <Link key="i" to="/trace/$id" params={{ id: r.id }} className="font-mono text-xs text-primary">{r.id}</Link>,
            r.user_name, r.project_name, <span key="k" className="font-mono text-[11px]">{r.key_prefix}</span>,
            <span key="a" className="font-mono text-xs">{r.alias}</span>, r.provider ?? "—", <span key="m" className="font-mono text-[11px]">{r.model ?? "—"}</span>,
            r.input_tokens, r.output_tokens, fmtUsd(r.cost, 5), `${r.latency_ms}ms`,
            <Badge key="s">{r.status === 200 ? "200" : `${r.status} ${r.error_code ?? ""}`}</Badge>,
            <Badge key="p">{r.policy_result}{r.policy_id ? ` · ${r.policy_id}` : ""}</Badge>,
            r.fallback ? <Badge key="f" tone="warning">YES</Badge> : "—",
          ])}
        />
      </Panel>
    </div>
  );
}
