/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  Activity, Bell, BookOpen, CheckSquare, ChevronDown, Code2, Coins, FlaskConical, Gauge, GitBranch, KeyRound, Layers, Menu, Moon,
  PlayCircle, Radar, ScrollText, Search, Settings, ShieldCheck, Siren, Sun, Users, Wrench, X,
} from "lucide-react";
import { getMe, getOverview } from "@/lib/qgate/api.functions";
import { MeContext, type Me } from "@/components/qg/ui";
import { defaultFilters, FiltersContext, type Filters } from "@/components/qg/filters";
import { AskPanel } from "@/components/qg/AskPanel";
import { ALIASES, BUSINESS_UNITS, ENVIRONMENTS, ROLES, TEAMS } from "@/lib/qgate/constants";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_console")({ component: ConsoleLayout });

const NAV = [
  { n: "01", to: "/command", l: "AI Command Center", i: Gauge },
  { n: "02", to: "/developer", l: "Developer Portal", i: Code2 },
  { n: "03", to: "/catalog", l: "Model Catalog", i: Layers },
  { n: "04", to: "/access", l: "Access & Entitlements", i: Users },
  { n: "05", to: "/keys", l: "Gateway Keys", i: KeyRound },
  { n: "06", to: "/routing", l: "Routing Studio", i: GitBranch },
  { n: "07", to: "/policies", l: "Policies & Guardrails", i: ShieldCheck },
  { n: "08", to: "/playground", l: "Playground & Evaluations", i: FlaskConical },
  { n: "09", to: "/observability", l: "Observability", i: Activity },
  { n: "10", to: "/finops", l: "Usage & FinOps", i: Coins },
  { n: "11", to: "/admin", l: "Administration", i: Wrench },
] as const;
const SECONDARY = [
  { to: "/explorer", l: "Requests", i: Search },
  { to: "/approvals", l: "Approvals", i: CheckSquare },
  { to: "/alerts", l: "Alerts", i: Siren },
  { to: "/audit", l: "Audit Trail", i: ScrollText },
  { to: "/docs", l: "Documentation", i: BookOpen },
  { to: "/settings", l: "Settings", i: Settings },
] as const;

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="relative grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <span className="font-display text-sm font-bold">Q</span>
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-ember" />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-[15px] font-semibold">Q-GATE AI</span>
        <span className="block text-[10px] text-muted-foreground">Powered by Quantzig</span>
      </span>
    </Link>
  );
}

function ConsoleLayout() {
  const fetchMe = useServerFn(getMe);
  const fetchOv = useServerFn(getOverview);
  const me = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const ov = useQuery({ queryKey: ["overview"], queryFn: () => fetchOv(), enabled: !!me.data?.user });
  const [f, setF] = useState<Filters>(defaultFilters);
  const [ask, setAsk] = useState(false);
  const [dark, setDark] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [q, setQ] = useState("");
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const d = localStorage.getItem("qg-dark") === "1";
    setDark(d);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("qg-dark", dark ? "1" : "0");
  }, [dark]);
  useEffect(() => setMobile(false), [path]);

  if (me.isLoading) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Verifying identity…</div>;
  if (!me.data?.user)
    return (
      <div className="hero-surface grid min-h-screen place-items-center p-6">
        <div className="panel max-w-md p-8 text-center">
          <Logo />
          <h1 className="mt-6 text-xl font-semibold">Sign in required</h1>
          <p className="mt-2 text-sm text-muted-foreground">Q-GATE uses your Lovable workspace identity. Sign in to Lovable in this browser, then reload this page.</p>
          <p className="mt-3 text-xs text-muted-foreground">{me.data?.error}</p>
        </div>
      </div>
    );

  const meVal = me.data as Me;
  const sel = "h-8 rounded-md border bg-card px-2 text-xs font-medium outline-none";

  const sidebar = (
    <aside className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo />
        <button className="lg:hidden" onClick={() => setMobile(false)} aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {NAV.map((n) => {
          const active = path.startsWith(n.to);
          return (
            <Link key={n.to} to={n.to} className={cn("group flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium transition", active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60")}>
              <span className={cn("w-5 font-mono text-[10px]", active ? "text-ember" : "text-muted-foreground")}>{n.n}</span>
              <n.i className="h-4 w-4 opacity-80" />
              {n.l}
            </Link>
          );
        })}
        <div className="eyebrow px-2.5 pb-1 pt-5">Operate</div>
        {SECONDARY.map((n) => (
          <Link key={n.to} to={n.to} className={cn("flex items-center gap-3 rounded-lg px-2.5 py-1.5 text-[13px] transition", path.startsWith(n.to) ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60")}>
            <n.i className="ml-8 h-3.5 w-3.5 opacity-70" />
            {n.l}
            {n.to === "/approvals" && !!ov.data?.pending && <span className="ml-auto rounded-full bg-ember px-1.5 text-[10px] font-bold text-ember-foreground">{ov.data.pending}</span>}
          </Link>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <Link to="/demo" className="flex items-center justify-center gap-2 rounded-lg bg-navy px-3 py-2.5 text-sm font-semibold text-navy-foreground transition hover:opacity-90">
          <PlayCircle className="h-4 w-4 text-ember" /> Run Live Demo
        </Link>
      </div>
    </aside>
  );

  return (
    <MeContext.Provider value={meVal}>
      <FiltersContext.Provider value={{ f, set: (p) => setF((o) => ({ ...o, ...p })) }}>
        <div className="flex min-h-screen bg-background">
          <div className="sticky top-0 hidden h-screen lg:block">{sidebar}</div>
          {mobile && (
            <div className="fixed inset-0 z-50 flex lg:hidden">
              {sidebar}
              <div className="flex-1 bg-navy/40" onClick={() => setMobile(false)} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
              <div className="flex h-14 items-center gap-3 px-4 md:px-6">
                <button className="lg:hidden" onClick={() => setMobile(true)} aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </button>
                <form
                  className="relative max-w-sm flex-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    nav({ to: "/observability", search: { q } });
                  }}
                >
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search request IDs, users, projects…" className="h-9 w-full rounded-lg border bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40" />
                </form>
                <div className="ml-auto flex items-center gap-1.5">
                  <button onClick={() => setAsk(true)} className="flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">
                    <Radar className="h-4 w-4" /> <span className="hidden sm:inline">Ask Q-GATE</span>
                  </button>
                  <Link to="/alerts" className="relative grid h-9 w-9 place-items-center rounded-lg hover:bg-muted" aria-label="Notifications">
                    <Bell className="h-4 w-4" />
                    {!!ov.data?.openAlerts && <span className="absolute right-1 top-1 rounded-full bg-ember px-1 text-[9px] font-bold text-ember-foreground">{ov.data.openAlerts}</span>}
                  </Link>
                  <button onClick={() => setDark((d) => !d)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-muted" aria-label="Toggle dark mode">
                    {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </button>
                  <Link to="/settings" className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-muted">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-peach text-xs font-bold text-ember">{meVal.user!.name.slice(0, 1).toUpperCase()}</span>
                    <span className="hidden text-left leading-tight md:block">
                      <span className="block text-xs font-semibold">{meVal.user!.name}</span>
                      <span className="block text-[10px] text-muted-foreground">{ROLES[meVal.roles[0] as keyof typeof ROLES] ?? "Member"}</span>
                    </span>
                    <ChevronDown className="hidden h-3 w-3 md:block" />
                  </Link>
                </div>
              </div>
              <div className="flex gap-2 overflow-x-auto border-t px-4 py-2 md:px-6">
                <span className="eyebrow self-center">Context</span>
                <select className={sel} value={f.bu} onChange={(e) => setF({ ...f, bu: e.target.value })} aria-label="Business unit">
                  <option value="All">All business units</option>
                  {BUSINESS_UNITS.map((x) => <option key={x}>{x}</option>)}
                </select>
                <select className={sel} value={f.team} onChange={(e) => setF({ ...f, team: e.target.value })} aria-label="Team">
                  <option value="All">All teams</option>
                  {TEAMS.map((x) => <option key={x}>{x}</option>)}
                </select>
                <select className={sel} value={f.env} onChange={(e) => setF({ ...f, env: e.target.value })} aria-label="Environment">
                  <option value="All">All environments</option>
                  {ENVIRONMENTS.map((x) => <option key={x}>{x}</option>)}
                </select>
                <select className={sel} value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })} aria-label="Provider">
                  <option value="All">All providers</option>
                  {(ov.data?.providers ?? []).map((p: any) => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
                <select className={sel} value={f.alias} onChange={(e) => setF({ ...f, alias: e.target.value })} aria-label="Model alias">
                  <option value="All">All aliases</option>
                  {ALIASES.map((x) => <option key={x}>{x}</option>)}
                </select>
                <select className={sel} value={f.range} onChange={(e) => setF({ ...f, range: e.target.value })} aria-label="Date range">
                  <option value="24h">Last 24 hours</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                </select>
              </div>
            </header>
            <main className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">
              <Outlet />
            </main>
          </div>
        </div>
        <AskPanel open={ask} onOpenChange={setAsk} />
      </FiltersContext.Provider>
    </MeContext.Provider>
  );
}
