/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getCatalog, setModelStatus } from "@/lib/qgate/api.functions";
import { Badge, errMsg, PageHeader, Panel, Table, useCan } from "@/components/qg/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_console/catalog")({
  head: () => ({
    meta: [
      { title: "Model Catalog — Q-GATE AI" },
      { name: "description", content: "Enterprise model registry and alias catalog with capabilities, pricing, health and lifecycle status." },
      { property: "og:title", content: "Model Catalog — Q-GATE AI" },
      { property: "og:description", content: "Registered provider models and enterprise aliases." },
    ],
  }),
  component: Catalog,
});

const STATUSES = ["Discovered", "Under Review", "Approved", "Restricted", "Deprecated", "Disabled"];

function Catalog() {
  const fc = useServerFn(getCatalog);
  const ss = useServerFn(setModelStatus);
  const qc = useQueryClient();
  const can = useCan("manage_models");
  const { data } = useQuery({ queryKey: ["catalog"], queryFn: () => fc() });
  const prov = (id: string) => data?.providers?.find((p: any) => p.id === id);
  const aliasFor = (mid: string) => (data?.aliases ?? []).filter((a: any) => a.primary_model === mid || a.fallback_model === mid).map((a: any) => a.alias + (a.fallback_model === mid ? " (fb)" : "")).join(", ");
  const model = (id: string) => data?.models?.find((m: any) => m.id === id);
  return (
    <div className="space-y-6">
      <PageHeader index="03 · Registry" title="Model Catalog" subtitle="Every registered provider model and the enterprise alias it serves. Developers only see aliases." />
      <Tabs defaultValue="aliases">
        <TabsList>
          <TabsTrigger value="aliases">Enterprise aliases</TabsTrigger>
          <TabsTrigger value="models">Provider models</TabsTrigger>
        </TabsList>
        <TabsContent value="aliases">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(data?.aliases ?? []).map((a: any) => {
              const p = model(a.primary_model);
              const f = model(a.fallback_model);
              return (
                <Panel key={a.alias} className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-lg font-semibold text-primary">{a.alias}</span>
                    <div className="flex gap-1"><Badge tone="muted">v{a.version}</Badge><Badge>{a.status.toUpperCase()}</Badge></div>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{a.purpose}</p>
                  <dl className="mt-4 space-y-1.5 text-xs">
                    {[
                      ["Primary route", p ? `${prov(p.provider_id)?.name} · ${p.provider_model}` : "—"],
                      ["Fallback route", f ? `${prov(f.provider_id)?.name} · ${f.provider_model}` : "none"],
                      ["Strategy", a.strategy],
                      ["Environments", a.environments.join(", ")],
                      ["Max data class", a.max_class],
                      ["Latency threshold", `${a.latency_ms} ms`],
                      ["Retry policy", `${a.retries} retry then fallback`],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>
                    ))}
                  </dl>
                </Panel>
              );
            })}
          </div>
        </TabsContent>
        <TabsContent value="models">
          <Panel>
            <Table
              head={["Provider", "Provider Model ID", "Alias", "Capabilities", "Max Class", "Region", "Context", "Vision", "Stream", "Tools", "JSON", "Price in/out (1M)", "Latency", "Err %", "Health", "Status"]}
              rows={(data?.models ?? []).map((m: any) => {
                const p = prov(m.provider_id);
                const healthy = p && !p.simulated_outage && !m.simulated_outage && p.status === "enabled";
                return [
                  p?.name,
                  <span key="m" className="font-mono text-xs">{m.provider_model}</span>,
                  <span key="a" className="font-mono text-xs text-primary">{aliasFor(m.id) || "—"}</span>,
                  m.capabilities.join(", "),
                  m.max_class,
                  m.region,
                  (m.context_window / 1000).toFixed(0) + "K",
                  m.vision ? "✓" : "—",
                  m.streaming ? "✓" : "—",
                  m.tools ? "✓" : "—",
                  m.structured ? "✓" : "—",
                  `$${m.input_price} / $${m.output_price}`,
                  `${m.latency_ms}ms`,
                  `${m.error_rate}%`,
                  <Badge key="h">{healthy ? "HEALTHY" : "OUTAGE"}</Badge>,
                  can ? (
                    <select
                      key="s"
                      className="h-7 rounded-md border bg-card px-1 text-xs"
                      value={m.status}
                      onChange={async (e) => {
                        try {
                          await ss({ data: { id: m.id, status: e.target.value } });
                          toast.success(`${m.provider_model} → ${e.target.value}`);
                          qc.invalidateQueries({ queryKey: ["catalog"] });
                        } catch (err) {
                          toast.error(errMsg(err));
                        }
                      }}
                    >
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  ) : (
                    <Badge key="s">{m.status.toUpperCase()}</Badge>
                  ),
                ];
              })}
            />
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
