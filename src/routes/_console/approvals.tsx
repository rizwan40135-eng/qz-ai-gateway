/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { decideRequest, listRequests } from "@/lib/qgate/api.functions";
import { ALIASES, CLASSES, ENVIRONMENTS, LOGGING_MODES, fmtNum, fmtUsd } from "@/lib/qgate/constants";
import { Badge, Empty, errMsg, Field, inputCls, PageHeader, Panel, Select } from "@/components/qg/ui";
import { Checks } from "@/components/qg/dialogs";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_console/approvals")({
  head: () => ({
    meta: [
      { title: "Approval Center — Q-GATE AI" },
      { name: "description", content: "Review model access, production, restricted-data, budget and exception requests." },
      { property: "og:title", content: "Approval Center — Q-GATE AI" },
      { property: "og:description", content: "Approve, approve with conditions, reject or request information." },
    ],
  }),
  component: Approvals,
});

function Approvals() {
  const fl = useServerFn(listRequests);
  const dr = useServerFn(decideRequest);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["requests"], queryFn: () => fl() });
  const [tab, setTab] = useState("pending");
  const [sel, setSel] = useState<string | null>(null);
  const [cond, setCond] = useState<any>(null);
  const [note, setNote] = useState("");
  const reqs = (data?.requests ?? []).filter((r: any) => (tab === "pending" ? ["pending", "info_requested"].includes(r.status) : !["pending", "info_requested"].includes(r.status)));
  const r = (data?.requests ?? []).find((x: any) => x.id === sel) ?? reqs[0];
  const g = data?.gov?.find((x: any) => x.team === r?.team);
  async function decide(action: any) {
    try {
      const out = await dr({ data: { id: r.id, action, conditions: action === "approve_conditions" ? cond : undefined, note } });
      toast.success(out.entitlement ? `Approved — entitlement ACTIVE for ${out.entitlement.alias}` : `Request ${out.status}`);
      setCond(null);
      setNote("");
      qc.invalidateQueries();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }
  return (
    <div className="space-y-6">
      <PageHeader index="Operate" title="Approval Center" subtitle="Model Access · Production Access · Restricted Data · Budget Increase · Temporary Entitlement · Policy Exception · Provider Enablement" />
      <div className="flex gap-2">
        {["pending", "decided"].map((t) => <button key={t} onClick={() => { setTab(t); setSel(null); }} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === t ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{t === "pending" ? "Pending" : "Decided"}</button>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <Panel className="max-h-[75vh] divide-y overflow-y-auto">
          {reqs.length ? reqs.map((x: any) => (
            <button key={x.id} onClick={() => setSel(x.id)} className={`block w-full p-3 text-left transition hover:bg-muted ${r?.id === x.id ? "bg-accent" : ""}`}>
              <div className="flex items-center justify-between"><span className="font-mono text-sm font-semibold text-primary">{x.alias}</span><Badge>{x.status.toUpperCase()}</Badge></div>
              <div className="mt-0.5 text-xs">{x.kind} · {x.requester_name} · {x.team}</div>
              <div className="text-[11px] text-muted-foreground">{x.environment} · {x.data_class} · {new Date(x.created_at).toLocaleString()}</div>
            </button>
          )) : <div className="p-6"><Empty title="Nothing here" /></div>}
        </Panel>
        {r && (
          <Panel className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="eyebrow">{r.kind}</div>
                <h2 className="font-display text-xl font-semibold">{r.alias} · {r.projects?.name ?? "—"}</h2>
              </div>
              <Badge>{r.outcome ?? "REVIEW"}</Badge>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              {[["Requester", r.requester_name], ["Business Unit", r.business_unit], ["Team", r.team], ["Use Case", r.use_case], ["Environment", r.environment], ["Data Classification", r.data_class], ["Expected Tokens", fmtNum(r.expected_tokens)], ["Estimated Cost", fmtUsd(r.expected_spend, 0)], ["Team Budget", g ? `${fmtUsd(g.spent_usd, 0)} / ${fmtUsd(g.budget_usd, 0)}` : "—"], ["Project Budget", r.projects ? `${fmtUsd(r.projects.spent_usd, 0)} / ${fmtUsd(r.projects.budget_usd, 0)}` : "—"], ["Duration", `${r.duration_days} days`], ["Decided by", r.decided_by ?? "—"]].map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
            </dl>
            <div className="mt-4 rounded-lg bg-muted p-3 text-sm"><b>Justification:</b> {r.justification}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {r.data_class === "RESTRICTED" && <Badge tone="danger">RISK: RESTRICTED DATA</Badge>}
              {r.environment === "Production" && <Badge tone="warning">RISK: PRODUCTION</Badge>}
              {g && g.spent_usd / g.budget_usd > 0.8 && <Badge tone="warning">RISK: TEAM BUDGET ≥80%</Badge>}
            </div>
            {r.preflight && <div className="mt-4"><div className="eyebrow mb-2">Policy evaluation</div><Checks checks={r.preflight} /></div>}
            {["pending", "info_requested"].includes(r.status) && data?.canApprove && (
              <>
                <div className="mt-4"><Field label="Decision note"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => decide("approve")}>Approve</Button>
                  <Button variant="ember" onClick={() => setCond({ alias: r.alias, environment: r.environment, max_class: r.data_class, monthly_budget: r.kind === "Temporary Entitlement" ? 100 : 500, rpm: 100, tpm: 100000, expiry_days: r.kind === "Temporary Entitlement" ? 7 : 90, logging: "METADATA ONLY", endpoints: ["responses", "chat", "messages", "models"] })}>Approve with conditions</Button>
                  <Button variant="outline" onClick={() => decide("request_info")}>Request information</Button>
                  <Button variant="destructive" onClick={() => decide("reject")}>Reject</Button>
                </div>
                {cond && (
                  <div className="mt-4 grid gap-3 rounded-xl border p-4 md:grid-cols-3">
                    <Field label="Allowed alias"><Select value={cond.alias} onChange={(v) => setCond({ ...cond, alias: v })} options={ALIASES} /></Field>
                    <Field label="Allowed environment"><Select value={cond.environment} onChange={(v) => setCond({ ...cond, environment: v })} options={ENVIRONMENTS} /></Field>
                    <Field label="Maximum data class"><Select value={cond.max_class} onChange={(v) => setCond({ ...cond, max_class: v })} options={CLASSES} /></Field>
                    <Field label="Monthly budget (USD)"><input type="number" className={inputCls} value={cond.monthly_budget} onChange={(e) => setCond({ ...cond, monthly_budget: Number(e.target.value) })} /></Field>
                    <Field label="RPM"><input type="number" className={inputCls} value={cond.rpm} onChange={(e) => setCond({ ...cond, rpm: Number(e.target.value) })} /></Field>
                    <Field label="TPM"><input type="number" className={inputCls} value={cond.tpm} onChange={(e) => setCond({ ...cond, tpm: Number(e.target.value) })} /></Field>
                    <Field label="Expiry (days)"><input type="number" className={inputCls} value={cond.expiry_days} onChange={(e) => setCond({ ...cond, expiry_days: Number(e.target.value) })} /></Field>
                    <Field label="Logging policy"><Select value={cond.logging} onChange={(v) => setCond({ ...cond, logging: v })} options={LOGGING_MODES} /></Field>
                    <Field label="Allowed endpoints">
                      <div className="flex flex-wrap gap-1">{["responses", "chat", "messages", "embeddings", "models"].map((ep) => <label key={ep} className="flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px]"><input type="checkbox" checked={cond.endpoints.includes(ep)} onChange={(e) => setCond({ ...cond, endpoints: e.target.checked ? [...cond.endpoints, ep] : cond.endpoints.filter((x: string) => x !== ep) })} />{ep}</label>)}</div>
                    </Field>
                    <div className="md:col-span-3"><Button onClick={() => decide("approve_conditions")}>Create entitlement with conditions</Button></div>
                  </div>
                )}
              </>
            )}
            {!data?.canApprove && <p className="mt-4 text-xs text-muted-foreground">Your role can view but not decide approvals.</p>}
          </Panel>
        )}
      </div>
    </div>
  );
}
