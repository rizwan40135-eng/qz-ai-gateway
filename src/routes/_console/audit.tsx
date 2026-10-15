/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listAudit } from "@/lib/qgate/api.functions";
import { Badge, inputCls, PageHeader, Panel, Table } from "@/components/qg/ui";

export const Route = createFileRoute("/_console/audit")({
  head: () => ({
    meta: [
      { title: "Audit Trail — Q-GATE AI" },
      { name: "description", content: "Immutable record of key, alias, model, provider, budget, policy and access changes." },
      { property: "og:title", content: "Audit Trail — Q-GATE AI" },
      { property: "og:description", content: "Who changed what, when and why." },
    ],
  }),
  component: Audit,
});

function Audit() {
  const fl = useServerFn(listAudit);
  const { data } = useQuery({ queryKey: ["audit"], queryFn: () => fl() });
  const [q, setQ] = useState("");
  const rows = (data ?? []).filter((a: any) => !q || JSON.stringify(a).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-6">
      <PageHeader index="Operate" title="Audit Trail" subtitle={`${data?.length ?? 0} most recent events`} />
      <Panel className="p-4">
        <input className={inputCls + " mb-3 max-w-sm"} placeholder="Filter actor, action, resource…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Table
          head={["Timestamp", "Actor", "Action", "Resource", "Previous", "New", "Reason", "Request ID"]}
          rows={rows.map((a: any) => [
            new Date(a.created_at).toLocaleString(), a.actor, <Badge key="a" tone="info">{a.action}</Badge>, <span key="r" className="font-mono text-xs">{a.resource}</span>,
            <span key="p" className="block max-w-[180px] truncate text-xs text-muted-foreground">{a.prev_value ?? "—"}</span>,
            <span key="n" className="block max-w-[220px] truncate text-xs">{a.new_value ?? "—"}</span>,
            <span key="re" className="block max-w-[200px] truncate text-xs">{a.reason ?? "—"}</span>,
            a.request_id ? <Link key="id" to="/trace/$id" params={{ id: a.request_id }} className="font-mono text-xs text-primary">{a.request_id}</Link> : "—",
          ])}
        />
      </Panel>
    </div>
  );
}
