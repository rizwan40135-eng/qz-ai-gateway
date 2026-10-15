/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Activity, Cable, KeyRound, Loader2, Plus, Rocket, TerminalSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCatalog, getMyAccess, listProjects } from "@/lib/qgate/api.functions";
import { Badge, Empty, gatewayBase, PageHeader, Panel, Table, useSessionKey } from "@/components/qg/ui";
import { CreateKeyDialog, CreateProjectDialog, RequestAccessDialog } from "@/components/qg/dialogs";
import { callGateway } from "@/components/qg/gatewayClient";
import { fmtNum, fmtUsd } from "@/lib/qgate/constants";

export const Route = createFileRoute("/_console/developer")({
  head: () => ({
    meta: [
      { title: "Developer Portal — Q-GATE AI" },
      { name: "description", content: "Create projects, request enterprise model aliases, issue Q-GATE keys and integrate in minutes." },
      { property: "og:title", content: "Developer Portal — Q-GATE AI" },
      { property: "og:description", content: "Build with enterprise-approved AI." },
    ],
  }),
  component: Developer,
});

export function AccessCard({ e, project, onKey }: { e: any; project: any; onKey: () => void }) {
  const sk = useSessionKey();
  const nav = useNavigate();
  const [test, setTest] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const active = e.status === "active" && (!e.expires_at || new Date(e.expires_at) > new Date());
  async function runTest() {
    if (!sk || sk.alias !== e.alias) {
      toast.info("Create an API key first — Test Connection uses your real Q-GATE key.");
      return;
    }
    setBusy(true);
    setTest({ text: "" });
    try {
      const m = await callGateway({ key: sk.key, method: "GET", path: "/models" });
      const r = await callGateway({ key: sk.key, path: "/responses", body: { model: e.alias, input: "Reply with one sentence confirming the Q-GATE connection works.", stream: true }, onDelta: (t) => setTest((o: any) => ({ ...o, text: t })) });
      setTest({ models: m.json?.data?.map((x: any) => x.id) ?? [], status: r.status, text: r.text, requestId: r.requestId, simulated: r.headers["x-qgate-simulated"] === "true", ms: r.ms, error: r.json?.error });
    } catch (err: any) {
      setTest({ error: { message: err.message } });
    }
    setBusy(false);
  }
  return (
    <Panel className="flex flex-col p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono text-lg font-semibold text-primary">{e.alias}</div>
          <div className="text-xs text-muted-foreground">{project?.name}</div>
        </div>
        <Badge>{active ? "ACTIVE" : e.status.toUpperCase()}</Badge>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {[
          ["Environment", e.environment],
          ["Max Data Class", e.max_class],
          ["Monthly Budget", fmtUsd(e.monthly_budget, 0)],
          ["Spent", fmtUsd(e.spent_usd, 4)],
          ["RPM", e.rpm],
          ["TPM", fmtNum(e.tpm)],
          ["Expiry", e.expires_at ? new Date(e.expires_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"],
          ["Logging", e.logging],
        ].map(([k, v]) => (
          <div key={k as string}>
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 rounded-lg bg-muted p-2.5 font-mono text-[11px]">
        <div className="text-muted-foreground">Gateway Endpoint</div>
        <div className="break-all">{gatewayBase()}</div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button size="sm" onClick={onKey} disabled={!active}><KeyRound /> Create API Key</Button>
        <Button size="sm" variant="outline" onClick={runTest} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Cable />} Test Connection</Button>
        <Button size="sm" variant="outline" asChild><Link to="/integration" search={{ alias: e.alias }}><TerminalSquare /> View Integration</Link></Button>
        <Button size="sm" variant="outline" onClick={() => nav({ to: "/observability", search: { q: project?.name } })}><Activity /> View Usage</Button>
      </div>
      {test && (
        <div className="mt-4 space-y-2 rounded-xl border p-3 text-xs">
          {test.models && <div>GET /v1/models → <span className="font-mono">{test.models.join(", ") || "none"}</span></div>}
          {test.status && <div>POST /v1/responses → <Badge>{String(test.status)}</Badge> {test.ms}ms {test.simulated && <Badge tone="ember">SIMULATED PROVIDER RESPONSE</Badge>}</div>}
          {test.text && <div className="rounded-lg bg-muted p-2 text-[12px] leading-relaxed">{test.text}</div>}
          {test.error && <div className="text-danger">{test.error.code}: {test.error.message}</div>}
          {test.requestId && (
            <Button size="sm" variant="ember" asChild>
              <Link to="/trace/$id" params={{ id: test.requestId }}>View request trace</Link>
            </Button>
          )}
        </div>
      )}
    </Panel>
  );
}

function Developer() {
  const fp = useServerFn(listProjects);
  const fa = useServerFn(getMyAccess);
  const fc = useServerFn(getCatalog);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fp() });
  const access = useQuery({ queryKey: ["myaccess"], queryFn: () => fa() });
  const cat = useQuery({ queryKey: ["catalog"], queryFn: () => fc() });
  const [cp, setCp] = useState(false);
  const [ra, setRa] = useState<{ open: boolean; project?: string }>({ open: false });
  const [ck, setCk] = useState<any>(null);
  const mine = projects.data?.mine ?? [];
  const ents = access.data?.entitlements ?? [];
  const keys = access.data?.keys ?? [];
  const pById = (id: string) => mine.find((p: any) => p.id === id);

  return (
    <div className="space-y-6">
      <div className="panel hero-surface relative overflow-hidden p-7 md:p-10">
        <div className="eyebrow text-ember">02 · Developer Portal</div>
        <h1 className="mt-2 max-w-2xl text-3xl font-semibold md:text-4xl">Build with enterprise-approved AI.</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">One endpoint, one Q-GATE key, enterprise aliases like <span className="font-mono text-foreground">qz-code</span>. You never handle provider credentials or provider model IDs.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={() => setCp(true)}><Plus /> Create project</Button>
          <Button variant="ember" disabled={!mine.length} onClick={() => setRa({ open: true, project: mine[0]?.id })}><Rocket /> Request model access</Button>
          <Button variant="outline" asChild><Link to="/integration">Connect coding tool</Link></Button>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">My AI Access</h2>
        {ents.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ents.map((e: any) => <AccessCard key={e.id} e={e} project={pById(e.project_id)} onKey={() => setCk(e)} />)}
          </div>
        ) : (
          <Empty title="No approved aliases yet">Create a project, then click Request Model Access. Approved entitlements appear here with your gateway endpoint.</Empty>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">My Projects</h2>
            <Button size="sm" variant="outline" onClick={() => setCp(true)}><Plus /> New</Button>
          </div>
          {mine.length ? (
            <Table
              head={["Project", "Team", "Env", "Class", "Use case", ""]}
              rows={mine.map((p: any) => [<b key="n">{p.name}</b>, p.team, p.environment, <Badge key="c" tone="info">{p.data_class}</Badge>, p.use_case, <Button key="r" size="sm" variant="ember" onClick={() => setRa({ open: true, project: p.id })}>Request model access</Button>])}
            />
          ) : (
            <Empty title="No projects">Start with “Developer Productivity”.</Empty>
          )}
        </Panel>
        <Panel className="p-5">
          <h2 className="mb-3 font-semibold">My Keys</h2>
          {keys.length ? (
            <Table head={["Name", "Key", "Env", "Aliases", "Requests", "Spend", "Status"]} rows={keys.map((k: any) => [k.name, <span key="k" className="font-mono text-xs">{k.prefix}••••••••{k.last4}</span>, k.environment, k.aliases.join(", "), k.requests, fmtUsd(k.spend, 4), <Badge key="s">{k.status.toUpperCase()}</Badge>])} />
          ) : (
            <Empty title="No keys yet">Create one from an ACTIVE access card.</Empty>
          )}
          <div className="mt-3 text-right"><Link to="/keys" className="text-xs font-semibold text-primary">Manage keys →</Link></div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel className="p-5 xl:col-span-2">
          <h2 className="mb-3 font-semibold">Approved Models</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {(cat.data?.aliases ?? []).map((a: any) => (
              <div key={a.alias} className="rounded-xl border p-3">
                <div className="flex items-center justify-between"><span className="font-mono font-semibold text-primary">{a.alias}</span><Badge>{a.status.toUpperCase()}</Badge></div>
                <div className="mt-1 text-xs text-muted-foreground">{a.purpose}</div>
                <div className="mt-2 text-[11px] text-muted-foreground">Max {a.max_class} · {a.environments.join(" / ")}</div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel className="p-5">
          <h2 className="mb-3 font-semibold">Quickstarts & Docs</h2>
          <div className="space-y-2 text-sm">
            {[
              ["OpenAI-compatible client", "/integration"],
              ["Connect a coding tool", "/integration"],
              ["API request explorer", "/explorer"],
              ["Errors & rate limits", "/docs"],
              ["Data classification", "/docs"],
            ].map(([l, to]) => (
              <Link key={l} to={to} className="flex items-center justify-between rounded-lg border px-3 py-2 transition hover:border-primary">{l}<span className="text-muted-foreground">→</span></Link>
            ))}
          </div>
          <div className="mt-4 text-xs text-muted-foreground">My usage: {fmtUsd(keys.reduce((s: number, k: any) => s + Number(k.spend), 0), 4)} across {keys.reduce((s: number, k: any) => s + Number(k.requests), 0)} requests.</div>
        </Panel>
      </div>

      <CreateProjectDialog open={cp} onOpenChange={setCp} onCreated={(p) => setRa({ open: true, project: p.id })} />
      <RequestAccessDialog open={ra.open} onOpenChange={(b) => setRa({ open: b })} projects={mine} defaultProject={ra.project} />
      <CreateKeyDialog open={!!ck} onOpenChange={(b) => !b && setCk(null)} ent={ck} project={ck ? pById(ck.project_id) : null} />
    </div>
  );
}
