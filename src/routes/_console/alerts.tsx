/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { alertAction, listAlerts } from "@/lib/qgate/api.functions";
import { Badge, errMsg, PageHeader, Panel, Select, useMe } from "@/components/qg/ui";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_console/alerts")({
  head: () => ({
    meta: [
      { title: "Alert Center — Q-GATE AI" },
      { name: "description", content: "Spend, budget, error, latency, outage, policy, key-security and deprecation alerts." },
      { property: "og:title", content: "Alert Center — Q-GATE AI" },
      { property: "og:description", content: "Acknowledge, assign, resolve or snooze gateway alerts." },
    ],
  }),
  component: Alerts,
});

function Alerts() {
  const fl = useServerFn(listAlerts);
  const aa = useServerFn(alertAction);
  const qc = useQueryClient();
  const me = useMe();
  const { data } = useQuery({ queryKey: ["alerts"], queryFn: () => fl() });
  const [st, setSt] = useState("open");
  const [type, setType] = useState("All");
  const rows = (data ?? []).filter((a: any) => (st === "all" || a.status === st) && (type === "All" || a.type === type));
  const types: string[] = ["All", ...Array.from(new Set<string>((data ?? []).map((a: any) => a.type as string)))];
  const act = async (a: any, action: any) => {
    try {
      await aa({ data: { id: a.id, action, assignee: me.user?.name } });
      toast.success(`Alert ${action}d`);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  return (
    <div className="space-y-6">
      <PageHeader index="Operate" title="Alert Center" subtitle={`${(data ?? []).filter((a: any) => a.status === "open").length} open alerts`} />
      <div className="flex flex-wrap gap-2">
        <Select className="w-44" value={st} onChange={setSt} options={[{ v: "open", l: "Open" }, { v: "acknowledged", l: "Acknowledged" }, { v: "snoozed", l: "Snoozed" }, { v: "resolved", l: "Resolved" }, { v: "all", l: "All" }]} />
        <Select className="w-52" value={type} onChange={setType} options={types} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((a: any) => (
          <Panel key={a.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2"><Badge>{a.severity.toUpperCase()}</Badge><span className="eyebrow">{a.type}</span></div>
                <div className="mt-1.5 font-semibold">{a.title}</div>
                <div className="text-xs text-muted-foreground">{a.detail} · {new Date(a.created_at).toLocaleString()}{a.assignee ? ` · assigned to ${a.assignee}` : ""}</div>
              </div>
              <Badge>{a.status.toUpperCase()}</Badge>
            </div>
            {a.status !== "resolved" && (
              <div className="mt-3 flex flex-wrap gap-2">
                {a.status === "open" && <Button size="sm" variant="outline" onClick={() => act(a, "acknowledge")}>Acknowledge</Button>}
                <Button size="sm" variant="outline" onClick={() => act(a, "assign")}>Assign to me</Button>
                <Button size="sm" variant="outline" onClick={() => act(a, "snooze")}>Snooze 24h</Button>
                <Button size="sm" onClick={() => act(a, "resolve")}>Resolve</Button>
              </div>
            )}
          </Panel>
        ))}
      </div>
    </div>
  );
}
