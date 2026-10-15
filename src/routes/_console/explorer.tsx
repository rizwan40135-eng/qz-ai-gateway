/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Badge, gatewayBase, inputCls, PageHeader, Panel, Select, useSessionKey } from "@/components/qg/ui";
import { Button } from "@/components/ui/button";
import { callGateway, type CallResult } from "@/components/qg/gatewayClient";

export const Route = createFileRoute("/_console/explorer")({
  head: () => ({
    meta: [
      { title: "API Request Explorer — Q-GATE AI" },
      { name: "description", content: "Send real requests to the Q-GATE gateway and inspect status, headers, streaming events and usage." },
      { property: "og:title", content: "API Request Explorer — Q-GATE AI" },
      { property: "og:description", content: "Responses, Chat Completions, Messages and Embeddings against your Q-GATE key." },
    ],
  }),
  component: Explorer,
});

const EX: Record<string, { method: "GET" | "POST"; path: string; body: any }> = {
  Responses: { method: "POST", path: "/responses", body: { model: "qz-code", input: "Review: for i in range(len(x)): print(x[i+1])", stream: true } },
  "Chat Completions": { method: "POST", path: "/chat/completions", body: { model: "qz-code", messages: [{ role: "user", content: "Write a regex for ISO dates" }] } },
  Messages: { method: "POST", path: "/messages", body: { model: "qz-code", max_tokens: 256, system: "Be concise.", messages: [{ role: "user", content: "What is a circuit breaker?" }] } },
  Embeddings: { method: "POST", path: "/embeddings", body: { model: "qz-embedding", input: ["governed enterprise AI"] } },
  Models: { method: "GET", path: "/models", body: {} },
  "Secret leak (blocked)": { method: "POST", path: "/responses", body: { model: "qz-code", input: "Why does this fail? apiKey='sk-proj-a8F2kLmN0pQ9rS7tUv'" } },
  "PII (redacted)": { method: "POST", path: "/responses", body: { model: "qz-code", input: "Draft a reply to jane.doe@nova-enterprise.com about ticket CUST-004512." } },
};

function Explorer() {
  const sk = useSessionKey();
  const [key, setKey] = useState(sk?.key ?? "");
  const [ex, setEx] = useState("Responses");
  const [method, setMethod] = useState<"GET" | "POST">("POST");
  const [path, setPath] = useState("/responses");
  const [headers, setHeaders] = useState('{\n  "x-qgate-data-class": "INTERNAL"\n}');
  const [body, setBody] = useState(JSON.stringify(EX.Responses.body, null, 2));
  const [res, setRes] = useState<CallResult | null>(null);
  const [live, setLive] = useState("");
  const [busy, setBusy] = useState(false);
  const pick = (k: string) => {
    setEx(k);
    setMethod(EX[k].method);
    setPath(EX[k].path);
    setBody(JSON.stringify(EX[k].body, null, 2));
  };
  const usage = res?.json?.usage ?? (() => { const last = [...(res?.events ?? [])].reverse().find((e) => e.includes("usage")); try { const j = JSON.parse(last?.split("data:")[1] ?? "{}"); return j.usage ?? j.response?.usage; } catch { return null; } })();
  return (
    <div className="space-y-6">
      <PageHeader index="Requests" title="API Request Explorer" subtitle={`Live requests to ${gatewayBase()} using your own Q-GATE key.`} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel className="space-y-3 p-5">
          <input className={inputCls + " font-mono"} placeholder="Authorization: Bearer qzg_live_…" value={key} onChange={(e) => setKey(e.target.value.trim())} />
          <div className="flex flex-wrap gap-1.5">{Object.keys(EX).map((k) => <button key={k} onClick={() => pick(k)} className={`rounded-md border px-2 py-1 text-xs ${ex === k ? "border-primary bg-accent" : ""}`}>{k}</button>)}</div>
          <div className="flex gap-2">
            <Select className="w-24" value={method} onChange={(v) => setMethod(v as "GET")} options={["GET", "POST"]} />
            <input className={inputCls + " font-mono"} value={path} onChange={(e) => setPath(e.target.value)} />
          </div>
          <label className="block text-xs font-semibold text-muted-foreground">Headers (JSON)</label>
          <textarea className={inputCls + " h-20 py-2 font-mono text-xs"} value={headers} onChange={(e) => setHeaders(e.target.value)} />
          <label className="block text-xs font-semibold text-muted-foreground">Body</label>
          <textarea className={inputCls + " h-56 py-2 font-mono text-xs"} value={body} onChange={(e) => setBody(e.target.value)} />
          <Button disabled={!key || busy} onClick={async () => {
            setBusy(true);
            setLive("");
            try {
              setRes(await callGateway({ key, method, path, body: method === "POST" ? JSON.parse(body) : undefined, headers: JSON.parse(headers || "{}"), onDelta: setLive }));
            } catch (e: any) {
              setRes({ status: 0, requestId: null, headers: {}, text: e.message, events: [], ms: 0 });
            }
            setBusy(false);
          }}>{busy ? <Loader2 className="animate-spin" /> : <Send />} Send</Button>
          {!key && <p className="text-xs text-muted-foreground">Create a key in Developer Portal → My AI Access; it is prefilled for this session.</p>}
        </Panel>
        <Panel className="space-y-3 p-5">
          {busy && live && <div className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">{live}<span className="animate-pulse">▍</span></div>}
          {res && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{`HTTP ${res.status}`}</Badge>
                <span className="text-xs text-muted-foreground">{res.ms}ms</span>
                {res.headers["x-qgate-simulated"] && <Badge tone="ember">SIMULATED PROVIDER RESPONSE</Badge>}
                {res.headers["x-qgate-fallback"] && <Badge tone="warning">FALLBACK</Badge>}
                {res.headers["x-qgate-redacted"] && <Badge tone="warning">REDACTED · {res.headers["x-qgate-redacted"]}</Badge>}
                {res.requestId && <Link to="/trace/$id" params={{ id: res.requestId }} className="font-mono text-xs text-primary">{res.requestId} →</Link>}
              </div>
              {usage && <div className="text-xs">Token usage: <b>{JSON.stringify(usage)}</b></div>}
              {res.json?.error && <div className="text-xs">Policy result: <b>{res.json.error.policy_id ?? res.json.error.code}</b> · retryable {String(res.json.error.retryable)}</div>}
              <div className="eyebrow">Headers</div>
              <pre className="code-panel max-h-40 overflow-auto p-3 text-[11px]">{Object.entries(res.headers).filter(([k]) => k.startsWith("x-qgate") || k === "content-type").map(([k, v]) => `${k}: ${v}`).join("\n")}</pre>
              <div className="eyebrow">{res.events.length ? `Streaming events (${res.events.length})` : "Response"}</div>
              <pre className="code-panel max-h-96 overflow-auto p-3 text-[11px]">{res.events.length ? res.events.slice(0, 60).join("\n\n") : JSON.stringify(res.json, null, 2) ?? res.text}</pre>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
