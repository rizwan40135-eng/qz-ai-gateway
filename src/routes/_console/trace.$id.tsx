/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, AlertTriangle, MinusCircle } from "lucide-react";
import { getTrace } from "@/lib/qgate/api.functions";
import { fmtUsd } from "@/lib/qgate/constants";
import { Badge, Empty, PageHeader, Panel } from "@/components/qg/ui";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_console/trace/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Trace ${params.id} — Q-GATE AI` },
      { name: "description", content: "Step-by-step governance trace for a single Q-GATE request." },
      { property: "og:title", content: `Request trace — Q-GATE AI` },
      { property: "og:description", content: "Why was this request allowed or blocked?" },
    ],
  }),
  component: TracePage,
});

const CANON = ["Request Received", "Q-GATE Key Authenticated", "Project Resolved", "Entitlement Checked", "Environment Checked", "Data Policy Checked", "Budget Checked", "Rate Limit Checked", "Content Guardrail", "Alias Resolved", "Route Selected", "Provider Called", "First Token", "Response Completed", "Usage Recorded", "Audit Recorded"];
const CODES: Record<string, { level: string; title: string }> = {
  model_not_allowed: { level: "Entitlement", title: "403 MODEL_NOT_ALLOWED" },
  model_access_approval_required: { level: "Entitlement", title: "403 MODEL ACCESS APPROVAL REQUIRED" },
  environment_not_allowed: { level: "Environment", title: "403 ENVIRONMENT_NOT_ALLOWED" },
  policy_blocked: { level: "Content / Data", title: "403 POLICY_BLOCKED" },
  approval_required: { level: "Content", title: "403 APPROVAL_REQUIRED" },
  budget_exceeded: { level: "Budget", title: "402 BUDGET_EXCEEDED" },
  budget_warning: { level: "Budget", title: "402 BUDGET WARNING" },
  rate_limit_exceeded: { level: "Rate Limit", title: "429 RATE_LIMIT_EXCEEDED" },
  invalid_key: { level: "Identity", title: "401 INVALID_KEY" },
  key_expired: { level: "Identity", title: "401 KEY_EXPIRED" },
  provider_unavailable: { level: "Routing", title: "503 PROVIDER_UNAVAILABLE" },
  data_class_not_allowed: { level: "Data Classification", title: "403 DATA_CLASS_NOT_ALLOWED" },
};

function TracePage() {
  const { id } = Route.useParams();
  const fg = useServerFn(getTrace);
  const { data: t, isLoading } = useQuery({ queryKey: ["trace", id], queryFn: () => fg({ data: { id } }) });
  if (isLoading) return <div className="text-sm text-muted-foreground">Loading trace…</div>;
  if (!t) return <Empty title="Trace not found">No request with ID {id}.</Empty>;
  const steps: any[] = t.steps ?? CANON.map((n) => ({ n, result: t.status === 200 ? "PASS" : "INFO", ms: 0, detail: "Seeded historical trace — step detail summarized" }));
  const ok = t.status === 200;
  const blockedStep = steps.find((s) => s.result === "FAIL" && s.n !== "Provider Called");
  return (
    <div className="space-y-6">
      <PageHeader
        index="Request trace"
        title={t.id}
        subtitle={`${new Date(t.created_at).toLocaleString()} · ${t.endpoint ?? ""}`}
        actions={<><Badge>{ok ? "200 OK" : `${t.status} ${t.error_code}`}</Badge>{t.simulated && <Badge tone="ember">SIMULATED PROVIDER RESPONSE</Badge>}{t.fallback && <Badge tone="warning">FALLBACK · SAME REQUEST ID</Badge>}</>}
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Panel className="p-5">
          <div className="eyebrow mb-4">Timeline</div>
          <ol className="relative space-y-1 border-l pl-6">
            {steps.map((s, i) => {
              const I = s.result === "PASS" ? CheckCircle2 : s.result === "FAIL" ? XCircle : s.result === "WARN" ? AlertTriangle : MinusCircle;
              return (
                <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="relative py-1.5">
                  <I className={`absolute -left-[33px] top-2 h-4 w-4 bg-card ${s.result === "PASS" ? "text-success" : s.result === "FAIL" ? "text-danger" : s.result === "WARN" ? "text-warning" : "text-muted-foreground"}`} />
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="w-6 font-mono text-[10px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-sm font-semibold">{s.n}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">+{s.ms}ms</span>
                  </div>
                  <div className="ml-8 text-xs text-muted-foreground">{s.detail}</div>
                </motion.li>
              );
            })}
          </ol>
        </Panel>
        <div className="space-y-4">
          <Panel className="p-5">
            <div className="eyebrow mb-3">Request</div>
            <dl className="space-y-1.5 text-xs">
              {[
                ["Developer", t.user_name], ["Team", t.team], ["Project", t.project_name], ["Key", t.key_prefix], ["Environment", t.environment], ["Alias", t.alias],
                ["Provider", t.provider ?? "—"], ["Model", t.model ?? "—"], ["Input tokens", t.input_tokens], ["Output tokens", t.output_tokens],
                ["Configured price → Est. cost", fmtUsd(t.cost, 6)], ["Usage", t.usage_estimated ? "USAGE ESTIMATED" : "PROVIDER-REPORTED TOKENS"], ["TTFT", `${t.ttft_ms}ms`], ["Latency", `${t.latency_ms}ms`], ["Logging", t.logging ?? "—"], ["Policy", `${t.policy_result}${t.policy_id ? " · " + t.policy_id : ""}`],
              ].map(([k, v]) => <div key={k as string} className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-semibold">{String(v)}</dd></div>)}
            </dl>
          </Panel>
          {ok ? (
            <Panel className="p-5">
              <div className="eyebrow mb-3">Why was this request allowed?</div>
              <ul className="space-y-1.5 text-sm">
                {["Identity Valid", "Key Active", "Project Active", "Model Entitled", "Environment Allowed", "Data Classification Allowed", "Budget Available", "Rate Limit Available", "Security Policy Passed", t.fallback ? "Fallback Provider Healthy (primary circuit open)" : "Provider Healthy"].map((x) => <li key={x} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" />{x}</li>)}
              </ul>
            </Panel>
          ) : (
            <Panel className="border-danger/40 p-5">
              <div className="eyebrow mb-2 text-danger">Why was this request blocked?</div>
              <div className="font-display text-lg font-semibold">{CODES[t.error_code]?.title ?? `${t.status} ${t.error_code}`}</div>
              <dl className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between"><dt className="text-muted-foreground">Blocking rule</dt><dd className="font-semibold">{blockedStep?.n ?? "Policy"}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Policy ID</dt><dd className="font-mono">{t.policy_id ?? "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Policy level</dt><dd>{CODES[t.error_code]?.level ?? "Gateway"}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Metadata</dt><dd>{t.team} · {t.environment} · {t.alias}</dd></div>
              </dl>
              <p className="mt-3 rounded-lg bg-danger-soft p-3 text-xs text-danger">{blockedStep?.detail ?? "Request rejected by policy."}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="ember" asChild><Link to="/developer">Request access</Link></Button>
                <Button size="sm" variant="outline" asChild><Link to="/approvals">Approval route</Link></Button>
              </div>
            </Panel>
          )}
          {(t.request_preview || t.response_preview) && (
            <Panel className="p-5 text-xs">
              <div className="eyebrow mb-2">Content ({t.logging})</div>
              <div className="code-panel mb-2 whitespace-pre-wrap p-3">{t.request_preview}</div>
              <div className="code-panel whitespace-pre-wrap p-3">{t.response_preview}</div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
