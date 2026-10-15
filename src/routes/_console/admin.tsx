/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getCatalog, listProjects, listUsers, providerAction, registerModel, setProjectStatus, setUserRole, upsertProvider, listKeys } from "@/lib/qgate/api.functions";
import { CLASSES, ENVIRONMENTS, ROLES, fmtNum, fmtUsd, permissionsFor } from "@/lib/qgate/constants";
import { Badge, errMsg, Field, inputCls, PageHeader, Panel, Select, Table, useCan } from "@/components/qg/ui";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_console/admin")({
  head: () => ({
    meta: [
      { title: "Administration — Q-GATE AI" },
      { name: "description", content: "Providers, secrets, models, users, roles, projects, applications and environments." },
      { property: "og:title", content: "Administration — Q-GATE AI" },
      { property: "og:description", content: "Operate the Q-GATE control plane." },
    ],
  }),
  component: Admin,
});

const APPS = ["Developer Agent", "Finance Copilot", "Customer Insights Assistant", "Forecast Agent", "Document Processor"];

function Admin() {
  const fc = useServerFn(getCatalog);
  const fu = useServerFn(listUsers);
  const fp = useServerFn(listProjects);
  const fk = useServerFn(listKeys);
  const pa = useServerFn(providerAction);
  const upP = useServerFn(upsertProvider);
  const rm = useServerFn(registerModel);
  const sr = useServerFn(setUserRole);
  const ps = useServerFn(setProjectStatus);
  const qc = useQueryClient();
  const canModels = useCan("manage_models");
  const canUsers = useCan("manage_users");
  const canApprove = useCan("approve");
  const cat = useQuery({ queryKey: ["catalog"], queryFn: () => fc() });
  const users = useQuery({ queryKey: ["users"], queryFn: () => fu(), retry: false });
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fp() });
  const keys = useQuery({ queryKey: ["keys"], queryFn: () => fk() });
  const [np, setNp] = useState<any>({ name: "", kind: "OpenAI-compatible", base_url: "https://", auth: "Bearer", region: "us-east", external: true, restricted_ok: false });
  const [nm, setNm] = useState<any>({ provider_id: "lovable-ai", provider_model: "", capabilities: "chat", max_class: "INTERNAL", region: "us-east", context_window: 128000, input_price: 0.5, output_price: 2 });
  const [secret, setSecret] = useState<Record<string, string>>({});
  const [testRes, setTestRes] = useState<Record<string, string>>({});
  const refresh = () => qc.invalidateQueries();
  const run = async (fn: () => Promise<any>, msg: string) => {
    try {
      await fn();
      toast.success(msg);
      refresh();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const traffic = (name: string) => (cat.data?.traffic ?? []).filter((t: any) => String(t.provider ?? "").startsWith(name));

  return (
    <div className="space-y-6">
      <PageHeader index="11 · Administration" title="Administration" subtitle="All changes persist and are written to the audit trail." />
      <Tabs defaultValue="providers">
        <TabsList className="flex-wrap">
          {["providers", "models", "users", "roles", "projects", "applications", "environments", "more"].map((t) => <TabsTrigger key={t} value={t} className="capitalize">{t === "more" ? "Aliases · Policies · Pricing · Budgets" : t}</TabsTrigger>)}
        </TabsList>

        <TabsContent value="providers" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {(cat.data?.providers ?? []).map((p: any) => {
              const tr = traffic(p.name);
              return (
                <Panel key={p.id} className="p-5">
                  <div className="flex items-start justify-between">
                    <div><div className="font-semibold">{p.name}</div><div className="font-mono text-[11px] text-muted-foreground">{p.id} · {p.base_url}</div></div>
                    <div className="flex gap-1"><Badge>{p.status.toUpperCase()}</Badge>{p.id === "demo" && <Badge tone="ember">SIMULATED</Badge>}</div>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                    {[["Kind", p.kind], ["Auth", p.auth], ["Region", p.region], ["Restricted OK", p.restricted_ok ? "yes" : "no"], ["Traffic", tr.length], ["Errors", tr.filter((t: any) => t.status !== 200).length], ["Health", p.simulated_outage ? "OUTAGE" : "HEALTHY"], ["Secret", p.secret_last4 ? `${p.secret_last4} · ${p.secret_status}` : "not configured"]].map(([k, v]) => <div key={k as string}><dt className="text-muted-foreground">{k}</dt><dd className="font-semibold">{String(v)}</dd></div>)}
                  </dl>
                  {canModels && p.id !== "demo" && (
                    <div className="mt-4 space-y-2">
                      <div className="flex gap-2">
                        <input type="password" autoComplete="off" className={inputCls + " font-mono"} placeholder={p.pending_secret_last4 ? `Pending ${p.pending_secret_last4} — test & activate` : "Add new secret (never displayed again)"} value={secret[p.id] ?? ""} onChange={(e) => setSecret({ ...secret, [p.id]: e.target.value })} disabled={p.id === "lovable-ai"} />
                        <Button size="sm" variant="outline" disabled={p.id === "lovable-ai" || !secret[p.id]} onClick={() => run(async () => { await pa({ data: { id: p.id, action: "set_secret", secret: secret[p.id] } }); setSecret({ ...secret, [p.id]: "" }); }, "Secret stored as pending")}>Add secret</Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={async () => { const r: any = await pa({ data: { id: p.id, action: "test" } }); setTestRes({ ...testRes, [p.id]: `${r.ok ? "✓" : "✗"} ${r.detail}` }); }}>Test connection</Button>
                        {p.pending_secret_last4 && <Button size="sm" onClick={() => run(() => pa({ data: { id: p.id, action: "activate_secret" } }), "New secret active")}>Activate</Button>}
                        {String(p.secret_status).includes("previous") && <Button size="sm" variant="outline" onClick={() => run(() => pa({ data: { id: p.id, action: "retire_secret" } }), "Previous secret retired")}>Retire previous</Button>}
                        <Button size="sm" variant={p.status === "enabled" ? "destructive" : "default"} onClick={() => run(() => pa({ data: { id: p.id, action: p.status === "enabled" ? "disable" : "enable" } }), `Provider ${p.status === "enabled" ? "disabled" : "enabled"}`)}>{p.status === "enabled" ? "Disable" : "Enable"}</Button>
                      </div>
                      {testRes[p.id] && <div className="text-xs text-muted-foreground">{testRes[p.id]}</div>}
                      {p.id === "lovable-ai" && <div className="text-[11px] text-muted-foreground">Managed server-side credential. Never exposed to browsers or developers.</div>}
                    </div>
                  )}
                </Panel>
              );
            })}
          </div>
          {canModels && (
            <Panel className="p-5">
              <h3 className="mb-3 font-semibold">Add provider</h3>
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                <Field label="Display name"><input className={inputCls} value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} /></Field>
                <Field label="Type"><Select value={np.kind} onChange={(v) => setNp({ ...np, kind: v })} options={["OpenAI", "Anthropic", "Azure OpenAI", "OpenAI-compatible", "Anthropic-compatible"]} /></Field>
                <Field label="Base URL"><input className={inputCls} value={np.base_url} onChange={(e) => setNp({ ...np, base_url: e.target.value })} /></Field>
                <Field label="Auth strategy"><Select value={np.auth} onChange={(v) => setNp({ ...np, auth: v })} options={["Bearer", "x-api-key", "API key header", "Managed identity"]} /></Field>
                <Field label="Region"><input className={inputCls} value={np.region} onChange={(e) => setNp({ ...np, region: e.target.value })} /></Field>
                <Field label="Approved for Restricted"><Select value={np.restricted_ok ? "yes" : "no"} onChange={(v) => setNp({ ...np, restricted_ok: v === "yes", external: v !== "yes" })} options={["no", "yes"]} /></Field>
              </div>
              <Button className="mt-3" disabled={!np.name} onClick={() => run(() => upP({ data: np }), "Provider registered")}>Add provider</Button>
            </Panel>
          )}
        </TabsContent>

        <TabsContent value="models">
          <Panel className="p-5">
            <h3 className="mb-3 font-semibold">Register model</h3>
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Provider"><Select value={nm.provider_id} onChange={(v) => setNm({ ...nm, provider_id: v })} options={(cat.data?.providers ?? []).map((p: any) => ({ v: p.id, l: p.name }))} /></Field>
              <Field label="Provider model ID"><input className={inputCls} value={nm.provider_model} onChange={(e) => setNm({ ...nm, provider_model: e.target.value })} placeholder="openai/gpt-5.4-mini" /></Field>
              <Field label="Capabilities (comma)"><input className={inputCls} value={nm.capabilities} onChange={(e) => setNm({ ...nm, capabilities: e.target.value })} /></Field>
              <Field label="Max class"><Select value={nm.max_class} onChange={(v) => setNm({ ...nm, max_class: v })} options={CLASSES} /></Field>
              <Field label="Region"><input className={inputCls} value={nm.region} onChange={(e) => setNm({ ...nm, region: e.target.value })} /></Field>
              <Field label="Context window"><input type="number" className={inputCls} value={nm.context_window} onChange={(e) => setNm({ ...nm, context_window: e.target.value })} /></Field>
              <Field label="Input $/1M"><input type="number" className={inputCls} value={nm.input_price} onChange={(e) => setNm({ ...nm, input_price: e.target.value })} /></Field>
              <Field label="Output $/1M"><input type="number" className={inputCls} value={nm.output_price} onChange={(e) => setNm({ ...nm, output_price: e.target.value })} /></Field>
            </div>
            <Button className="mt-3" disabled={!canModels || !nm.provider_model} onClick={() => run(() => rm({ data: nm }), "Model registered as Under Review")}>Register model</Button>
            <p className="mt-2 text-xs text-muted-foreground">New models start as Under Review (Sandbox only). Approve them in the Model Catalog, then map them in Routing Studio.</p>
          </Panel>
        </TabsContent>

        <TabsContent value="users">
          <Panel className="p-5">
            {users.error ? <p className="text-sm text-muted-foreground">{errMsg(users.error)}</p> : (
              <Table head={["User", "Email", "Team", ...Object.values(ROLES)]} rows={(users.data ?? []).map((u: any) => [<b key="n">{u.display_name}</b>, u.email, u.team, ...Object.keys(ROLES).map((r) => <input key={r} type="checkbox" disabled={!canUsers} checked={u.roles.includes(r)} onChange={(e) => run(() => sr({ data: { userId: u.id, role: r, on: e.target.checked } }), `${ROLES[r as keyof typeof ROLES]} ${e.target.checked ? "granted" : "removed"}`)} />)])} />
            )}
            <p className="mt-3 text-xs text-muted-foreground">Users appear after first sign-in. The first user becomes Organization Admin. Seeded directory: 80 Nova Enterprise users are represented in traces, keys and projects.</p>
          </Panel>
        </TabsContent>

        <TabsContent value="roles">
          <Panel className="p-5">
            <Table head={["Role", "build", "approve", "manage_models", "manage_policies", "manage_finops", "manage_users", "view_audit", "view_content"]} rows={Object.entries(ROLES).map(([k, l]) => { const p = permissionsFor([k]); return [<b key="r">{l}</b>, ...["build", "approve", "manage_models", "manage_policies", "manage_finops", "manage_users", "view_audit", "view_content"].map((x) => (p.includes(x as any) ? "✓" : "—"))]; })} />
            <p className="mt-3 text-xs text-muted-foreground">Permissions are verified in every server function; hiding a button is never the control. No developer key can receive admin scopes.</p>
          </Panel>
        </TabsContent>

        <TabsContent value="projects">
          <Panel className="p-5">
            <Table head={["Project", "Team", "BU", "Owner", "Env", "Class", "Cost center", "Budget", "Spent", "Status", ""]} rows={(projects.data?.all ?? []).map((p: any) => [<b key="n">{p.name}</b>, p.team, p.business_unit, p.owner_name, p.environment, p.data_class, p.cost_center, fmtUsd(p.budget_usd, 0), fmtUsd(p.spent_usd, 2), <Badge key="s">{p.status.toUpperCase()}</Badge>, canApprove ? <Button key="a" size="sm" variant="outline" onClick={() => run(() => ps({ data: { id: p.id, status: p.status === "active" ? "disabled" : "active" } }), "Project status changed — next request re-checked")}>{p.status === "active" ? "Disable" : "Enable"}</Button> : null])} />
          </Panel>
        </TabsContent>

        <TabsContent value="applications">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {APPS.map((a, i) => {
              const proj = (projects.data?.all ?? []).filter((p: any) => p.seeded)[i * 4] ?? {};
              const ks = (keys.data?.keys ?? []).filter((k: any) => k.project_id === proj.id);
              return (
                <Panel key={a} className="p-5">
                  <div className="flex justify-between"><b>{a}</b><Badge>{i === 3 ? "WARNING" : "HEALTHY"}</Badge></div>
                  <dl className="mt-3 grid grid-cols-2 gap-1.5 text-xs">
                    {[["Owner", proj.owner_name], ["Project", proj.name], ["Environment", proj.environment], ["Service account", `svc-${a.toLowerCase().split(" ")[0]}`], ["Keys", ks.length], ["Aliases", Array.from(new Set(ks.flatMap((k: any) => k.aliases))).join(", ") || "—"], ["Requests", fmtNum(ks.reduce((s: number, k: any) => s + Number(k.requests), 0))], ["Tokens", fmtNum(ks.reduce((s: number, k: any) => s + Number(k.tokens), 0))], ["Spend", fmtUsd(ks.reduce((s: number, k: any) => s + Number(k.spend), 0), 0)], ["Policies", `${proj.data_class} · ${proj.environment === "Production" ? "NO CONTENT" : "METADATA"}`], ["Last seen", ks[0]?.last_used ? new Date(ks[0].last_used).toLocaleDateString() : "—"]].map(([k, v]) => <div key={k as string}><dt className="text-muted-foreground">{k}</dt><dd className="font-semibold">{String(v ?? "—")}</dd></div>)}
                  </dl>
                </Panel>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Applications authenticate with service-account keys (Gateway Keys → Service accounts), separate from human credentials.</p>
        </TabsContent>

        <TabsContent value="environments">
          <div className="grid gap-4 md:grid-cols-4">
            {ENVIRONMENTS.map((e) => (
              <Panel key={e} className="p-5">
                <div className="font-semibold">{e}</div>
                <p className="mt-2 text-xs text-muted-foreground">{e === "Production" ? "Requires admin approval; conservative logging; qzg_live_ keys." : e === "Sandbox" ? "Under Review models permitted; Public/Internal data." : "Auto-approvable for allowed aliases; qzg_test_ keys."}</p>
              </Panel>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="more">
          <div className="grid gap-3 md:grid-cols-4">
            {[["Aliases & routing", "/routing"], ["Policies", "/policies"], ["Pricing ledger", "/finops"], ["Budgets & governance", "/access"]].map(([l, to]) => <Link key={l} to={to} className="panel lift p-5 font-semibold">{l} →</Link>)}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
