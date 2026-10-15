/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { keyAction, listKeys } from "@/lib/qgate/api.functions";
import { Badge, CopyButton, errMsg, inputCls, Kpi, PageHeader, Panel, Table } from "@/components/qg/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtNum, fmtUsd } from "@/lib/qgate/constants";

export const Route = createFileRoute("/_console/keys")({
  head: () => ({
    meta: [
      { title: "Gateway Keys — Q-GATE AI" },
      { name: "description", content: "Inventory of Q-GATE virtual keys and service-account credentials with rotation, revocation and budgets." },
      { property: "og:title", content: "Gateway Keys — Q-GATE AI" },
      { property: "og:description", content: "Human and machine Q-GATE credentials." },
    ],
  }),
  component: Keys,
});

function Keys() {
  const fl = useServerFn(listKeys);
  const ka = useServerFn(keyAction);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["keys"], queryFn: () => fl() });
  const [tab, setTab] = useState<"human" | "service">("human");
  const [q, setQ] = useState("");
  const [rotated, setRotated] = useState<string | null>(null);
  const keys = (data?.keys ?? []).filter((k: any) => k.kind === tab && (!q || `${k.name} ${k.owner_name} ${k.projects?.name}`.toLowerCase().includes(q.toLowerCase())));
  const all = data?.keys ?? [];
  const can = (k: any) => data?.isAdmin || k.owner_id === data?.me;
  async function act(k: any, action: any, value?: number) {
    try {
      const r: any = await ka({ data: { id: k.id, action, value } });
      if (r.plaintext) setRotated(r.plaintext);
      toast.success(`${k.name}: ${action}`);
      qc.invalidateQueries({ queryKey: ["keys"] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  }
  return (
    <div className="space-y-6">
      <PageHeader index="05 · Credentials" title="Gateway Keys" subtitle="Plaintext keys are shown once at creation. Q-GATE stores SHA-256 hashes only." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Active keys" value={all.filter((k: any) => k.status === "active").length} />
        <Kpi label="Service accounts" value={all.filter((k: any) => k.kind === "service").length} />
        <Kpi label="Expiring ≤30d" value={all.filter((k: any) => k.status === "active" && new Date(k.expires_at).getTime() - Date.now() < 30 * 864e5).length} tone="ember" />
        <Kpi label="Unused 60d+" value={all.filter((k: any) => k.status === "active" && k.last_used && Date.now() - new Date(k.last_used).getTime() > 60 * 864e5).length} />
      </div>
      <Panel className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {(["human", "service"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === t ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              {t === "human" ? "Human keys" : "Service accounts"}
            </button>
          ))}
          <input className={inputCls + " ml-auto max-w-xs"} placeholder="Filter by name, owner, project" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Table
          head={["Key Name", "Prefix", "Owner", "Project", "Env", "Aliases", "Created", "Last Used", "Expiry", "Requests", "Tokens", "Spend", "Budget", "Status", "Actions"]}
          rows={keys.map((k: any) => [
            <b key="n">{k.name}</b>,
            <span key="p" className="font-mono text-xs">{k.prefix}••••••••{k.last4}</span>,
            k.owner_name,
            k.projects?.name,
            k.environment,
            <span key="a" className="font-mono text-xs">{k.aliases.join(", ")}</span>,
            new Date(k.created_at).toLocaleDateString(),
            k.last_used ? new Date(k.last_used).toLocaleDateString() : "never",
            new Date(k.expires_at).toLocaleDateString(),
            fmtNum(k.requests),
            fmtNum(k.tokens),
            fmtUsd(k.spend),
            fmtUsd(k.budget, 0),
            <Badge key="s">{k.status.toUpperCase()}</Badge>,
            can(k) && k.status !== "revoked" ? (
              <select
                key="x"
                className="h-7 rounded-md border bg-card px-1 text-xs"
                value=""
                onChange={(e) => {
                  const a = e.target.value;
                  if (a === "budget") {
                    const v = Number(prompt("New key budget (USD)", String(k.budget)));
                    if (v > 0) act(k, "budget", v);
                  } else if (a === "revoke") {
                    if (confirm(`Revoke ${k.name}? This is permanent.`)) act(k, "revoke");
                  } else if (a) act(k, a, a === "extend" ? 30 : undefined);
                }}
              >
                <option value="">Actions…</option>
                <option value="rotate">Rotate</option>
                {k.status === "active" ? <option value="disable">Disable</option> : <option value="enable">Enable</option>}
                <option value="revoke">Revoke</option>
                <option value="extend">Extend 30 days</option>
                <option value="budget">Change budget</option>
              </select>
            ) : (
              <span key="x" className="text-xs text-muted-foreground">—</span>
            ),
          ])}
        />
      </Panel>
      <Dialog open={!!rotated} onOpenChange={(b) => !b && setRotated(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Key rotated</DialogTitle></DialogHeader>
          <div className="flex gap-2 rounded-xl bg-peach p-3 text-sm text-ember"><AlertTriangle className="h-4 w-4" /> Copy this key now. It will not be shown again. The previous key stopped working immediately.</div>
          <div className="code-panel flex items-center justify-between gap-2 p-3 text-sm"><span className="break-all">{rotated}</span>{rotated && <CopyButton text={rotated} />}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
