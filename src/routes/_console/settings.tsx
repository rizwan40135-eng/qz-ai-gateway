import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/lib/qgate/api.functions";
import { BUSINESS_UNITS, ROLES, TEAMS } from "@/lib/qgate/constants";
import { Badge, Field, PageHeader, Panel, Select, useMe } from "@/components/qg/ui";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_console/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Q-GATE AI" },
      { name: "description", content: "Your Q-GATE profile, roles and permissions." },
      { property: "og:title", content: "Settings — Q-GATE AI" },
      { property: "og:description", content: "Profile, roles and effective permissions." },
    ],
  }),
  component: Settings,
});

function Settings() {
  const me = useMe();
  const up = useServerFn(updateProfile);
  const qc = useQueryClient();
  const [team, setTeam] = useState(me.user?.team ?? "Engineering");
  const [bu, setBu] = useState(me.user?.bu ?? "Technology");
  return (
    <div className="space-y-6">
      <PageHeader index="Settings" title="Profile & permissions" subtitle="Identity comes from your Lovable workspace sign-in. Roles are assigned by an Organization Admin." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="space-y-3 p-5">
          <div className="text-lg font-semibold">{me.user?.name}</div>
          <div className="text-sm text-muted-foreground">{me.user?.email}</div>
          <Field label="Home team"><Select value={team} onChange={setTeam} options={TEAMS} /></Field>
          <Field label="Business unit"><Select value={bu} onChange={setBu} options={BUSINESS_UNITS} /></Field>
          <Button onClick={async () => { await up({ data: { team, bu } }); toast.success("Profile saved"); qc.invalidateQueries({ queryKey: ["me"] }); }}>Save</Button>
        </Panel>
        <Panel className="p-5">
          <div className="eyebrow mb-2">Roles</div>
          <div className="flex flex-wrap gap-2">{me.roles.map((r) => <Badge key={r} tone="info">{ROLES[r as keyof typeof ROLES] ?? r}</Badge>)}</div>
          <div className="eyebrow mb-2 mt-5">Effective permissions (enforced server-side)</div>
          <div className="flex flex-wrap gap-2">{me.perms.length ? me.perms.map((p) => <Badge key={p} tone="muted">{p}</Badge>) : <span className="text-sm text-muted-foreground">Read-only</span>}</div>
        </Panel>
      </div>
    </div>
  );
}
