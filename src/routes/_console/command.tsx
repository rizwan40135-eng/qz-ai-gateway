/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getOverview } from "@/lib/qgate/api.functions";
import { Badge, Kpi, PageHeader, Panel } from "@/components/qg/ui";
import { applyFilters, useFilters } from "@/components/qg/filters";
import { fmtNum, fmtUsd } from "@/lib/qgate/constants";

export const Route = createFileRoute("/_console/command")({
  head: () => ({
    meta: [
      { title: "AI Command Center — Q-GATE AI" },
      { name: "description", content: "Executive control tower for governed enterprise AI traffic, spend, routing and policy health." },
      { property: "og:title", content: "AI Command Center — Q-GATE AI" },
      { property: "og:description", content: "Gateway, provider, routing, budget and policy health in one view." },
    ],
  }),
  component: Command,
});

function Command() {
  const fetchOv = useServerFn(getOverview);
  const { data } = useQuery({ queryKey: ["overview"], queryFn: () => fetchOv() });
  const { f } = useFilters();
  const nav = useNavigate();
  const traces = applyFilters(data?.traces ?? [], f);
  const ok = traces.filter((t: any) => t.status === 200).length;
  const errRate = traces.length ? ((traces.length - ok) / traces.length) * 100 : 0;
  const fbRate = traces.length ? (traces.filter((t: any) => t.fallback).length / traces.length) * 100 : 0;
  const lat = traces.map((t: any) => t.latency_ms).sort((a: number, b: number) => a - b);
  const p95 = lat.length ? lat[Math.floor(lat.length * 0.95)] : 0;

  const byHour: Record<string, any> = {};
  for (const t of traces) {
    const h = new Date(t.created_at).toISOString().slice(5, 13).replace("T", " ") + "h";
    byHour[h] ??= { h, requests: 0, tokens: 0 };
    byHour[h].requests++;
    byHour[h].tokens += t.input_tokens + t.output_tokens;
  }
  const series = Object.values(byHour).reverse().slice(-48);
  const byTeam: Record<string, number> = {};
  for (const t of traces) byTeam[t.team] = (byTeam[t.team] ?? 0) + t.input_tokens + t.output_tokens;
  const teams = Object.entries(byTeam).map(([team, tokens]) => ({ team, tokens })).sort((a, b) => b.tokens - a.tokens);

  const gov = data?.gov ?? [];
  const over80 = gov.filter((g: any) => g.spent_usd / g.budget_usd >= 0.8).length;
  const outages = (data?.providers ?? []).filter((p: any) => p.simulated_outage || p.status !== "enabled").length;

  const health = [
    { l: "Gateway Health", v: `${(100 - errRate).toFixed(1)}%`, s: errRate < 3 ? "HEALTHY" : "DEGRADED" },
    { l: "Provider Health", v: `${(data?.providers?.length ?? 0) - outages}/${data?.providers?.length ?? 0} up`, s: outages ? "WARNING" : "HEALTHY" },
    { l: "Routing Health", v: `${data?.aliases?.length ?? 0} aliases`, s: fbRate > 5 ? "WARNING" : "HEALTHY" },
    { l: "Budget Health", v: `${over80} teams ≥80%`, s: over80 ? "WARNING" : "HEALTHY" },
    { l: "Policy Health", v: `${traces.filter((t: any) => t.policy_result === "BLOCKED").length} blocks`, s: "HEALTHY" },
    { l: "Error Rate", v: `${errRate.toFixed(2)}%`, s: errRate < 3 ? "HEALTHY" : "WARNING" },
    { l: "Fallback Rate", v: `${fbRate.toFixed(2)}%`, s: fbRate < 5 ? "HEALTHY" : "WARNING" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader index="01 · Control tower" title="AI Command Center" subtitle="Nova Enterprise · every governed AI request across business units, providers and aliases." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Kpi label="Tokens Today" value="24.8M" sub={`${fmtNum(traces.reduce((s: number, t: any) => s + t.input_tokens + t.output_tokens, 0))} in view`} />
        <Kpi label="MTD Est. Spend" value="$18.4K" tone="ember" sub="ESTIMATED FROM CONFIGURED MODEL PRICING" />
        <Kpi label="API Requests" value="1.42M" sub={`${traces.length} traced in view`} />
        <Kpi label="Success Rate" value="99.3%" sub={`${(100 - errRate).toFixed(1)}% in view`} />
        <Kpi label="P95 Latency" value="1.8s" sub={`${(p95 / 1000).toFixed(2)}s in view`} />
        <Kpi label="Active Keys" value={String(data?.activeKeys ?? 184)} sub="Q-GATE virtual keys" />
        <Kpi label="Approved Routes" value="26" sub="alias × provider routes" />
        <Kpi label="Policy Review" value={String(data?.pending ? 7 : 7)} tone="ember" sub={`${data?.pending ?? 0} approvals pending`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Panel className="relative overflow-hidden p-6 xl:col-span-2">
          <div className="eyebrow">Executive brief</div>
          <div className="mt-3 space-y-3 text-[15px] leading-relaxed">
            <p><b>Developer Productivity</b> represents <b className="text-primary">31%</b> of today's AI traffic.</p>
            <p>Three production requests were blocked by <b>Restricted-data controls</b>.</p>
            <p><b>qz-code</b> failed over twice after its primary route crossed the configured latency/error threshold.</p>
            <p>Two teams are projected to exceed <b className="text-ember">80%</b> of their monthly budget.</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge tone="muted">Spend: ESTIMATED FROM CONFIGURED MODEL PRICING</Badge>
          </div>
        </Panel>
        <Panel className="p-5 xl:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="eyebrow">Live topology · click a node</div>
            <Badge tone="success">● streaming</Badge>
          </div>
          <Topology onNav={(to) => nav({ to })} />
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {health.map((h) => (
          <Panel key={h.l} className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">{h.l}</span>
              <span className={`h-2 w-2 rounded-full ${h.s === "HEALTHY" ? "bg-success" : "bg-warning"}`} />
            </div>
            <div className="num mt-1.5 text-lg font-semibold">{h.v}</div>
          </Panel>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="p-5 lg:col-span-2">
          <div className="eyebrow mb-3">Request volume (traced)</div>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="var(--chart-1)" stopOpacity={0.3} />
                    <stop offset="1" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="h" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} interval={7} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10 }} />
                <Area dataKey="requests" stroke="var(--chart-1)" fill="url(#g1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel className="p-5">
          <div className="eyebrow mb-3">Tokens by team</div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={teams} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="team" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={90} />
                <Tooltip formatter={(v: number) => fmtNum(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10 }} />
                <Bar dataKey="tokens" fill="var(--chart-2)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel className="p-5">
        <div className="eyebrow mb-3">Team budgets</div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {gov.map((g: any) => {
            const pct = (g.spent_usd / g.budget_usd) * 100;
            return (
              <div key={g.team} className="rounded-xl border p-3">
                <div className="flex justify-between text-sm font-semibold">
                  {g.team}
                  <span className={pct >= 90 ? "text-danger" : pct >= 75 ? "text-warning" : "text-muted-foreground"}>{pct.toFixed(0)}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${pct >= 90 ? "bg-danger" : pct >= 75 ? "bg-warning" : "bg-primary"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <div className="mt-1.5 text-[11px] text-muted-foreground">{fmtUsd(g.spent_usd, 0)} of {fmtUsd(g.budget_usd, 0)} · {g.enforcement} at ≥90%</div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function Topology({ onNav }: { onNav: (to: string) => void }) {
  const sources = [
    { l: "Developers", to: "/developer", v: 38 },
    { l: "Internal Apps", to: "/admin", v: 24 },
    { l: "AI Agents", to: "/keys", v: 18 },
    { l: "Coding Tools", to: "/integration", v: 14 },
    { l: "Notebooks", to: "/playground", v: 6 },
  ];
  const routes = [
    { l: "qz-fast → gemini-3.1-flash-lite", to: "/routing" },
    { l: "qz-code → gemini-3-flash", to: "/routing" },
    { l: "qz-reasoning → gemini-3.1-pro", to: "/routing" },
    { l: "qz-balanced → gpt-5.6-terra", to: "/routing" },
    { l: "Restricted → Azure EU", to: "/catalog" },
  ];
  const W = 640, H = 250;
  const sy = (i: number) => 25 + i * 50;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
      {sources.map((s, i) => (
        <path key={s.l} d={`M130 ${sy(i)} C 220 ${sy(i)}, 230 125, 280 125`} fill="none" stroke="var(--chart-1)" strokeOpacity={0.5} strokeWidth={1 + s.v / 10} className="flow-line" />
      ))}
      {routes.map((r, i) => (
        <path key={r.l} d={`M360 125 C 410 125, 420 ${sy(i)}, 470 ${sy(i)}`} fill="none" stroke={i === 4 ? "var(--chart-2)" : "var(--chart-1)"} strokeOpacity={0.5} strokeWidth={2} className="flow-line" />
      ))}
      {sources.map((s, i) => (
        <g key={s.l} onClick={() => onNav(s.to)} className="cursor-pointer">
          <rect x={4} y={sy(i) - 15} width={126} height={30} rx={9} fill="var(--card)" stroke="var(--border)" />
          <text x={16} y={sy(i) + 4} fontSize={11} fill="var(--foreground)" fontWeight={600}>{s.l}</text>
          <text x={122} y={sy(i) + 4} fontSize={10} fill="var(--muted-foreground)" textAnchor="end">{s.v}%</text>
        </g>
      ))}
      <motion.g onClick={() => onNav("/routing")} className="cursor-pointer" initial={{ scale: 0.95 }} animate={{ scale: [0.97, 1, 0.97] }} transition={{ repeat: Infinity, duration: 3 }} style={{ transformOrigin: "320px 125px" }}>
        <rect x={280} y={88} width={80} height={74} rx={16} fill="var(--navy)" />
        <text x={320} y={122} fontSize={14} fill="var(--navy-foreground)" fontWeight={700} textAnchor="middle">Q-GATE</text>
        <text x={320} y={140} fontSize={9} fill="var(--ember)" textAnchor="middle">policy · route</text>
      </motion.g>
      {routes.map((r, i) => (
        <g key={r.l} onClick={() => onNav(r.to)} className="cursor-pointer">
          <rect x={470} y={sy(i) - 15} width={166} height={30} rx={9} fill="var(--card)" stroke={i === 4 ? "var(--ember)" : "var(--border)"} />
          <text x={480} y={sy(i) + 4} fontSize={10} fill="var(--foreground)" fontWeight={600}>{r.l}</text>
        </g>
      ))}
    </svg>
  );
}
