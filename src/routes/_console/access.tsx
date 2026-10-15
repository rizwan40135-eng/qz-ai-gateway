/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getGovernance, setGovernance, setMatrix } from "@/lib/qgate/api.functions";
import { ALIASES, CLASSES, ENVIRONMENTS, LOGGING_MODES, MATRIX_STATES, TEAMS, fmtUsd } from "@/lib/qgate/constants";
import { Badge, errMsg, PageHeader, Panel, Select, Table } from "@/components/qg/ui";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_console/access")({
  head: () => ({
    meta: [
      { title: "Access & Entitlements — Q-GATE AI" },
      { name: "description", content: "Central entitlement matrix and governance matrix. Changes take effect on the next request." },
      { property: "og:title", content: "Access & Entitlements — Q-GATE AI" },
      { property: "og:description", content: "Team × alias × environment entitlement governance." },
    ],
  }),
  component: Access,
});

const NEXT: Record<string, string> = { ALLOWED: "APPROVAL REQUIRED", "APPROVAL REQUIRED": "DENIED", DENIED: "ALLOWED" };

function Access() {
  const fg = useServerFn(getGovernance);
  const sm = useServerFn(setMatrix);
  const sg = useServerFn(setGovernance);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["gov"], queryFn: () => fg() });
  const [env, setEnv] = useState("*");
  const canEdit = data?.perms?.some((p: string) => p === "manage_policies" || p === "manage_models");
  const cell = (team: string, alias: string) => {
    const m = data?.matrix ?? [];
    const own = m.find((x: any) => x.team === team && x.alias === alias && x.environment === env);
    const inh = m.find((x: any) => x.team === team && x.alias === alias && x.environment === "*");
    return { state: own?.state ?? inh?.state ?? "APPROVAL REQUIRED", inherited: !own && env !== "*" };
  };
  const [edit, setEdit] = useState<any>(null);

  return (
    <div className="space-y-6">
      <PageHeader index="04 · Governance" title="Access & Entitlements" subtitle="Click a cell to cycle ALLOWED → APPROVAL REQUIRED → DENIED. Every gateway request re-checks this matrix — no keys are reissued." />
      <Panel className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="eyebrow">Environment scope</span>
          <Select className="w-56" value={env} onChange={setEnv} options={[{ v: "*", l: "All environments (default)" }, ...ENVIRONMENTS.map((e) => ({ v: e, l: `${e} override` }))]} />
          {!canEdit && <Badge tone="muted">Read-only for your role</Badge>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr>
                <th className="eyebrow p-2 text-left">Team / Group</th>
                {ALIASES.map((a) => <th key={a} className="p-2 text-left font-mono text-xs text-primary">{a}</th>)}
              </tr>
            </thead>
            <tbody>
              {TEAMS.map((t) => (
                <tr key={t} className="border-t">
                  <td className="p-2 font-semibold">{t}</td>
                  {ALIASES.map((a) => {
                    const c = cell(t, a);
                    return (
                      <td key={a} className="p-1.5">
                        <button
                          disabled={!canEdit}
                          onClick={async () => {
                            try {
                              await sm({ data: { team: t, alias: a, environment: env, state: NEXT[c.state] } });
                              toast.success(`${t} · ${a} · ${env === "*" ? "all envs" : env} → ${NEXT[c.state]}`);
                              qc.invalidateQueries({ queryKey: ["gov"] });
                            } catch (e) {
                              toast.error(errMsg(e));
                            }
                          }}
                          className={`w-full rounded-lg px-2 py-2 text-[11px] font-bold transition hover:ring-2 hover:ring-ring/30 ${c.state === "ALLOWED" ? "bg-success-soft text-success" : c.state === "DENIED" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning"} ${c.inherited ? "opacity-60" : ""}`}
                        >
                          {c.state}
                          {c.inherited && <span className="block text-[9px] font-medium">inherited</span>}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex gap-2 text-xs text-muted-foreground">{MATRIX_STATES.map((s) => <Badge key={s}>{s}</Badge>)} <span>Environment overrides take precedence over the default row.</span></div>
      </Panel>

      <Panel className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Central governance matrix</h2>
          <span className="text-xs text-muted-foreground">Changes apply immediately</span>
        </div>
        <Table
          head={["Team", "Environment", "Data class", "Allowed aliases", "Budget", "Spent", "RPM", "TPM", "Logging", "Key expiry", "≥90% enforcement", ""]}
          rows={(data?.gov ?? []).map((g: any) => [
            <b key="t">{g.team}</b>, g.environment, <Badge key="c" tone="info">{g.data_class}</Badge>, <span key="a" className="font-mono text-xs">{g.aliases}</span>, fmtUsd(g.budget_usd, 0), fmtUsd(g.spent_usd, 0), g.rpm, g.tpm.toLocaleString(), g.logging, `${g.key_expiry_days} days`, g.enforcement,
            <Button key="e" size="sm" variant="outline" onClick={() => setEdit({ ...g })}>Edit</Button>,
          ])}
        />
        {edit && (
          <div className="mt-4 grid gap-3 rounded-xl border p-4 md:grid-cols-4">
            <div className="md:col-span-4 font-semibold">Edit {edit.team}</div>
            <label className="text-xs">Environment<Select value={edit.environment} onChange={(v) => setEdit({ ...edit, environment: v })} options={ENVIRONMENTS} /></label>
            <label className="text-xs">Data class<Select value={edit.data_class} onChange={(v) => setEdit({ ...edit, data_class: v })} options={CLASSES} /></label>
            <label className="text-xs">Allowed aliases<input className="h-9 w-full rounded-lg border bg-card px-2 text-sm" value={edit.aliases} onChange={(e) => setEdit({ ...edit, aliases: e.target.value })} /></label>
            <label className="text-xs">Budget USD<input type="number" className="h-9 w-full rounded-lg border bg-card px-2 text-sm" value={edit.budget_usd} onChange={(e) => setEdit({ ...edit, budget_usd: Number(e.target.value) })} /></label>
            <label className="text-xs">RPM<input type="number" className="h-9 w-full rounded-lg border bg-card px-2 text-sm" value={edit.rpm} onChange={(e) => setEdit({ ...edit, rpm: Number(e.target.value) })} /></label>
            <label className="text-xs">TPM<input type="number" className="h-9 w-full rounded-lg border bg-card px-2 text-sm" value={edit.tpm} onChange={(e) => setEdit({ ...edit, tpm: Number(e.target.value) })} /></label>
            <label className="text-xs">Logging<Select value={edit.logging} onChange={(v) => setEdit({ ...edit, logging: v })} options={LOGGING_MODES} /></label>
            <label className="text-xs">Key expiry days<input type="number" className="h-9 w-full rounded-lg border bg-card px-2 text-sm" value={edit.key_expiry_days} onChange={(e) => setEdit({ ...edit, key_expiry_days: Number(e.target.value) })} /></label>
            <label className="text-xs">≥90% enforcement<Select value={edit.enforcement} onChange={(v) => setEdit({ ...edit, enforcement: v })} options={["Alert", "Throttle", "Block", "Approval Required", "Recommend Lower-Cost Alias"]} /></label>
            <div className="flex items-end gap-2 md:col-span-3">
              <Button
                onClick={async () => {
                  try {
                    await sg({ data: edit });
                    toast.success(`${edit.team} governance updated`);
                    setEdit(null);
                    qc.invalidateQueries({ queryKey: ["gov"] });
                  } catch (e) {
                    toast.error(errMsg(e));
                  }
                }}
              >
                Save
              </Button>
              <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
